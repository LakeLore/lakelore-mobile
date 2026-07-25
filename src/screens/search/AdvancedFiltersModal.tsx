// Advanced Filters modal — gear/survey type chips plus numeric range fields.
// State-specific blocks key off `state` so each agency's available filters
// surface the right way.
import React from 'react';
import {
  Modal, View, Pressable, Text, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FilterState, FilterOptions, WI_GEAR_LABELS, GENERATED_STATES, StateKey } from '../../types';
import { colors, text, space } from '../../lakelore-rn/theme';
import { PaperHeader } from '../../lakelore-rn/components';
import { MultiChipSelect } from './MultiChipSelect';
import { RangeField } from './RangeField';

type Props = {
  visible: boolean;
  filters: FilterState;
  state: string;
  options: FilterOptions | null;
  onChange: (u: Partial<FilterState>) => void;
  onClose: () => void;
  onApply: () => void;
};

export function AdvancedFiltersModal({
  visible, filters, state, options, onChange, onClose, onApply,
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
          automaticallyAdjustKeyboardInsets>
          {/* Show the gear chip even when there's only one option so the
              user can see which gear is in play for the current species
              (e.g. NE Largemouth Bass is sampled by Electrofishing only —
              surfacing that here is more informative than hiding it). */}
          {state !== 'mn' && options?.gearTypes?.length ? (
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
          {/* MN "Survey Type" (Standard vs Targeted) removed per DATA_MODEL §4 —
              the distinction confused more than it helped. */}
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
          {(cfg?.hasCpue ?? true) && (
            <RangeField label="Catch Rate" minVal={filters.minCpue} maxVal={filters.maxCpue}
              onMinChange={v => onChange({ minCpue: v })} onMaxChange={v => onChange({ maxCpue: v })} />
          )}
          <RangeField label="Survey Year" minVal={filters.minYear} maxVal={filters.maxYear}
            onMinChange={v => onChange({ minYear: v })} onMaxChange={v => onChange({ maxYear: v })}
            keyboardType="number-pad"
            placeholder={options ? `${options.yearRange.min}–${options.yearRange.max}` : ''} />
          <RangeField label="Lake Size (acres)" minVal={filters.minAcres} maxVal={filters.maxAcres}
            onMinChange={v => onChange({ minAcres: v })} onMaxChange={v => onChange({ maxAcres: v })} />
          {(cfg?.hasStocking ?? true) && (
            <RangeField label="Stck Adults / 100AC" minVal={filters.minStocked} maxVal={filters.maxStocked}
              onMinChange={v => onChange({ minStocked: v })} onMaxChange={v => onChange({ maxStocked: v })} />
          )}
          {/* Avg Length range: shown wherever the state's data carries
              average_length (MN reports weight instead — see below). */}
          {state !== 'mn' && (cfg?.hasLength ?? true) && (
            <RangeField label="Avg Length (in)" minVal={filters.minLength} maxVal={filters.maxLength}
              onMinChange={v => onChange({ minLength: v })} onMaxChange={v => onChange({ maxLength: v })} />
          )}
          {/* Total Catch range: shown wherever fc.total_catch is populated.
              SD uses sample_n (a different metric) and NE doesn't have a
              total_catch column at all. */}
          {(state === 'mn' || (cfg?.hasCatch ?? false)) && (
            <RangeField label="Total Catch" minVal={filters.minCatch} maxVal={filters.maxCatch}
              onMinChange={v => onChange({ minCatch: v })} onMaxChange={v => onChange({ maxCatch: v })}
              keyboardType="number-pad" />
          )}
          {state === 'mn' && (
            <>
              <RangeField label="Avg Weight (lb)" minVal={filters.minWeight} maxVal={filters.maxWeight}
                onMinChange={v => onChange({ minWeight: v })} onMaxChange={v => onChange({ maxWeight: v })} />
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
