// Advanced Filters modal — gear/survey type chips plus numeric range fields.
// State-specific blocks key off `state` so each agency's available filters
// surface the right way.
import React from 'react';
import {
  Modal, View, Pressable, Text, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FilterState, FilterOptions, WI_GEAR_LABELS } from '../../types';
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
          {/* Show the gear chip even when there's only one option so the
              user can see which gear is in play for the current species
              (e.g. NE Largemouth Bass is sampled by Electrofishing only —
              surfacing that here is more informative than hiding it). */}
          {(state === 'sd' || state === 'nd' || state === 'ia' || state === 'ne' || state === 'wi' || state === 'mi') && options?.gearTypes?.length ? (
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
            <RangeField label="Catch Rate" minVal={filters.minCpue} maxVal={filters.maxCpue}
              onMinChange={v => onChange({ minCpue: v })} onMaxChange={v => onChange({ maxCpue: v })} />
          )}
          <RangeField label="Survey Year" minVal={filters.minYear} maxVal={filters.maxYear}
            onMinChange={v => onChange({ minYear: v })} onMaxChange={v => onChange({ maxYear: v })}
            keyboardType="number-pad"
            placeholder={options ? `${options.yearRange.min}–${options.yearRange.max}` : ''} />
          <RangeField label="Lake Size (acres)" minVal={filters.minAcres} maxVal={filters.maxAcres}
            onMinChange={v => onChange({ minAcres: v })} onMaxChange={v => onChange({ maxAcres: v })} />
          <RangeField label="Stck Adults / 100AC" minVal={filters.minStocked} maxVal={filters.maxStocked}
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
