import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppState } from '../StateContext';
import {
  FilterState, FilterOptions, Measure, Source, Result, ResultsResponse, StateKey,
  defaultFilters, STATE_CONFIGS, speciesDisplayName, GENERATED_STATES, STATE_KEYS,
} from '../types';
import { isFreeState } from '../activeStates';
import { fetchFilters, fetchMeasures, fetchResults, fetchAllResults, DbStatus, fetchStatus, SubscriptionRequiredError } from '../api';
import { scopeScatterRows } from '../scatterScope';
import PaywallScreen from './PaywallScreen';
import AboutScreen from './AboutScreen';
import ResultRow, { cpueLabelForGear } from '../components/ResultRow';
import SpeciesPicker from '../components/SpeciesPicker';
import CountyMapPicker from '../components/CountyMapPicker';
import ScatterPlot from '../components/ScatterPlot';
import { useEntitlement } from '../useEntitlement';
import { useToast } from '../Toast';
import type { RootStackParamList } from '../navigation';
import {
  colors, text, space, hairline,
} from '../lakelore-rn/theme';
import {
  PaperHeader, Chip, Toggle, Segmented, PrimaryButton, LockIcon,
} from '../lakelore-rn/components';
import { AdvancedFiltersModal } from './search/AdvancedFiltersModal';
import { SortPickerModal } from './search/SortPickerModal';
import { MeasurePickerModal } from './search/MeasurePickerModal';
import { StatePickerModal } from './search/StatePickerModal';

const PAGE_SIZE = 50;

// Per-state "we've introduced the county picker to this user" flag set.
// Per-state county selection persisted across app launches. Stored as a
// JSON object mapping StateKey → string[] of county names. Seeded into
// filters.counties on mount and on state change so the user's last filter
// scope survives a cold launch. Updated when the user confirms a selection
// in the County map picker.
const COUNTY_SELECTION_KEY = 'countySelection.v1';

// Stripe colors: generated per-state palette, with the original launch
// states keeping their hand-picked stripes.
const STATE_STRIPES: Record<StateKey, string> = Object.fromEntries(
  STATE_KEYS.map(k => [k, GENERATED_STATES[k].stripe]),
) as Record<StateKey, string>;
Object.assign(STATE_STRIPES, {
  sd: colors.lakeInk,
  mn: '#2a4a3a',
  nd: colors.rust,
  ia: colors.moss,
  ne: '#a04030',
  wi: colors.lake3,
  mi: colors.lakeInk,
});

// Default gear for the current area + species: the most common CPUE-BEARING
// gear (server's gearCpueCounts), so a synthetic presence bucket at the top
// of the raw counts never hides the real electrofishing/net survey rows
// (NC's "no Largemouth records" bug). IA's server-computed station default
// wins when present. No CPUE anywhere in scope → no gear filter at all
// (restricting presence-tier results to one bucket adds nothing).
// Fallback/residual buckets — never the default when a primary signal exists
// (they're derived/leftover categories, not a survey a user would pick first).
const RESIDUAL_GEARS = new Set(['Presence Only', 'Trajectory', 'CPUE Normalized', 'Comprehensive', 'Mixed Gear']);

function defaultGearFor(opts: FilterOptions | null): string[] {
  if (!opts || opts.gearTypes.length === 0) return [];
  if (opts.defaultGear) return [opts.defaultGear];
  const argmax = (gears: string[], score: (g: string) => number) =>
    gears.slice().sort((a, b) => score(b) - score(a))[0];
  // 1) Biggest CPUE-BEARING gear — real survey rates win, so a synthetic
  //    presence bucket at the top of the raw counts never hides them (NC "no
  //    Largemouth records"). 'CPUE Normalized' is a rescue fallback, so it only
  //    wins when it's the sole CPUE option (IA 'Comprehensive' rule spirit).
  const cpue = opts.gearCpueCounts ?? {};
  const withCpue = opts.gearTypes.filter(g => (cpue[g] ?? 0) > 0 && g !== 'CPUE Normalized');
  if (withCpue.length > 0) return [argmax(withCpue, g => cpue[g] ?? 0)];
  // 2) No CPUE anywhere (ratings/presence states): default to the bucket with
  //    the MOST RECORDS for this selection, preferring a primary signal over a
  //    fallback bucket — e.g. IL 'Forecast Rating' (298) over 'Trajectory' (20).
  const counts = opts.gearTypeCounts ?? {};
  if (!Object.keys(counts).length) return [];
  const primary = opts.gearTypes.filter(g => !RESIDUAL_GEARS.has(g));
  const pool = primary.length ? primary : opts.gearTypes;
  return pool.length ? [argmax(pool, g => counts[g] ?? 0)] : [];
}

// Fold a Measure + its chosen Source into the filter state. The Source IS the
// Gear/Source choice, so it sets the scope fields (gearTypes / cpueKind /
// stockingFirst / presenceUnion) and the sort key; direction stays or is passed
// in. Presence has no ranking → stable name order (sortBy 'lake').
function applyMeasureSource(
  measure: Measure, source: Source | null, base: FilterState, dir?: 'asc' | 'desc',
): FilterState {
  const src = source ?? measure.sources.find(s => s.id === measure.defaultSourceId) ?? measure.sources[0] ?? null;
  return {
    ...base,
    measure: measure.id,
    sortBy: src?.sort ?? 'lake',
    sortDir: dir ?? src?.sortDir ?? 'desc',
    gearTypes: src?.gear ? [src.gear] : [],
    cpueKind: src?.cpueKind ?? '',
    stockingFirst: !!src?.stockingFirst,
    presenceUnion: !!src?.presenceUnion,
  };
}

// Default cascade (DATA_MODEL §2): measures arrive in cascade order (abundance →
// stocking → size → presence), so the first is the default. On a scope change we
// keep the user's current measure if it still has data, else fall to the first.
function pickMeasure(measures: Measure[], preferId?: string | null): Measure | null {
  if (!measures.length) return null;
  if (preferId) {
    const match = measures.find(m => m.id === preferId);
    if (match) return match;
  }
  return measures[0];
}

// Within a measure, keep the user's current source if it survives the scope
// change, else the measure's default (most records).
function pickSource(measure: Measure, preferId?: string | null): Source | null {
  if (!measure.sources.length) return null;
  if (preferId) {
    const match = measure.sources.find(s => s.id === preferId);
    if (match) return match;
  }
  return measure.sources.find(s => s.id === measure.defaultSourceId) ?? measure.sources[0];
}

interface SearchSession {
  filters: FilterState;
  results: Result[];
  scatterResults: Result[];
  total: number;
  page: number;
  searched: boolean;
  viewMode: 'list' | 'scatter';
  measures: Measure[];
  activeMeasureId: string | null;
  activeSourceId: string | null;
}

export default function SearchScreen() {
  const { state, stateConfig, setState, pendingCountyPick, consumeCountyPick } = useAppState();
  // Canadian provinces filter by regions (FMZs / management divisions), not
  // counties — label the chip and picker accordingly.
  const regionWord = GENERATED_STATES[state].country === 'CA' ? 'Regions' : 'Counties';
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [filters, setFilters] = useState<FilterState>(() => defaultFilters(state));
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  // Non-null when the visible results came from the offline cache — value is
  // the cache timestamp for the "showing saved results" banner.
  const [offlineCacheDate, setOfflineCacheDate] = useState<number | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [scatterResults, setScatterResults] = useState<Result[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'scatter'>('list');

  const [showSpeciesPicker, setShowSpeciesPicker] = useState(false);
  const [showCountyPicker, setShowCountyPicker] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [paywallTriggered, setPaywallTriggered] = useState<StateKey | null>(null);
  const [showSort, setShowSort] = useState(false);
  const [showMeasure, setShowMeasure] = useState(false);
  // Measures for the current species×county scope (DATA_MODEL_PROPOSAL_2026-07-20).
  // Empty when the server predates /measures — the toolbar then falls back to the
  // legacy sort button. The gear/source WITHIN a measure is chosen via the FILTERS
  // button (not a separate control); activeSourceId only tracks the current
  // default internally so measure/county changes can preserve it.
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [activeMeasureId, setActiveMeasureId] = useState<string | null>(null);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [paywallFor, setPaywallFor] = useState<StateKey | null>(null);
  const { hasAllStates, loading: entitlementLoading } = useEntitlement();
  const { toast } = useToast();

  // Paid-state PREVIEW mode: non-subscribers can search, filter, and see
  // every metric, but the server redacts lake names from /results (rows
  // render a blurred placeholder) and any lake-detail tap opens the paywall
  // instead of navigating. /lake/:id stays 402-gated server-side.
  //
  // Gated on entitlementLoading so a subscriber cold-launching doesn't get a
  // banner flash / paywall tap while the RC round-trip resolves. If the
  // client guesses wrong the server still decides: names come back redacted
  // (rows blur via lake_name === null) and /lake/:id 402s into the paywall.
  const preview = !entitlementLoading && !isFreeState(state) && !hasAllStates;

  const prevStateRef = useRef(state);
  const sessionCache = useRef<Partial<Record<StateKey, SearchSession>>>({});

  // Per-state persisted county selection (last user choice for each state).
  // `null` until the AsyncStorage load resolves. Used both to seed initial
  // filters.counties on mount and to restore counties when switching back to
  // a state that has no in-session cache (e.g. on cold launch).
  const [persistedCounties, setPersistedCounties] = useState<Partial<Record<StateKey, string[]>> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(COUNTY_SELECTION_KEY)
      .then(raw => {
        const parsed = raw ? (JSON.parse(raw) as Partial<Record<StateKey, string[]>>) : {};
        setPersistedCounties(parsed);
        // Seed counties for the state SearchScreen mounted with. Only apply
        // the seed if filters.counties is still at its default (empty); if
        // the user has somehow made a manual selection between mount and
        // this load resolving, don't clobber it.
        const saved = parsed[state];
        if (saved && saved.length > 0) {
          setFilters(prev => prev.counties.length === 0 ? { ...prev, counties: saved } : prev);
        }
      })
      .catch(() => setPersistedCounties({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // An EXPLICIT state pick (state map / in-search switcher) leads into the
  // county selector (state map → county map → results). Restored cold
  // launches skip it — the last state + county selection load silently
  // (pendingCountyPick is only set by StateContext.setState). States with no
  // county vocabulary (BC, AB) skip straight to results too.
  useEffect(() => {
    if (!pendingCountyPick) return;
    consumeCountyPick();
    if (!GENERATED_STATES[state].hasCounties) return;
    setShowCountyPicker(true);
  }, [pendingCountyPick, consumeCountyPick, state]);

  const persistCountySelection = useCallback((s: StateKey, counties: string[]) => {
    setPersistedCounties(prev => {
      const next = { ...(prev ?? {}), [s]: counties };
      AsyncStorage.setItem(COUNTY_SELECTION_KEY, JSON.stringify(next))
        .catch(() => { /* best-effort persistence */ });
      return next;
    });
  }, []);

  const loadStateOptions = useCallback(async (stateKey: StateKey) => {
    setLoadingOptions(true);
    setError(null);
    setDbStatus(null);
    try {
      const s = await fetchStatus(stateKey);
      setDbStatus(s);
      if (!s.ready) {
        setLoadingOptions(false);
        return;
      }
      const opts = await fetchFilters(stateKey);
      setOptions(opts);
      // Seed the gear filter with the most common CPUE-bearing gear for this
      // state (see defaultGearFor). Keeps any still-valid user selection.
      setFilters(prev => {
        const valid = prev.gearTypes.filter(g => opts.gearTypes.includes(g));
        if (valid.length > 0) return prev;
        return { ...prev, gearTypes: defaultGearFor(opts) };
      });
    } catch (err) {
      if (err instanceof SubscriptionRequiredError) {
        setPaywallTriggered(err.state);
      } else {
        // Cold-start offline (the MOST common offline case): /status fails
        // before any search can run, the species button is disabled, and the
        // offline cache used to be unreachable — hydrate it directly so the
        // "shows SOMETHING at the lake" goal survives a cold launch with no
        // signal (IMPROVEMENT_PLAN_2026-07-17 D1).
        const isNetwork = err instanceof Error && /reach server|timed out/.test(err.message);
        if (isNetwork) {
          try {
            const raw = await AsyncStorage.getItem(`offlineCache.v1.${stateKey}`);
            if (raw) {
              const cached = JSON.parse(raw);
              setResults(cached.results ?? []);
              setScatterResults(cached.scatterResults ?? []);
              setTotal(cached.total ?? 0);
              setPage(0);
              setSearched(true);
              setOfflineCacheDate(cached.ts ?? null);
              setLoadingOptions(false);
              return;
            }
          } catch { /* fall through to the error banner */ }
        }
        setError(err instanceof Error ? err.message : 'Could not load filters');
      }
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    if (prevStateRef.current !== state) {
      sessionCache.current[prevStateRef.current as StateKey] = {
        filters, results, scatterResults, total, page, searched, viewMode,
        measures, activeMeasureId, activeSourceId,
      };
      prevStateRef.current = state;

      const cached = sessionCache.current[state as StateKey];
      if (cached) {
        setFilters(cached.filters);
        setResults(cached.results);
        setScatterResults(cached.scatterResults);
        setTotal(cached.total);
        setPage(cached.page);
        setSearched(cached.searched);
        setViewMode(cached.viewMode);
        setMeasures(cached.measures ?? []);
        setActiveMeasureId(cached.activeMeasureId ?? null);
        setActiveSourceId(cached.activeSourceId ?? null);
      } else {
        // Restore saved counties for this state if we have them. Falls back
        // to defaultFilters' empty array if persistedCounties hasn't loaded
        // yet or this state has no saved selection.
        const savedCounties = persistedCounties?.[state] ?? [];
        setFilters({ ...defaultFilters(state), counties: savedCounties });
        setResults([]);
        setScatterResults([]);
        setTotal(0);
        setPage(0);
        setSearched(false);
        setViewMode('list');
        setMeasures([]);
        setActiveMeasureId(null);
        setActiveSourceId(null);
        // Auto-opening the county picker for new states is handled by the
        // [state, countyPickerSeen] effect above, gated on per-state seen
        // flags so it only fires the first time the user enters each state.
      }
      setOptions(null);
    }
    loadStateOptions(state);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handleSearch = useCallback(async (nextPage = 0, overrideFilters?: Partial<FilterState>) => {
    const f = overrideFilters ? { ...filters, ...overrideFilters } : filters;
    if (!f.species && !f.lakeName) {
      toast('Pick a species or enter a lake name to search.');
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const [data, allData]: [ResultsResponse, ResultsResponse | null] = await Promise.all([
        fetchResults(state, f, nextPage, PAGE_SIZE),
        nextPage === 0 ? fetchAllResults(state, f) : Promise.resolve(null),
      ]);
      const dropConsolidated = (rows: Result[]) =>
        state === 'ia' ? rows.filter(r => r.survey_date != null) : rows;
      if (nextPage === 0) {
        setResults(dropConsolidated(data.results));
      } else {
        setResults(prev => [...prev, ...dropConsolidated(data.results)]);
      }
      setTotal(data.total);
      setPage(nextPage);
      if (allData) setScatterResults(dropConsolidated(allData.results));
      setOfflineCacheDate(null);
      // Offline read cache (IMPROVEMENT_PLAN P3.6): persist the last
      // successful first-page search per state so the app shows SOMETHING
      // at the lake with no signal. Fire-and-forget.
      if (nextPage === 0) {
        AsyncStorage.setItem(`offlineCache.v1.${state}`, JSON.stringify({
          ts: Date.now(),
          results: dropConsolidated(data.results),
          scatterResults: allData ? dropConsolidated(allData.results) : [],
          total: data.total,
        })).catch(() => {});
      }
    } catch (err: unknown) {
      if (err instanceof SubscriptionRequiredError) {
        setPaywallTriggered(err.state);
      } else {
        // Network failure: fall back to the last cached results for this
        // state (stale beats blank at the lake), banner shows the age.
        const isNetwork = err instanceof Error && /reach server|timed out/.test(err.message);
        if (isNetwork && nextPage === 0) {
          try {
            const raw = await AsyncStorage.getItem(`offlineCache.v1.${state}`);
            if (raw) {
              const cached = JSON.parse(raw);
              setResults(cached.results ?? []);
              setScatterResults(cached.scatterResults ?? []);
              setTotal(cached.total ?? 0);
              setPage(0);
              setOfflineCacheDate(cached.ts ?? null);
              setLoading(false);
              return;
            }
          } catch { /* fall through to the error banner */ }
        }
        setError(err instanceof Error ? err.message : 'Search failed');
      }
    } finally {
      setLoading(false);
    }
  }, [filters, state]);

  // Load the Measure × Source manifest for a scope and fold the chosen
  // measure+source into `applyTo`. Returns the resulting filters. On any failure
  // (older server without /measures) it clears the measure list so the toolbar
  // falls back to the legacy sort button, and returns `applyTo` unchanged.
  // preferMeasureId/preferSourceId keep the user's current selection across a
  // county change; pass null on a species change to reset to the cascade default.
  const loadMeasuresFor = useCallback(async (
    species: string,
    counties: string[],
    applyTo: FilterState,
    preferMeasureId: string | null,
    preferSourceId: string | null,
  ): Promise<FilterState> => {
    try {
      const resp = await fetchMeasures(state, species || undefined, counties);
      const ms = resp.measures ?? [];
      setMeasures(ms);
      const measure = pickMeasure(ms, preferMeasureId);
      if (measure) {
        const source = pickSource(measure, preferSourceId);
        setActiveMeasureId(measure.id);
        setActiveSourceId(source?.id ?? null);
        return applyMeasureSource(measure, source, applyTo);
      }
      setActiveMeasureId(null);
      setActiveSourceId(null);
      return applyTo;
    } catch {
      setMeasures([]);
      setActiveMeasureId(null);
      setActiveSourceId(null);
      return applyTo;
    }
  }, [state]);

  const handleSpeciesSelect = async (species: string) => {
    // Refresh filter options so gear counts reflect this species, and reset the
    // gear filter to whichever gear has the most records for the new species.
    // Pass current counties so gear/species counts stay scoped to the same
    // area the user is searching in.
    let nextOpts = options;
    try {
      nextOpts = await fetchFilters(state, species || undefined, filters.counties);
      setOptions(nextOpts);
    } catch { /* keep existing options if refetch fails */ }

    // Seed gear via the legacy default first (fallback when /measures is absent),
    // then let the measure cascade for the new species take over the whole
    // (measure, gear/source, sort) choice. A new species resets to the default
    // measure (most abundance records) and its default source.
    let updated = { ...filters, species, gearTypes: defaultGearFor(nextOpts) };
    updated = await loadMeasuresFor(species, filters.counties, updated, null, null);
    setFilters(updated);
    if (species || filters.lakeName) {
      handleSearch(0, updated);
    }
  };

  const handleReset = async () => {
    // Restore baseline (all-species) gear counts so the advanced-filters picker
    // reflects the cleared species selection.
    let baseOpts = options;
    try {
      baseOpts = await fetchFilters(state);
      setOptions(baseOpts);
    } catch { /* keep existing options if refetch fails */ }

    const df = defaultFilters(state);
    df.gearTypes = defaultGearFor(baseOpts);
    setFilters(df);
    setResults([]);
    setScatterResults([]);
    setTotal(0);
    setPage(0);
    setSearched(false);
    setViewMode('list');
    // Clear the measure manifest too, else the toolbar keeps showing the old
    // measure (e.g. "Presence") while df's sort has reset — measures reload on
    // the next species/county pick.
    setMeasures([]);
    setActiveMeasureId(null);
    setActiveSourceId(null);
  };

  const handleLoadMore = () => {
    if (loading || results.length >= total) return;
    handleSearch(page + 1);
  };

  const speciesLabel = filters.species
    ? speciesDisplayName(filters.species, state)
    : 'Select Species';

  const hasFilters = filters.counties.length > 0
    || filters.minCpue || filters.maxCpue
    || filters.minYear || filters.maxYear
    || filters.minAcres || filters.maxAcres
    || filters.minStocked || filters.maxStocked;

  const stateCfg = STATE_CONFIGS[state];
  // Toolbar sort label: when sorting by CPUE and the user has narrowed to
  // exactly one gear (or the species itself only has one available), use the
  // gear-specific unit so it matches what each row shows.
  const singleGear = filters.gearTypes.length === 1
    ? filters.gearTypes[0]
    : (options?.gearTypes?.length === 1 ? options.gearTypes[0] : null);
  const sortLabel = filters.sortBy === 'cpue' && singleGear
    ? cpueLabelForGear(state, singleGear)
    : (stateCfg.sortOptions.find(o => o.value === filters.sortBy)?.label ?? filters.sortBy);
  // Measure toolbar state (DATA_MODEL). When measures loaded, the Measure is the
  // primary control (the "Sort by" label). Gear/source within a measure is
  // chosen via the FILTERS button, not a separate toolbar control.
  const activeMeasure = measures.find(m => m.id === activeMeasureId) ?? null;
  const useMeasurePicker = measures.length > 0;
  const viewMode2 = viewMode === 'list' ? 0 : 1;

  // Scatter gear self-scoping (2026-08-11, see src/scatterScope.ts): gear-less
  // measures (Stocking Impact / Presence) query every gear, which would stack
  // incomparable units on the scatter's Y axis and plot one dot per gear per
  // lake. The scatter scopes ITSELF to one gear — presentation-layer only,
  // `filters` is never touched, so list view keeps the measure's own
  // (gear-less) scope exactly as before.
  //
  // v2 (same day, owner report): scoping the fetched rows CLIENT-SIDE was
  // wrong under mostRecentOnly — a gear-less latest-only query returns ONE
  // row per lake (whatever gear its newest survey used), so post-hoc
  // filtering plotted "lakes whose latest survey happened to be trap nets"
  // (9 dots) while manually selecting trap nets showed the true population
  // (46: each lake's latest trap-net survey). The rows the scatter needs are
  // not in the result set at all — so the scatter REFETCHES with the derived
  // gear applied, matching manual gear selection exactly. The gear choice is
  // defaultGearFor — the same gear the Abundance measure would adopt — and
  // the client-side scoper stays as the offline / older-server fallback.
  const scatterScope = useMemo(
    () => scopeScatterRows(scatterResults, filters.gearTypes),
    [scatterResults, filters.gearTypes],
  );
  // Derivation applies ONLY when NO gear is in scope (gear-less measures).
  // Manual multi-select is an explicit user choice (owner decision 2026-08-12):
  // plot every selected gear's rows — the multi-gear query already returns each
  // lake's latest row PER GEAR, so the population matches the list exactly.
  const scatterNeedsDerivedGear = searched && filters.gearTypes.length === 0;
  // Fetched scatter rows carry the scatterResults REFERENCE they were fetched
  // for — validity is checked at render, not managed by a second effect.
  // (v2.1, 2026-08-12, owner-caught: the original separate "reset on new
  // search" effect ran AFTER the refetch effect in declaration order, so a
  // measure switch that derived the SAME gear early-returned on the stale
  // fetch and then had it wiped — no fetch ever ran, and the plot silently
  // fell back to client-side slicing of the union set: Presence showed 18
  // trap-net rows out of a 48-lake union.)
  const [scatterFetched, setScatterFetched] = useState<{ gear: string; rows: Result[]; forResults: Result[] } | null>(null);
  const scatterFetchedValid = scatterFetched != null && scatterFetched.forResults === scatterResults;
  const scatterFetchSeq = useRef(0);
  useEffect(() => {
    if (!scatterNeedsDerivedGear || viewMode !== 'scatter') return;
    const gear = defaultGearFor(options)[0] ?? scatterScope.gear;
    if (!gear) return;
    if (scatterFetchedValid && scatterFetched.gear === gear) return; // current rows in hand
    const seq = ++scatterFetchSeq.current;
    fetchAllResults(state, { ...filters, gearTypes: [gear], stockingFirst: false, presenceUnion: false })
      .then(resp => {
        if (seq !== scatterFetchSeq.current) return; // superseded by a newer request
        setScatterFetched({ gear, rows: resp.results, forResults: scatterResults });
      })
      .catch(() => { /* offline / older server — client-side fallback plots */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scatterNeedsDerivedGear, viewMode, scatterResults, options, state]);
  // What the plot renders: valid fetched gear-scoped rows when available,
  // client-side-scoped rows as fallback, the raw set on the single-gear path.
  const scatterPlotRows = scatterNeedsDerivedGear
    ? (scatterFetchedValid ? scatterFetched.rows : scatterScope.rows)
    : scatterResults;
  const scatterPlotGear = scatterNeedsDerivedGear
    ? (scatterFetchedValid ? scatterFetched.gear : (scatterScope.derived ? scatterScope.gear : null))
    : null;
  // Honest Y-axis unit for a DERIVED gear: the active (gear-less) measure has
  // no abundance source to name the unit, so look the gear up across all
  // measures' sources (the abundance measure carries per-gear units).
  const scatterScopedUnit = useMemo(() => {
    if (!scatterPlotGear) return null;
    for (const m of measures) {
      const src = m.sources.find(s => s.gear === scatterPlotGear && s.unit && s.expression === 'catch-per-unit');
      if (src) return src.unit ?? null;
    }
    return null;
  }, [scatterPlotGear, measures]);

  // County selector label — mirrors the state: one selection shows the county's
  // own name (like the state name), several show "Counties (n)", none = "All".
  const countyLabel =
    filters.counties.length === 0 ? 'All'
    : filters.counties.length === 1 ? filters.counties[0]
    : `${regionWord} (${filters.counties.length})`;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Ink header: STATE selector is the title (top-left, where it's always
          been); COUNTY selector sits top-right across from it (DATA_MODEL §4 —
          the two region selectors framing the header). Tapping County opens the
          county/region picker; tapping anywhere else on the header opens the
          atlas. */}
      <Pressable
        onPress={() => setShowStatePicker(true)}
        accessibilityRole="button"
        accessibilityLabel={`Current state: ${stateCfg.label}`}
        accessibilityHint="Opens state picker">
        <PaperHeader
          title={`${stateCfg.label} ▾`}
          eyebrow={`ATLAS · ${state.toUpperCase()}`}
          right={GENERATED_STATES[state].hasCounties ? (
            <Pressable
              onPress={() => options && setShowCountyPicker(true)}
              disabled={!options}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${regionWord}: ${countyLabel}`}
              accessibilityHint={`Opens the ${regionWord.toLowerCase()} picker`}
              style={[{ alignItems: 'flex-end' }, !options && { opacity: 0.55 }]}>
              {/* Invisible spacer mirrors the state's eyebrow line so the county
                  name sits on the same baseline as the state name. */}
              <Text style={[text.labelS, { opacity: 0 }]} numberOfLines={1}> </Text>
              <Text
                style={[text.displayL, { color: filters.counties.length > 0 ? colors.walleye : colors.paper, textAlign: 'right', marginTop: 2 }]}
                numberOfLines={1}>
                {countyLabel} ▾
              </Text>
            </Pressable>
          ) : undefined}
        />
      </Pressable>

      {/* State stripe */}
      <View style={[styles.stripe, { backgroundColor: STATE_STRIPES[state] ?? colors.lake3 }]} />

      {/* Species selector — disabled while options load or if load failed */}
      <Pressable
        onPress={() => options && setShowSpeciesPicker(true)}
        disabled={!options}
        accessibilityRole="button"
        accessibilityLabel={`Species: ${speciesLabel}`}
        accessibilityHint="Opens species picker"
        style={[styles.speciesBtn, !options && { opacity: 0.55 }]}
      >
        <Text style={[
          text.displayM,
          { color: filters.species ? colors.ink : colors.inkSoft },
        ]} numberOfLines={1}>
          {loadingOptions && !options ? 'Loading…'
            : !options && error ? 'Couldn’t load species'
            : speciesLabel}
        </Text>
        {loadingOptions && !options
          ? <ActivityIndicator size="small" color={colors.inkSoft} />
          : <Text style={{ color: colors.inkSoft, fontSize: 18 }}>›</Text>}
      </Pressable>

      {/* Lake name + Search */}
      <View style={styles.lakeRow}>
        <TextInput
          style={styles.lakeInput}
          placeholder="Lake name…"
          placeholderTextColor={colors.inkSoft}
          value={filters.lakeName}
          onChangeText={v => setFilters(prev => ({ ...prev, lakeName: v }))}
          onSubmitEditing={() => handleSearch(0)}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="words"
          spellCheck={false}
        />
        <PrimaryButton onPress={() => handleSearch(0)}>
          {loading && page === 0 ? '…' : 'Search'}
        </PrimaryButton>
      </View>

      {/* Filter chips row — Filters disabled until options load. (County moved
          to the scope row at the top per DATA_MODEL §4.) */}
      <View style={styles.filterRow}>
        <Chip
          dot={!!hasFilters}
          disabled={!options}
          onPress={() => options && setShowAdvanced(true)}
        >
          Filters
        </Chip>
        <View style={styles.toggleWrap}>
          <Text style={[text.labelM, { color: colors.inkSoft, marginRight: 6 }]}>Latest Only</Text>
          <Pressable
            onPress={() => setShowAbout(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="About Latest Only filter"
            style={styles.toggleInfo}>
            <Text style={[text.labelM, { color: colors.inkSoft }]}>ⓘ</Text>
          </Pressable>
          <Toggle
            value={filters.mostRecentOnly}
            accessibilityLabel="Latest survey only"
            onValueChange={v => {
              const updated = { ...filters, mostRecentOnly: v };
              setFilters(updated);
              if (updated.species) handleSearch(0, updated);
            }}
          />
        </View>
      </View>

      {/* Reset / info row */}
      <View style={styles.subRow}>
        {(searched || hasFilters || filters.species || filters.lakeName) ? (
          <Pressable onPress={handleReset} hitSlop={6}>
            <Text style={[text.labelM, { color: colors.destructive }]}>Reset</Text>
          </Pressable>
        ) : <View />}
        <Pressable onPress={() => setShowAbout(true)} hitSlop={6}>
          <Text style={[text.labelM, { color: colors.inkSoft }]}>ⓘ About &amp; Glossary</Text>
        </Pressable>
      </View>

      {/* Offline-cache banner: results below are the last saved search. */}
      {offlineCacheDate != null && (
        <View style={styles.previewBanner}>
          <Text style={[text.labelM, { color: colors.paper, flex: 1 }]} numberOfLines={2}>
            Offline — showing results saved {new Date(offlineCacheDate).toLocaleDateString()}
          </Text>
          <Pressable
            onPress={() => handleSearch(0)}
            accessibilityRole="button"
            accessibilityLabel="Retry search"
            style={styles.unlockBtn}>
            <Text style={[text.labelM, { color: colors.ink }]}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Data-not-ready banner (IMPROVEMENT_PLAN 1.14): previously fetched
          and silently swallowed — a not-ready DB looked like a broken
          species button with no explanation. */}
      {dbStatus && !dbStatus.ready && (
        <View style={styles.previewBanner}>
          <Text style={[text.labelM, { color: colors.paper, flex: 1 }]} numberOfLines={2}>
            {stateCfg.label}’s data is being refreshed — search is briefly unavailable.
          </Text>
          <Pressable
            onPress={() => loadStateOptions(state)}
            accessibilityRole="button"
            accessibilityLabel="Retry loading state data"
            style={styles.unlockBtn}>
            <Text style={[text.labelM, { color: colors.ink }]}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Preview banner — paid state, no subscription. Explains the blurred
          names and offers the unlock path. */}
      {preview && (
        <View style={styles.previewBanner}>
          <LockIcon size={10} color={colors.paper} />
          <Text style={[text.labelM, { color: colors.paper, flex: 1 }]} numberOfLines={2}>
            Preview — all data shown, lake names &amp; locations hidden
          </Text>
          <Pressable
            onPress={() => setPaywallFor(state)}
            accessibilityRole="button"
            accessibilityLabel="Unlock lake names with the All-States subscription"
            style={styles.unlockBtn}>
            <Text style={[text.labelM, { color: colors.ink }]}>Unlock</Text>
          </Pressable>
        </View>
      )}

      <AboutScreen visible={showAbout} state={state} onClose={() => setShowAbout(false)} />

      {/* Subscription gate: shown when a paid-state API call returns 402. */}
      <PaywallScreen
        visible={paywallTriggered !== null}
        triggeredFrom={paywallTriggered ? STATE_CONFIGS[paywallTriggered].label : undefined}
        onClose={() => {
          // Just close — let the user back out without yanking their state.
          // The 402 already cleared the results; the speciesBtn shows an
          // error chip until they pick a different state or subscribe.
          setPaywallTriggered(null);
        }}
        onPurchased={() => {
          setPaywallTriggered(null);
          // Entitlement state will refresh via useEntitlement / RC listener;
          // re-load filters/results for the current state.
          loadStateOptions(state);
        }}
      />

      {/* Error — retry is smart: re-fetch options if they're missing,
          otherwise re-run the last search. */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={[text.bodyS, { color: colors.paper, flex: 1 }]} numberOfLines={3}>{error}</Text>
          <Pressable
            onPress={() => {
              setError(null);
              if (!options) loadStateOptions(state);
              else if (searched) handleSearch(0);
            }}
            style={styles.retryButton}
          >
            <Text style={[text.labelM, { color: colors.ink }]}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Empty state */}
      {!searched && !error && (
        <View style={styles.emptyState}>
          <Text style={[text.editorialM, { color: colors.inkSoft, textAlign: 'center' }]}>
            Select a species or enter a lake name to begin.
          </Text>
        </View>
      )}

      {/* Results header. In scatter view with a DERIVED gear scope the count
          reflects the scoped rows actually plotted — the owner's 2026-08-11
          report flagged "9 dots / 33 RESULTS" as incoherent; the list total
          returns the moment the user flips back to list view. */}
      {searched && (
        <View style={styles.resultsHeader}>
          <Text style={[text.labelL, { color: colors.inkSoft, flexShrink: 1 }]} numberOfLines={1}>
            {viewMode === 'scatter' && scatterPlotGear != null
              ? `${scatterPlotRows.length.toLocaleString()} ${scatterPlotRows.length === 1 ? 'RESULT' : 'RESULTS'}`
              : `${total.toLocaleString()} ${total === 1 ? 'RESULT' : 'RESULTS'}`}
          </Text>
          <View style={styles.viewToggle}>
            {/* Scatter is ONLY EVER abundance (Y) vs size (X), colored by
                stocking density — so it requires BOTH an abundance signal
                (CPUE or forecast rating) AND a size metric (length, or weight
                for MN). A state with abundance but no size (e.g. OK) gets no
                Scatter toggle — otherwise the plot had nothing for its X axis
                and silently fell back to survey year. */}
            {((GENERATED_STATES[state].hasCpue || GENERATED_STATES[state].hasRating) &&
              (GENERATED_STATES[state].hasLength || GENERATED_STATES[state].hasWeight)) && (
              <Segmented
                options={['List', 'Scatter']}
                active={viewMode2}
                onChange={i => setViewMode(i === 0 ? 'list' : 'scatter')}
              />
            )}
            {/* Gear/Source is NOT a separate control (2026-07-21 owner feedback):
                it's filtered through the existing FILTERS button, same as it
                always was. The measure's default gear applies automatically. */}
            {/* Measure — the primary control, labelled by measure. Shown in
                scatter view too: the scatter only plots Abundance vs Size, so a
                user who left the measure on Presence/Stocking (nothing to plot)
                needs the picker right here to switch back to Abundance rather
                than being forced back to the list first. */}
            {useMeasurePicker && (
              <Pressable
                onPress={() => setShowMeasure(true)}
                accessibilityRole="button"
                accessibilityLabel={`Measure: ${activeMeasure?.label ?? sortLabel}${activeMeasure && activeMeasure.id !== 'presence' ? `, ${filters.sortDir === 'desc' ? 'descending' : 'ascending'}` : ''}`}
                accessibilityHint="Opens the measure picker (abundance, size, stocking, presence)"
                style={styles.sortBtn}>
                <Text style={[text.labelM, { color: colors.ink }]} numberOfLines={1}>
                  {activeMeasure?.label ?? sortLabel}{activeMeasure && activeMeasure.id !== 'presence' ? ` ${filters.sortDir === 'desc' ? '↓' : '↑'}` : ''}
                </Text>
              </Pressable>
            )}
            {viewMode === 'list' && !useMeasurePicker && (
              <Pressable
                onPress={() => setShowSort(true)}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${sortLabel}, ${filters.sortDir === 'desc' ? 'descending' : 'ascending'}`}
                accessibilityHint="Opens sort picker"
                style={styles.sortBtn}>
                <Text style={[text.labelM, { color: colors.ink }]} numberOfLines={1}>
                  {sortLabel} {filters.sortDir === 'desc' ? '↓' : '↑'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* List view */}
      {searched && viewMode === 'list' && (
        <FlatList
          data={results}
          keyExtractor={(item, i) => `${item.lake_id}-${item.survey_id}-${i}`}
          renderItem={({ item }) => (
            <ResultRow
              result={item}
              state={state}
              sortBy={filters.sortBy}
              showSpecies={!filters.species}
              onPress={() => {
                // Preview users get the full detail screen too — the server
                // serves /lake/:id with identity fields redacted (2026-07-15).
                // species: the ROW's species, never the filter's — with All
                // Species the filter is empty and the detail used to open on
                // the lake's most-recorded species regardless of which row
                // was tapped (2026-07-17).
                navigation.navigate('LakeDetail', {
                  lakeId: item.lake_id,
                  lakeName: item.lake_name ?? '',
                  species: item.species ?? filters.species,
                  state,
                });
              }}
            />
          )}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loading && page > 0 ? () => <ActivityIndicator style={{ padding: 16 }} color={colors.ink} /> : null
          }
          // Zero results used to be "0 RESULTS" over blank space (D7): say
          // which filters are active and give one-tap loosening actions.
          ListEmptyComponent={!loading ? (
            <View style={styles.emptyResults}>
              <Text style={[text.editorialS, { color: colors.inkSoft, textAlign: 'center' }]}>
                No lakes match this search
              </Text>
              <Text style={[text.bodyS, { color: colors.inkSoft, textAlign: 'center', marginTop: 6 }]}>
                {[
                  filters.species ? `${speciesDisplayName(filters.species, state)}` : null,
                  filters.counties.length ? `${filters.counties.length} ${filters.counties.length === 1 ? 'county' : 'counties'}` : null,
                  filters.lakeName ? `name “${filters.lakeName}”` : null,
                  filters.mostRecentOnly ? 'latest surveys only' : null,
                ].filter(Boolean).join(' · ') || 'no filters set'}
              </Text>
              <View style={styles.emptyActions}>
                {filters.counties.length > 0 && (
                  <Pressable style={styles.emptyActionBtn}
                    onPress={() => { const f = { counties: [] as string[] }; setFilters(prev => ({ ...prev, ...f })); persistCountySelection(state, []); handleSearch(0, f); }}
                    accessibilityRole="button">
                    <Text style={[text.labelM, { color: colors.ink }]}>Search statewide</Text>
                  </Pressable>
                )}
                {!!filters.lakeName && (
                  <Pressable style={styles.emptyActionBtn}
                    onPress={() => { const f = { lakeName: '' }; setFilters(prev => ({ ...prev, ...f })); if (filters.species) handleSearch(0, f); }}
                    accessibilityRole="button">
                    <Text style={[text.labelM, { color: colors.ink }]}>Clear lake name</Text>
                  </Pressable>
                )}
                {filters.mostRecentOnly && (
                  <Pressable style={styles.emptyActionBtn}
                    onPress={() => { const f = { mostRecentOnly: false }; setFilters(prev => ({ ...prev, ...f })); handleSearch(0, f); }}
                    accessibilityRole="button">
                    <Text style={[text.labelM, { color: colors.ink }]}>Include older surveys</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : null}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          style={{ backgroundColor: colors.paper }}
        />
      )}

      {/* Scatter view */}
      {searched && viewMode === 'scatter' && (
        <ScatterPlot
          results={scatterPlotRows}
          state={state}
          activeMeasure={activeMeasure}
          activeSourceId={activeSourceId}
          scopedGear={scatterPlotGear}
          scopedUnit={scatterScopedUnit}
          onLakePress={(lakeId, lakeName, species) => {
            // Same row-species rule as the list (the dot CARD shows a
            // species; the tap must honor it).
            navigation.navigate('LakeDetail', {
              lakeId, lakeName, species: species ?? filters.species, state,
            });
          }}
        />
      )}

      {/* Measure picker — the primary control (DATA_MODEL). Selecting a measure
          adopts its default Gear/Source (most records) and sets the sort; the
          Gear Type filter in the Filters modal refines it. Presence has no
          ranking so an incompatible sort can't linger — fixes the MB "Presence
          Only still offers Catch Rate" bug. */}
      <MeasurePickerModal
        visible={showMeasure}
        measures={measures}
        activeMeasureId={activeMeasureId}
        sortDir={filters.sortDir}
        onClose={() => setShowMeasure(false)}
        onChange={(measure, sortDir) => {
          // Keep the current source if this measure still has it, else default.
          const source = pickSource(measure, activeSourceId);
          setActiveMeasureId(measure.id);
          setActiveSourceId(source?.id ?? null);
          const updated = applyMeasureSource(measure, source, filters, sortDir);
          setFilters(updated);
          if (updated.species || updated.lakeName) handleSearch(0, updated);
        }}
      />

      {/* Sort picker (legacy fallback when /measures is unavailable) */}
      <SortPickerModal
        visible={showSort}
        state={state}
        sortBy={filters.sortBy}
        sortDir={filters.sortDir}
        gear={singleGear}
        onClose={() => setShowSort(false)}
        onChange={(sortBy, sortDir) => {
          const updated = { ...filters, sortBy, sortDir };
          setFilters(updated);
          handleSearch(0, updated);
        }}
      />

      {/* Species picker */}
      {options && (
        <SpeciesPicker
          visible={showSpeciesPicker}
          species={options.species}
          selected={filters.species}
          state={state}
          onSelect={handleSpeciesSelect}
          onClose={() => setShowSpeciesPicker(false)}
        />
      )}

      {/* County map picker */}
      <CountyMapPicker
        visible={showCountyPicker}
        state={state}
        selected={filters.counties}
        countyOptions={options?.counties}
        onConfirm={counties => {
          const updated = { ...filters, counties };
          setFilters(updated);
          // Persist this state's selection so it survives cold launches.
          // Empty array is a meaningful preference ("all counties"); persist
          // it too rather than treating empty as "no preference."
          persistCountySelection(state, counties);
          // Refresh species lake_counts + gear counts for the new county
          // scope, and re-default the gear to the most common CPUE-bearing
          // gear for this area+species. If the default changed and a search
          // is showing, re-run it so results match the new gear.
          fetchFilters(state, filters.species || undefined, counties)
            .then(async opts => {
              setOptions(opts);
              const gear = defaultGearFor(opts);
              // Re-resolve measures for the new county scope, keeping the same
              // measure + source if they still have data (else cascade default).
              const withGear = { ...updated, gearTypes: gear };
              const withMeasure = await loadMeasuresFor(
                filters.species, counties, withGear, activeMeasureId, activeSourceId);
              // Nothing meaningful changed → don't churn a re-search.
              if (JSON.stringify({ g: withMeasure.gearTypes, s: withMeasure.sortBy, k: withMeasure.cpueKind, sf: withMeasure.stockingFirst, p: withMeasure.presenceUnion })
                === JSON.stringify({ g: updated.gearTypes, s: updated.sortBy, k: updated.cpueKind, sf: updated.stockingFirst, p: updated.presenceUnion })) {
                return;
              }
              setFilters(withMeasure);
              if (withMeasure.species) handleSearch(0, withMeasure);
            })
            .catch(() => {});
          if (updated.species) handleSearch(0, updated);
          // First-run flow (D2): without a species the guided path used to
          // END here on an empty screen ("Select a species to begin") after
          // 2-3 choices with zero fish shown. Chain straight into the species
          // picker so the next required step presents itself.
          else setShowSpeciesPicker(true);
        }}
        onClose={() => setShowCountyPicker(false)}
      />

      {/* Advanced filters */}
      <AdvancedFiltersModal
        visible={showAdvanced}
        filters={filters}
        state={state}
        options={options}
        onChange={updates => {
          // Manually choosing a gear in advanced filters IS choosing a gear
          // Source: clear the relative/stocking/presence scope so /results
          // doesn't AND an incompatible cpueKind/stockingFirst/presenceUnion into
          // an empty set, and sync the toolbar Source to the matching gear.
          setFilters(prev => {
            const next = { ...prev, ...updates };
            if (updates.gearTypes) { next.cpueKind = ''; next.stockingFirst = false; next.presenceUnion = false; }
            return next;
          });
          if (updates.gearTypes) {
            // Map to a single Source only when EXACTLY one gear is selected. The
            // user may manually pick several gears; with 0 or >1 there is no one
            // source, so clear activeSourceId and let the toolbar/scatter fall
            // back to a neutral (measure) label instead of claiming one gear.
            const g = updates.gearTypes.length === 1 ? updates.gearTypes[0] : null;
            const match = g && activeMeasure
              ? activeMeasure.sources.find(s => s.gear === g)
              : null;
            setActiveSourceId(match ? match.id : null);
          }
        }}
        onClose={() => setShowAdvanced(false)}
        onApply={() => { setShowAdvanced(false); handleSearch(0); }}
      />

      {/* State picker */}
      <StatePickerModal
        visible={showStatePicker}
        hasAllStates={hasAllStates}
        selected={state}
        onSelect={s => { setState(s); setShowStatePicker(false); }}
        onClose={() => setShowStatePicker(false)}
      />

      {/* Paywall — opens from the preview banner or a lake-detail tap while
          previewing a paid state. */}
      <PaywallScreen
        visible={paywallFor != null}
        triggeredFrom={paywallFor ?? undefined}
        onClose={() => setPaywallFor(null)}
        onPurchased={() => {
          const target = paywallFor;
          setPaywallFor(null);
          // Every cached session was fetched in preview mode (redacted
          // names) — drop them all so each state re-fetches unredacted.
          sessionCache.current = {};
          if (target && target !== state) {
            setState(target);
            return;
          }
          // Same state: re-run the current search so blurred rows are
          // replaced with real names. PaywallScreen primes the server's
          // entitlement cache before onPurchased fires, so this fetch
          // already sees the subscription.
          loadStateOptions(state);
          if (searched) handleSearch(0);
        }}
      />
    </SafeAreaView>
  );
}

// Modal/helper components live in ./search/ — extracted for clarity.

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },

  stripe: { height: 3 },

  emptyResults: {
    paddingHorizontal: space.xl,
    paddingVertical: 40,
  },
  emptyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.md,
    marginTop: space.lg,
  },
  emptyActionBtn: {
    borderWidth: hairline,
    borderColor: colors.ink,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
  },

  speciesBtn: {
    borderWidth: hairline,
    borderColor: colors.ink,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    marginHorizontal: space.xl,
    marginTop: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.paper2,
  },

  lakeRow: {
    flexDirection: 'row',
    gap: space.md,
    marginHorizontal: space.xl,
    marginTop: space.md,
  },
  lakeInput: {
    flex: 1,
    borderWidth: hairline,
    borderColor: colors.paper3,
    backgroundColor: colors.paper2,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    color: colors.ink,
    ...text.dataS,
  },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.xl,
    marginTop: space.lg,
  },
  toggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  toggleInfo: {
    marginRight: 6,
    paddingHorizontal: 2,
  },

  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },

  previewBanner: {
    backgroundColor: colors.ink,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    marginHorizontal: space.xl,
    marginTop: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  unlockBtn: {
    backgroundColor: colors.walleye,
    paddingHorizontal: space.lg,
    paddingVertical: 5,
  },

  errorBanner: {
    backgroundColor: colors.rust,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    margin: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  retryButton: {
    backgroundColor: colors.paper,
    paddingHorizontal: space.lg,
    paddingVertical: 6,
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xxxl,
  },

  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    backgroundColor: colors.paper2,
    borderTopWidth: hairline,
    borderBottomWidth: hairline,
    borderTopColor: colors.paper3,
    borderBottomColor: colors.paper3,
  },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  sortBtn: {
    borderWidth: hairline,
    borderColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

});
