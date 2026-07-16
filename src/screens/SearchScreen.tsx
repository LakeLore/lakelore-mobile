import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  FilterState, FilterOptions, Result, ResultsResponse, StateKey,
  defaultFilters, STATE_CONFIGS, speciesDisplayName, GENERATED_STATES, STATE_KEYS,
} from '../types';
import { isFreeState } from '../activeStates';
import { fetchFilters, fetchResults, fetchAllResults, DbStatus, fetchStatus, SubscriptionRequiredError } from '../api';
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
function defaultGearFor(opts: FilterOptions | null): string[] {
  if (!opts || opts.gearTypes.length === 0) return [];
  if (opts.defaultGear) return [opts.defaultGear];
  const cpue = opts.gearCpueCounts ?? {};
  const withCpue = opts.gearTypes.filter(g => (cpue[g] ?? 0) > 0);
  if (withCpue.length > 0) {
    return [withCpue.slice().sort((a, b) => (cpue[b] ?? 0) - (cpue[a] ?? 0))[0]];
  }
  return [];
}

interface SearchSession {
  filters: FilterState;
  results: Result[];
  scatterResults: Result[];
  total: number;
  page: number;
  searched: boolean;
  viewMode: 'list' | 'scatter';
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
    } catch (err: unknown) {
      if (err instanceof SubscriptionRequiredError) {
        setPaywallTriggered(err.state);
      } else {
        setError(err instanceof Error ? err.message : 'Search failed');
      }
    } finally {
      setLoading(false);
    }
  }, [filters, state]);

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

    // Most common CPUE-bearing gear for the new species in the current area
    // (defaultGearFor; IA's server default wins when present).
    const updated = { ...filters, species, gearTypes: defaultGearFor(nextOpts) };
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
  const viewMode2 = viewMode === 'list' ? 0 : 1;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Ink header w/ state name. Raw lake totals intentionally omitted
          here — species/county-scoped counts surface elsewhere when they're
          actually informative. */}
      <Pressable
        onPress={() => setShowStatePicker(true)}
        accessibilityRole="button"
        accessibilityLabel={`Current state: ${stateCfg.label}`}
        accessibilityHint="Opens state picker">
        <PaperHeader
          title={`${stateCfg.label} ▾`}
          eyebrow={`ATLAS · ${state.toUpperCase()}`}
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

      {/* Filter chips row — Filters + Counties disabled until options load */}
      <View style={styles.filterRow}>
        <Chip
          dot={!!hasFilters}
          disabled={!options}
          onPress={() => options && setShowAdvanced(true)}
        >
          Filters
        </Chip>
        {/* Hidden entirely for states with no county/region vocabulary
            (BC, AB). Canadian provinces filter by REGIONS (FMZs/divisions),
            so the chip says so. */}
        {GENERATED_STATES[state].hasCounties && (
          <Chip
            active={filters.counties.length > 0}
            disabled={!options}
            onPress={() => options && setShowCountyPicker(true)}
          >
            {filters.counties.length > 0
              ? `${filters.counties.length} ${regionWord}`
              : regionWord}
          </Chip>
        )}
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

      {/* Results header */}
      {searched && (
        <View style={styles.resultsHeader}>
          <Text style={[text.labelL, { color: colors.inkSoft, flexShrink: 1 }]} numberOfLines={1}>
            {total.toLocaleString()} {total === 1 ? 'RESULT' : 'RESULTS'}
          </Text>
          <View style={styles.viewToggle}>
            {/* Scatter plots CPUE — presence-only states have nothing to
                plot, so they stay list-only. */}
            {GENERATED_STATES[state].hasCpue && (
              <Segmented
                options={['List', 'Scatter']}
                active={viewMode2}
                onChange={i => setViewMode(i === 0 ? 'list' : 'scatter')}
              />
            )}
            {viewMode === 'list' && (
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
              onPress={() => {
                // Preview users get the full detail screen too — the server
                // serves /lake/:id with identity fields redacted (2026-07-15).
                navigation.navigate('LakeDetail', {
                  lakeId: item.lake_id,
                  lakeName: item.lake_name ?? '',
                  species: filters.species,
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
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          style={{ backgroundColor: colors.paper }}
        />
      )}

      {/* Scatter view */}
      {searched && viewMode === 'scatter' && (
        <ScatterPlot
          results={scatterResults}
          state={state}
          onLakePress={(lakeId, lakeName) => {
            navigation.navigate('LakeDetail', {
              lakeId, lakeName, species: filters.species, state,
            });
          }}
        />
      )}

      {/* Sort picker */}
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
            .then(opts => {
              setOptions(opts);
              const gear = defaultGearFor(opts);
              if (JSON.stringify(gear) === JSON.stringify(updated.gearTypes)) return;
              const withGear = { ...updated, gearTypes: gear };
              setFilters(withGear);
              if (withGear.species) handleSearch(0, withGear);
            })
            .catch(() => {});
          if (updated.species) handleSearch(0, updated);
        }}
        onClose={() => setShowCountyPicker(false)}
      />

      {/* Advanced filters */}
      <AdvancedFiltersModal
        visible={showAdvanced}
        filters={filters}
        state={state}
        options={options}
        onChange={updates => setFilters(prev => ({ ...prev, ...updates }))}
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
