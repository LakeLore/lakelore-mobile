import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList,
  ActivityIndicator, StyleSheet, SafeAreaView, Modal,
  ScrollView, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppState } from '../StateContext';
import {
  FilterState, FilterOptions, Result, ResultsResponse, StateKey,
  defaultFilters, STATE_CONFIGS, SD_SPECIES_NAMES, MN_SPECIES_NAMES, ND_SPECIES_NAMES, WI_SPECIES_NAMES,
  WI_GEAR_LABELS,
} from '../types';
import { fetchFilters, fetchResults, fetchAllResults, DbStatus, fetchStatus } from '../api';
import ResultRow from '../components/ResultRow';
import SpeciesPicker from '../components/SpeciesPicker';
import CountyMapPicker from '../components/CountyMapPicker';
import ScatterPlot from '../components/ScatterPlot';
import type { RootStackParamList } from '../navigation';
import {
  colors, text, space, hairline,
} from '../lakelore-rn/theme';
import {
  PaperHeader, Chip, Toggle, Segmented, PrimaryButton, SectionLabel,
} from '../lakelore-rn/components';

const PAGE_SIZE = 50;

const STATE_STRIPES: Record<StateKey, string> = {
  sd: colors.lakeInk,
  mn: '#2a4a3a',
  nd: colors.rust,
  ia: colors.moss,
  ne: '#a04030',
  wi: colors.lake3,
  mi: colors.lakeInk,
};

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
  const { state, stateConfig, setState } = useAppState();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [filters, setFilters] = useState<FilterState>(() => defaultFilters(state));
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
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
  const [showInfo, setShowInfo] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [stateLakeCounts, setStateLakeCounts] = useState<Partial<Record<StateKey, number>>>({});

  const prevStateRef = useRef(state);
  const sessionCache = useRef<Partial<Record<StateKey, SearchSession>>>({});

  useEffect(() => {
    (['sd', 'mn', 'nd', 'ia', 'ne', 'wi', 'mi'] as const).forEach(s =>
      fetchStatus(s).then(st => {
        if (st.ready && st.lakes != null)
          setStateLakeCounts(prev => ({ ...prev, [s]: st.lakes }));
      }).catch(() => {})
    );
  }, []);

  useEffect(() => { setShowCountyPicker(true); }, []);

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
        setFilters(defaultFilters(state));
        setResults([]);
        setScatterResults([]);
        setTotal(0);
        setPage(0);
        setSearched(false);
        setViewMode('list');
        setShowCountyPicker(true);
      }
      setOptions(null);
    }
    setError(null);
    setDbStatus(null);

    fetchStatus(state)
      .then(s => {
        setDbStatus(s);
        if (s.ready) return fetchFilters(state).then(opts => {
          setOptions(opts);
          if (opts.gearTypes.length > 0) {
            setFilters(prev => {
              const valid = prev.gearTypes.filter(g => opts.gearTypes.includes(g));
              if (valid.length > 0) return prev;
              const gear = state === 'ia'
                ? (opts.defaultGear || opts.gearTypes.find(g => g === 'FN') || opts.gearTypes.find(g => g === 'HN') || opts.gearTypes[0])
                : opts.gearTypes[0];
              return { ...prev, gearTypes: [gear] };
            });
          }
        });
      })
      .catch(err => setError(err.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handleSearch = useCallback(async (nextPage = 0, overrideFilters?: Partial<FilterState>) => {
    const f = overrideFilters ? { ...filters, ...overrideFilters } : filters;
    if (!f.species && !f.lakeName) {
      Alert.alert('Search', 'Enter a species or lake name to search.');
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
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [filters, state]);

  const handleSpeciesSelect = async (species: string) => {
    // Refresh filter options so gear counts reflect this species, and reset the
    // gear filter to whichever gear has the most records for the new species.
    let nextOpts = options;
    try {
      nextOpts = await fetchFilters(state, species || undefined);
      setOptions(nextOpts);
    } catch { /* keep existing options if refetch fails */ }

    const nextGearTypes = nextOpts && nextOpts.gearTypes.length > 0
      ? [nextOpts.gearTypes[0]]
      : filters.gearTypes;

    const updated = { ...filters, species, gearTypes: nextGearTypes };
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
    if (state === 'ia' && baseOpts?.defaultGear) df.gearTypes = [baseOpts.defaultGear];
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

  const namesMap = state === 'mn' ? MN_SPECIES_NAMES : state === 'nd' ? ND_SPECIES_NAMES : state === 'wi' ? WI_SPECIES_NAMES : SD_SPECIES_NAMES;
  const speciesLabel = filters.species
    ? (state === 'ia' || state === 'ne' || state === 'mi' ? filters.species : (namesMap[filters.species] ?? filters.species))
    : 'All Species';

  const hasFilters = filters.counties.length > 0
    || filters.minCpue || filters.maxCpue
    || filters.minYear || filters.maxYear
    || filters.minAcres || filters.maxAcres
    || filters.minStocked || filters.maxStocked;

  const stateCfg = STATE_CONFIGS[state];
  const sortLabel = stateCfg.sortOptions.find(o => o.value === filters.sortBy)?.label ?? filters.sortBy;
  const viewMode2 = viewMode === 'list' ? 0 : 1;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Ink header w/ state name + lake count */}
      <Pressable onPress={() => setShowStatePicker(true)}>
        <PaperHeader
          title={`${stateCfg.label} ▾`}
          eyebrow={`ATLAS · ${state.toUpperCase()}`}
          right={dbStatus?.ready && dbStatus.lakes != null
            ? `${dbStatus.lakes.toLocaleString()} LAKES`
            : undefined}
        />
      </Pressable>

      {/* State stripe */}
      <View style={[styles.stripe, { backgroundColor: STATE_STRIPES[state] ?? colors.lake3 }]} />

      {/* Species selector */}
      <Pressable onPress={() => setShowSpeciesPicker(true)} style={styles.speciesBtn}>
        <Text style={[
          text.displayM,
          { color: filters.species ? colors.ink : colors.inkSoft },
        ]} numberOfLines={1}>
          {speciesLabel}
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 18 }}>›</Text>
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
        />
        <PrimaryButton onPress={() => handleSearch(0)}>
          {loading && page === 0 ? '…' : 'Search'}
        </PrimaryButton>
      </View>

      {/* Filter chips row */}
      <View style={styles.filterRow}>
        <Chip dot={!!hasFilters} onPress={() => setShowAdvanced(true)}>
          Filters
        </Chip>
        <Chip
          active={filters.counties.length > 0}
          onPress={() => setShowCountyPicker(true)}
        >
          {filters.counties.length > 0 ? `${filters.counties.length} Counties` : 'Counties'}
        </Chip>
        <View style={styles.toggleWrap}>
          <Text style={[text.labelM, { color: colors.inkSoft, marginRight: 6 }]}>Latest Only</Text>
          <Toggle
            value={filters.mostRecentOnly}
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
        <Pressable onPress={() => setShowInfo(true)} hitSlop={6}>
          <Text style={[text.labelM, { color: colors.inkSoft }]}>ⓘ Glossary</Text>
        </Pressable>
      </View>

      <InfoModal visible={showInfo} state={state} onClose={() => setShowInfo(false)} />

      {/* Error */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={[text.bodyS, { color: colors.paper }]}>{error}</Text>
          <Pressable onPress={() => { setError(null); handleSearch(0); }} style={styles.retryButton}>
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
            {viewMode === 'list' && total > results.length ? ` · ${results.length} SHOWN` : ''}
          </Text>
          <View style={styles.viewToggle}>
            <Segmented
              options={['List', 'Scatter']}
              active={viewMode2}
              onChange={i => setViewMode(i === 0 ? 'list' : 'scatter')}
            />
            {viewMode === 'list' && (
              <Pressable onPress={() => setShowSort(true)} style={styles.sortBtn}>
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
              onPress={() => navigation.navigate('LakeDetail', {
                lakeId: item.lake_id,
                lakeName: item.lake_name,
                species: filters.species,
                state,
              })}
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
          onLakePress={(lakeId, lakeName) => navigation.navigate('LakeDetail', {
            lakeId, lakeName, species: filters.species, state,
          })}
        />
      )}

      {/* Sort picker */}
      <SortPickerModal
        visible={showSort}
        state={state}
        sortBy={filters.sortBy}
        sortDir={filters.sortDir}
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
        onConfirm={counties => {
          const updated = { ...filters, counties };
          setFilters(updated);
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
      <Modal visible={showStatePicker} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
          <PaperHeader
            modal
            title="Select State"
            right={
              <Pressable onPress={() => setShowStatePicker(false)} hitSlop={8}>
                <Text style={[text.labelL, { color: colors.destructive }]}>Cancel</Text>
              </Pressable>
            }
          />
          <ScrollView>
            {(['sd', 'mn', 'nd', 'ia', 'ne', 'wi', 'mi'] as const).map(s => {
              const cfg = STATE_CONFIGS[s];
              return (
                <Pressable
                  key={s}
                  onPress={() => { setState(s); setShowStatePicker(false); }}
                  style={({ pressed }) => [
                    styles.stateOption,
                    { backgroundColor: pressed ? colors.paper2 : colors.paper },
                  ]}
                >
                  <View style={[styles.stripeNarrow, { backgroundColor: STATE_STRIPES[s] ?? colors.lake3 }]} />
                  <View style={styles.stateOptionBody}>
                    <View style={{ flex: 1 }}>
                      <Text style={[text.displayL, { color: colors.ink }]}>{cfg.label}</Text>
                      <Text style={[text.labelM, { color: colors.inkSoft, marginTop: 4 }]}>{cfg.agency}</Text>
                    </View>
                    {stateLakeCounts[s] != null && (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[text.dataL, { color: colors.ink }]}>
                          {stateLakeCounts[s]!.toLocaleString()}
                        </Text>
                        <Text style={[text.labelS, { color: colors.walleye2, marginTop: 2 }]}>LAKES</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sort picker ───────────────────────────────────────────────────────────────

function SortPickerModal({ visible, state, sortBy, sortDir, onClose, onChange }: {
  visible: boolean;
  state: StateKey;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onClose: () => void;
  onChange: (sortBy: string, sortDir: 'asc' | 'desc') => void;
}) {
  const cfg = STATE_CONFIGS[state];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <PaperHeader
          modal
          title="Sort By"
          right={
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[text.labelL, { color: colors.ink }]}>Done</Text>
            </Pressable>
          }
        />
        <ScrollView>
          {cfg.sortOptions.map(opt => (
            <View key={opt.value}>
              {(['desc', 'asc'] as const).map(dir => {
                const active = opt.value === sortBy && sortDir === dir;
                return (
                  <Pressable
                    key={dir}
                    style={({ pressed }) => [
                      styles.sortOption,
                      { backgroundColor: pressed ? colors.paper2 : 'transparent' },
                    ]}
                    onPress={() => { onChange(opt.value, dir); onClose(); }}
                  >
                    <Text style={[
                      text.bodyL,
                      { color: active ? colors.walleye2 : colors.ink },
                    ]}>
                      {opt.label} {dir === 'desc' ? '↓' : '↑'}
                    </Text>
                    {active && <Text style={[text.labelL, { color: colors.walleye2 }]}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Info modal ────────────────────────────────────────────────────────────────

function InfoModal({ visible, state, onClose }: { visible: boolean; state: StateKey; onClose: () => void }) {
  const isSD = state === 'sd';
  const isMN = state === 'mn';
  const isND = state === 'nd';
  const isIA = state === 'ia';
  const isNE = state === 'ne';
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <PaperHeader
          modal
          title="Glossary & Help"
          right={
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[text.labelL, { color: colors.ink }]}>Done</Text>
            </Pressable>
          }
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.xl, paddingBottom: 40 }}>
          {!isIA && (
            <InfoSection title="CPUE — Catch Per Unit Effort">
              {isSD
                ? 'Fish caught per standard sampling unit. For gill nets this is fish per net-night; for electrofishing it is fish per hour. Higher CPUE = more abundant fish population.'
                : isND
                ? 'Fish caught per net-night. Calculated as total fish caught of a species per sample divided by the number of net-nights. Higher CPUE = more abundant fish population.'
                : 'Fish caught per standard gill net set. Higher CPUE = more abundant fish population.'}
            </InfoSection>
          )}

          {isIA && (
            <InfoSection title="CPUE — Catch Per Unit Effort">
              Fish caught per gear unit. Calculated separately for each gear type:{'\n'}
              • FN CPUE: fish per fyke net{'\n'}
              • HN CPUE: fish per hoop net{'\n'}
              • EF CPUE: fish per electrofishing run{'\n'}
              Higher CPUE = more abundant fish population. The default gear filter selects whichever passive gear (FN or HN) is used more frequently in Iowa surveys.
            </InfoSection>
          )}

          {isIA && (
            <InfoSection title="Gear Types (IA)">
              • FN — Fyke Net: A mesh trap with funnel-shaped entrance wings staked along the shoreline. Set overnight or for multiple nights; effective for most species in shallow to mid-depth water.{'\n'}
              • HN — Hoop Net: A cylindrical mesh trap held open by rigid hoops and anchored on the bottom. Commonly used in rivers and reservoirs; good for catfish, buffalo, and rough fish.{'\n'}
              • EF — Electrofishing: A boat-mounted electric current temporarily stuns fish near the surface. Used in spring and fall for walleye, bass, and other nearshore species.{'\n'}
              Iowa DNR surveys often combine multiple gear types in a single Comprehensive survey visit.
            </InfoSection>
          )}

          {isIA && (
            <InfoSection title="Avg Length">
              Average length in inches for measured fish from Iowa DNR individual fish measurement records. Min/max also available where data exists.
            </InfoSection>
          )}

          {isSD && (
            <InfoSection title="PSD — Proportional Size Distribution">
              Percentage of stock-length fish that are at or above quality size. Ranges 0–100; higher = better size structure (more large fish).{'\n'}
              • PSD-Q (default): stock → quality size{'\n'}
              • PSD-P: stock → preferred size (larger, trophy-potential fish)
            </InfoSection>
          )}

          {isSD && (
            <InfoSection title="Wr — Relative Weight">
              Actual weight compared to the expected weight for a fish of that length. Wr = 100 means average condition; above 100 means well-fed, healthy fish.
            </InfoSection>
          )}

          <InfoSection title="Est. adults / 100ac (Stocking History overlay)">
            Estimated adult fish per 100 acres from stocking records only — does not account for natural reproduction. Survival is compounded year-by-year through each life stage:{'\n'}
            • Fry yr 1 (fry→fingerling): 3%{'\n'}
            • Fry/fingerling yr 2 (fingerling→yearling): 30%{'\n'}
            • Fingerling/yearling yr 3 (yearling→adult): 45%{'\n'}
            • Each adult year thereafter: 45%{'\n'}
            Example: 100,000 fry → 3,000 fingerlings → 900 yearlings → 405 catchable adults in yr 3.{'\n'}
            Note: does not model density-dependent mortality or natural reproduction.
          </InfoSection>

          <InfoSection title="Latest Survey Only">
            When enabled, only the most recent survey record per lake is shown. Disable to see all historical survey records.
          </InfoSection>

          {isSD && (
            <InfoSection title="Gear Types (SD)">
              • AFS Std Gill Net: Multi-mesh overnight gill net; the SD GFP standard for most open-water species.{'\n'}
              • Trap Net: Mesh trap set at the shoreline; used for panfish and rough fish.{'\n'}
              • Electrofishing: Electric current temporarily stuns fish; used for bass, pike, and walleye in shallow water.{'\n'}
              • Seine: Encircling net dragged through the water; used for small or schooling fish.
            </InfoSection>
          )}

          {isMN && (
            <InfoSection title="Gear Types (MN)">
              • Standard Gill Net: Multi-mesh overnight gill net following MN DNR protocol; primary gear for most open-water species.{'\n'}
              • Trap Net: Mesh trap set at the shoreline; used for panfish, carp, and rough fish.{'\n'}
              • Electrofishing: Electric current temporarily stuns fish; used for bass, pike, and walleye in shallow water.{'\n'}
              • Seine: Encircling net dragged through the water; used for small or schooling fish.
            </InfoSection>
          )}

          {isMN && (
            <InfoSection title="Survey Types (MN)">
              • Standard Survey: Full population assessment conducted on a rotating basin schedule.{'\n'}
              • Special Assessment: Targeted survey addressing a specific management question.{'\n'}
              • Targeted Survey: Survey focused on a single species or issue.{'\n'}
              • Population Assessment: Comprehensive multi-species evaluation.
            </InfoSection>
          )}

          {isND && (
            <InfoSection title="Avg Length">
              Average length of fish caught in each sample, converted from millimeters to inches. Only fish with recorded lengths are included in the average.
            </InfoSection>
          )}

          {isND && (
            <InfoSection title="Gear Types (ND)">
              Gear types shown are those used in ND GF&P standardized netting surveys. The most common is monofilament multi-mesh gill nets set overnight (net-nights).
            </InfoSection>
          )}

          {isNE && (
            <InfoSection title="CPUE — Catch Per Unit Effort">
              Fish caught per standard gill net set. Higher CPUE = more abundant fish population. Nebraska Game & Parks uses standardized overnight gill nets for most open-water species assessments.
            </InfoSection>
          )}

          {isNE && (
            <InfoSection title="Avg Length">
              Average length in inches for fish sampled during Nebraska Game & Parks standardized netting surveys.
            </InfoSection>
          )}

          {isNE && (
            <InfoSection title="Gear Types (NE)">
              • Gill Net: Multi-mesh monofilament overnight gill net; the NE Game & Parks standard for walleye, pike, and perch assessments.{'\n'}
              • Trap Net: Mesh trap set at the shoreline; used for panfish and rough fish.{'\n'}
              • Electrofishing: Electric current temporarily stuns fish; used for bass, pike, and walleye in shallow water.
            </InfoSection>
          )}

          <InfoSection title={isSD ? 'Data Source (SD)' : isND ? 'Data Source (ND)' : isIA ? 'Data Source (IA)' : isNE ? 'Data Source (NE)' : 'Data Source (MN)'}>
            {isSD
              ? 'Netting survey data is sourced from the South Dakota Game, Fish & Parks (SD GFP) fisheries survey database. Stocking records are from SD GFP stocking reports. Survey PDFs are linked directly from the SD GFP online report portal.'
              : isND
              ? 'Fish catch data is sourced from the North Dakota Game, Fish & Parks (ND GF&P) public ArcGIS fisheries database. Each record represents individual fish caught during standardized netting surveys. CPUE is aggregated per sample event and species.'
              : isIA
              ? 'Fish survey data is sourced from the Iowa DNR Fisheries Data Dashboard (Power BI). Species counts include measured and batch-counted fish from comprehensive surveys. Stocking records are from the Iowa DNR Lake Management Portal.'
              : isNE
              ? 'Fish survey data is sourced from Nebraska Game & Parks Commission standardized netting surveys. Survey reports are linked as PDFs directly from Nebraska Game & Parks records. Stocking data is from Nebraska Game & Parks Commission stocking reports.'
              : 'Netting survey data is sourced from the Minnesota Department of Natural Resources (MN DNR) LakeFinder fisheries database, which compiles standardized survey results collected by MN DNR fisheries staff. Lake pages link directly to the MN DNR LakeFinder profile.'}
          </InfoSection>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.infoSection}>
      <SectionLabel>{title}</SectionLabel>
      <Text style={[text.bodyM, { color: colors.ink2, marginTop: 6 }]}>{children}</Text>
    </View>
  );
}

// ── Multi-chip select (gear / survey type) ────────────────────────────────────

function MultiChipSelect({ label, options, selected, onToggle, counts, showMoreThreshold, labels }: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  counts?: Record<string, number>;
  showMoreThreshold?: number;
  labels?: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!options.length) return null;

  const primary = showMoreThreshold !== undefined
    ? options.filter(o => (counts?.[o] ?? 0) >= showMoreThreshold)
    : options;
  const secondary = showMoreThreshold !== undefined
    ? options.filter(o => (counts?.[o] ?? 0) < showMoreThreshold)
    : [];

  const visible = expanded
    ? options
    : [...primary, ...secondary.filter(o => selected.includes(o))];

  return (
    <View style={styles.rangeField}>
      <SectionLabel>{label}</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {visible.map(opt => {
          const active = selected.includes(opt);
          const count = counts?.[opt];
          const display = labels?.[opt] ?? opt;
          return (
            <Chip key={opt} active={active} onPress={() => onToggle(opt)}>
              {display}{count !== undefined ? ` (${count.toLocaleString()})` : ''}
            </Chip>
          );
        })}
      </View>
      {secondary.length > 0 && (
        <Pressable onPress={() => setExpanded(e => !e)} style={{ marginTop: 8 }}>
          <Text style={[text.labelM, { color: colors.walleye2 }]}>
            {expanded ? 'Show fewer net types' : `Show ${secondary.length} more net types…`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Advanced filters ──────────────────────────────────────────────────────────

function AdvancedFiltersModal({ visible, filters, state, options, onChange, onClose, onApply }: {
  visible: boolean;
  filters: FilterState;
  state: string;
  options: FilterOptions | null;
  onChange: (u: Partial<FilterState>) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const toggleGear = (gear: string) => {
    const next = filters.gearTypes.includes(gear)
      ? filters.gearTypes.filter(g => g !== gear)
      : [...filters.gearTypes, gear];
    onChange({ gearTypes: next });
  };

  const toggleSurveyType = (st: string) => {
    const next = filters.surveyTypes.includes(st)
      ? filters.surveyTypes.filter(s => s !== st)
      : [...filters.surveyTypes, st];
    onChange({ surveyTypes: next });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <PaperHeader
          modal
          title="Advanced Filters"
          onBack={onClose}
          backLabel="Cancel"
          right={
            <Pressable onPress={onApply} hitSlop={8}>
              <Text style={[text.labelL, { color: colors.walleye2 }]}>Apply</Text>
            </Pressable>
          }
        />
        <ScrollView style={{ padding: space.xl }} keyboardShouldPersistTaps="handled">
          {(state === 'sd' || state === 'nd' || state === 'ia' || state === 'ne' || state === 'wi' || state === 'mi') && options?.gearTypes?.length && options.gearTypes.length > 1 ? (
            <MultiChipSelect
              label="Gear Type"
              options={options.gearTypes}
              selected={filters.gearTypes}
              onToggle={toggleGear}
              counts={options.gearTypeCounts}
              showMoreThreshold={state === 'sd' ? 50 : undefined}
              labels={state === 'wi' ? WI_GEAR_LABELS : undefined}
            />
          ) : null}
          {state === 'mn' && options?.surveyTypes?.length ? (
            <MultiChipSelect
              label="Survey Type"
              options={options.surveyTypes}
              selected={filters.surveyTypes}
              onToggle={toggleSurveyType}
            />
          ) : null}
          {state === 'mn' && options?.gearTypes?.length ? (
            <MultiChipSelect
              label="Gear Type"
              options={options.gearTypes}
              selected={filters.gearTypes}
              onToggle={toggleGear}
              counts={options.gearTypeCounts}
              showMoreThreshold={100}
            />
          ) : null}
          {state !== 'ia' && (
            <RangeField label="CPUE" minVal={filters.minCpue} maxVal={filters.maxCpue}
              onMinChange={v => onChange({ minCpue: v })} onMaxChange={v => onChange({ maxCpue: v })} />
          )}
          <RangeField label="Survey Year" minVal={filters.minYear} maxVal={filters.maxYear}
            onMinChange={v => onChange({ minYear: v })} onMaxChange={v => onChange({ maxYear: v })}
            keyboardType="number-pad"
            placeholder={options ? `${options.yearRange.min}–${options.yearRange.max}` : ''} />
          <RangeField label="Lake Size (acres)" minVal={filters.minAcres} maxVal={filters.maxAcres}
            onMinChange={v => onChange({ minAcres: v })} onMaxChange={v => onChange({ maxAcres: v })} />
          <RangeField label="Stocked / 100ac" minVal={filters.minStocked} maxVal={filters.maxStocked}
            onMinChange={v => onChange({ minStocked: v })} onMaxChange={v => onChange({ maxStocked: v })} />
          {state === 'mn' && (
            <>
              <RangeField label="Avg Weight (lb)" minVal={filters.minWeight} maxVal={filters.maxWeight}
                onMinChange={v => onChange({ minWeight: v })} onMaxChange={v => onChange({ maxWeight: v })} />
              <RangeField label="Total Catch" minVal={filters.minCatch} maxVal={filters.maxCatch}
                onMinChange={v => onChange({ minCatch: v })} onMaxChange={v => onChange({ maxCatch: v })} />
              <RangeField label="# Gear Sets" minVal={filters.minGearCount} maxVal={filters.maxGearCount}
                onMinChange={v => onChange({ minGearCount: v })} onMaxChange={v => onChange({ maxGearCount: v })}
                keyboardType="number-pad" />
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function RangeField({ label, minVal, maxVal, onMinChange, onMaxChange,
  keyboardType = 'decimal-pad', placeholder }: {
  label: string; minVal: string; maxVal: string;
  onMinChange: (v: string) => void; onMaxChange: (v: string) => void;
  keyboardType?: 'decimal-pad' | 'number-pad'; placeholder?: string;
}) {
  return (
    <View style={styles.rangeField}>
      <SectionLabel>{label}</SectionLabel>
      <View style={styles.rangeInputs}>
        <TextInput style={styles.rangeInput}
          placeholder={placeholder ? `Min (${placeholder.split('–')[0]})` : 'Min'}
          placeholderTextColor={colors.inkSoft}
          value={minVal} onChangeText={onMinChange}
          keyboardType={keyboardType} returnKeyType="done" />
        <Text style={[text.dataM, { color: colors.inkSoft }]}>–</Text>
        <TextInput style={styles.rangeInput}
          placeholder={placeholder ? `Max (${placeholder.split('–')[1]})` : 'Max'}
          placeholderTextColor={colors.inkSoft}
          value={maxVal} onChangeText={onMaxChange}
          keyboardType={keyboardType} returnKeyType="done" />
      </View>
    </View>
  );
}

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

  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
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

  stateOption: {
    flexDirection: 'row',
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },
  stripeNarrow: { width: 8 },
  stateOptionBody: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
  },

  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: 14,
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },

  rangeField: { marginBottom: space.xxl },
  rangeInputs: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  rangeInput: {
    flex: 1,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderWidth: hairline,
    borderColor: colors.paper3,
    backgroundColor: colors.paper2,
    color: colors.ink,
    ...text.dataS,
  },

  infoSection: {
    marginBottom: space.xxl,
    paddingBottom: space.xl,
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },
});
