// Numeric Min/Max pair used by AdvancedFiltersModal.
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, text, space, hairline } from '../../lakelore-rn/theme';
import { SectionLabel } from '../../lakelore-rn/components';

type Props = {
  label: string;
  minVal: string;
  maxVal: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  keyboardType?: 'decimal-pad' | 'number-pad';
  placeholder?: string;
};

export function RangeField({
  label, minVal, maxVal, onMinChange, onMaxChange,
  keyboardType = 'decimal-pad', placeholder,
}: Props) {
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

const styles = StyleSheet.create({
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
});
