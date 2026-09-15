// Advanced Filters modal — gear/survey type chips plus numeric range fields.
// State-specific blocks key off `state` so each agency's available filters
// surface the right way.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Pressable, Text, TextInput, StyleSheet,
} from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { fetchLakesIndex, LakeIndexEntry } from '../../api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FilterState, FilterOptions, WI_GEAR_LABELS, GENERATED_STATES, StateKey } from '../../types';
import { colors, text, space, hairline } from '../../lakelore-rn/theme';
import { PaperHeader, SectionLabel, Toggle } from '../../lakelore-rn/components';
import { MultiChipSelect } from './MultiChipSelect';
import { RangeSlider } from './RangeSlider';

type Props = {
  visible: boolean;
  filters: FilterState;
  state: string;
  options: FilterOptions | null;
  /** The current /measures manifest contains a trophy measure — shows the
   *  Trophy Catch Rate slider (the registry export has no trophy flag). */
  hasTrophy?: boolean;
  onChange: (u: Partial<FilterState>) => void;
  onClose: () => void;
  onApply: () => void;
};

export function AdvancedFiltersModal({
  visible, filters, state, options, hasTrophy, onChange, onClose, onApply,
}: Props) {
  // Gear/Source: the DEFAULT is always a single gear (the most-prevalent source
  // for the scope, set by the measure cascade / defaultGearFor), but the user
  // may MANUALLY select more than one at a time. Multi-select — tapping toggles
  // a gear in/out of the set. Choosing several gears (with possibly different
  // units) is the user's explicit choice; when >1 is active the toolbar and
  // scatter drop the single-source unit label (SearchScreen only syncs
  // activeSourceId when exactly one gear is selected) so nothing claims one
  // specific source.
  const toggleGear = (gear: string) => {
    const next = filters.gearTypes.includes(gear)
      ? filters.gearTypes.filter(g => g !== gear)
      : [...filters.gearTypes, gear];
    onChange({ gearTypes: next });
  };

  // Data-shape flags from the generated registry export — gate each numeric
  // range on whether this state's data actually carries the metric.
  const cfg = GENERATED_STATES[state as StateKey];

  // Lake-name typeahead (owner 2026-09-13): typing presents matching lake
  // names like the species dropdown. Backed by the public per-state lakes
  // index (names only), fetched once per state and filtered locally.
  const [lakeIndex, setLakeIndex] = useState<LakeIndexEntry[] | null>(null);
  // True while a range-slider thumb is held — the ScrollView must not scroll
  // (or steal the gesture) mid-drag.
  const [sliderActive, setSliderActive] = useState(false);
  const [pickedName, setPickedName] = useState('');
  // The modal never unmounts across a state switch — drop the previous
  // state's index or suggestions would be the wrong state's lakes
  // (bug-hunt P1-3).
  useEffect(() => { setLakeIndex(null); setPickedName(''); }, [state]);
  useEffect(() => {
    if (!visible || lakeIndex) return;
    let alive = true;
    fetchLakesIndex(state as StateKey)
      .then(lakes => { if (alive) setLakeIndex(lakes); })
      .catch(() => { /* typeahead is a nicety — typing still works without it */ });
    return () => { alive = false; };
  }, [visible, lakeIndex, state]);
  const lakeQuery = filters.lakeName.trim();
  const lakeSuggestions = useMemo(() => {
    if (!lakeIndex || lakeQuery.length < 2 || lakeQuery === pickedName) return [];
    const q = lakeQuery.toLowerCase();
    const starts: LakeIndexEntry[] = [];
    const contains: LakeIndexEntry[] = [];
    for (const l of lakeIndex) {
      const n = l.name.toLowerCase();
      if (n.startsWith(q)) starts.push(l);
      else if (n.includes(q)) contains.push(l);
      if (starts.length >= 12) break;
    }
    return [...starts, ...contains].slice(0, 12);
  }, [lakeIndex, lakeQuery, pickedName]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* Gesture handlers don't see the app-root GestureHandlerRootView from
          inside a native Modal window — the modal needs its own. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
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
        {/* automaticallyAdjustKeyboardInsets + a tall bottom pad keep a focused
            numeric field (Total Catch, ranges near the bottom) above the
            keyboard when the gear list is long; interactive dismiss lets a drag
            close the keyboard. */}
        <ScrollView
          style={{ padding: space.xl }}
          contentContainerStyle={{ paddingBottom: space.xxxl }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          scrollEnabled={!sliderActive}
          automaticallyAdjustKeyboardInsets>
          {/* Lake name + Latest Only moved here from the main screen
              (owner request 2026-09-12) — the main column is now Species /
              Rank Lakes By / View Ranking As. */}
          <View style={styles.section}>
            <SectionLabel>Lake Name</SectionLabel>
            <TextInput
              style={styles.lakeInput}
              placeholder="Search by lake name…"
              placeholderTextColor={colors.inkSoft}
              value={filters.lakeName}
              onChangeText={v => { setPickedName(''); onChange({ lakeName: v }); }}
              returnKeyType="done"
              clearButtonMode="while-editing"
              autoCorrect={false}
              autoCapitalize="words"
              spellCheck={false}
            />
            {lakeSuggestions.length > 0 && (
              <View style={styles.suggestBox}>
                {lakeSuggestions.map(l => (
                  <Pressable
                    key={`${l.id}`}
                    style={({ pressed }) => [styles.suggestRow, pressed && { backgroundColor: colors.paper2 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${l.name}${l.county ? `, ${l.county}` : ''}`}
                    onPress={() => { setPickedName(l.name); onChange({ lakeName: l.name }); }}>
                    <Text style={[text.bodyL, { color: colors.ink, flexShrink: 1 }]} numberOfLines={1}>{l.name}</Text>
                    {!!l.county && (
                      <Text style={[text.labelM, { color: colors.inkSoft, flexShrink: 0 }]}>{l.county}</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          <View style={[styles.section, styles.latestRow]}>
            <View style={{ flex: 1, paddingRight: space.lg }}>
              <SectionLabel>Latest Survey Only</SectionLabel>
              <Text style={[text.bodyS, { color: colors.inkSoft, marginTop: 2 }]}>
                Only each lake’s most recent survey for the species.
              </Text>
            </View>
            <Toggle
              value={filters.mostRecentOnly}
              accessibilityLabel="Latest survey only"
              onValueChange={v => onChange({ mostRecentOnly: v })}
            />
          </View>
          {/* Show the gear chip even when there's only one option so the
              user can see which gear is in play for the current species
              (e.g. NE Largemouth Bass is sampled by Electrofishing only —
              surfacing that here is more informative than hiding it). */}
          {/* Chip counts follow the "Latest only" toggle (2026-08-11): with it
              ON they show gearLatestCounts (lakes with a latest row for that
              gear = what the list will actually return); OFF shows all-history
              row counts. Older servers lack gearLatestCounts — falls back. */}
          {state !== 'mn' && options?.gearTypes?.length ? (
            <MultiChipSelect
              label="Gear Type"
              options={options.gearTypes}
              selected={filters.gearTypes}
              onToggle={toggleGear}
              counts={filters.mostRecentOnly && options.gearLatestCounts ? options.gearLatestCounts : options.gearTypeCounts}
              splitCounts={options.gearTypeCounts}
              showMoreThreshold={state === 'sd' ? 50 : undefined}
              labels={state === 'wi' ? WI_GEAR_LABELS : undefined}
            />
          ) : null}
          {/* MN "Survey Type" (Standard vs Targeted) removed per DATA_MODEL §4 —
              the distinction confused more than it helped. */}
          {state === 'mn' && options?.gearTypes?.length ? (
            <MultiChipSelect
              label="Gear Type"
              options={options.gearTypes}
              selected={filters.gearTypes}
              onToggle={toggleGear}
              counts={filters.mostRecentOnly && options.gearLatestCounts ? options.gearLatestCounts : options.gearTypeCounts}
              splitCounts={options.gearTypeCounts}
              showMoreThreshold={100}
            />
          ) : null}
          {/* Slider order fixed by owner 2026-09-14: Survey Year, Total
              Catch, # Gear Sets, Lake Size, Catch Rate, Avg Size, Trophy
              Catch Rate, Stocking Impact — gated per state as before. */}
          <RangeSlider onDragging={setSliderActive} label="Survey Year"
            min={options?.yearRange?.min ?? 1980} max={options?.yearRange?.max ?? new Date().getFullYear()} step={1}
            minVal={filters.minYear} maxVal={filters.maxYear}
            onMinChange={v => onChange({ minYear: v })} onMaxChange={v => onChange({ maxYear: v })} />
          {(state === 'mn' || (cfg?.hasCatch ?? false)) && (
            <RangeSlider onDragging={setSliderActive} label="Total Catch" min={0} max={1000} step={10}
              minVal={filters.minCatch} maxVal={filters.maxCatch}
              onMinChange={v => onChange({ minCatch: v })} onMaxChange={v => onChange({ maxCatch: v })} />
          )}
          {state === 'mn' && (
            <RangeSlider onDragging={setSliderActive} label="# Gear Sets" min={0} max={25} step={1}
              minVal={filters.minGearCount} maxVal={filters.maxGearCount}
              onMinChange={v => onChange({ minGearCount: v })} onMaxChange={v => onChange({ maxGearCount: v })} />
          )}
          <RangeSlider onDragging={setSliderActive} label="Lake Size" min={0} max={5000} step={25} unit="ac"
            minVal={filters.minAcres} maxVal={filters.maxAcres}
            onMinChange={v => onChange({ minAcres: v })} onMaxChange={v => onChange({ maxAcres: v })} />
          {(cfg?.hasCpue ?? true) && (
            <RangeSlider onDragging={setSliderActive} label="Catch Rate" min={0} max={100} step={1}
              minVal={filters.minCpue} maxVal={filters.maxCpue}
              onMinChange={v => onChange({ minCpue: v })} onMaxChange={v => onChange({ maxCpue: v })} />
          )}
          {state === 'mn' ? (
            <RangeSlider onDragging={setSliderActive} label="Avg Size" min={0} max={15} step={0.25} unit="lb"
              minVal={filters.minWeight} maxVal={filters.maxWeight}
              onMinChange={v => onChange({ minWeight: v })} onMaxChange={v => onChange({ maxWeight: v })} />
          ) : (cfg?.hasLength ?? true) ? (
            <RangeSlider onDragging={setSliderActive} label="Avg Size" min={0} max={40} step={0.5} unit="in"
              minVal={filters.minLength} maxVal={filters.maxLength}
              onMinChange={v => onChange({ minLength: v })} onMaxChange={v => onChange({ maxLength: v })} />
          ) : null}
          {hasTrophy && (
            <RangeSlider onDragging={setSliderActive} label="Trophy Catch Rate" min={0} max={20} step={0.25}
              minVal={filters.minTrophy} maxVal={filters.maxTrophy}
              onMinChange={v => onChange({ minTrophy: v })} onMaxChange={v => onChange({ maxTrophy: v })} />
          )}
          {(cfg?.hasStocking ?? true) && (
            <RangeSlider onDragging={setSliderActive} label="Stocking Impact" min={0} max={200} step={5}
              minVal={filters.minStocked} maxVal={filters.maxStocked}
              onMinChange={v => onChange({ minStocked: v })} onMaxChange={v => onChange({ maxStocked: v })} />
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: space.xxl },
  lakeInput: {
    marginTop: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderWidth: hairline,
    borderColor: colors.paper3,
    backgroundColor: colors.paper2,
    color: colors.ink,
    ...text.dataS,
  },
  latestRow: { flexDirection: 'row', alignItems: 'center' },
  suggestBox: {
    borderWidth: hairline,
    borderTopWidth: 0,
    borderColor: colors.paper3,
    backgroundColor: colors.paper,
  },
  suggestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 11,
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },
});
