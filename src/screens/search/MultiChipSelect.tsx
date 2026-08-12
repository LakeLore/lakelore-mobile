// Wrapping chip-row with a "show more" affordance when there are many options
// (used for gear types where the long tail is rarely useful).
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, text, space } from '../../lakelore-rn/theme';
import { Chip, SectionLabel } from '../../lakelore-rn/components';

type Props = {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  counts?: Record<string, number>;
  showMoreThreshold?: number;
  labels?: Record<string, string>;
  // Which counts decide the primary/"show more" SPLIT (2026-08-12): defaults
  // to `counts`, but the two roles differ — `counts` is what the chip DISPLAYS
  // (latest-aware when the Latest-only toggle is on), while the long-tail
  // split is a property of overall data mass and must not change with a view
  // toggle. Displaying latest counts (43/46...) against thresholds calibrated
  // for all-history magnitudes (MN=100) collapsed EVERY gear chip.
  splitCounts?: Record<string, number>;
};

export function MultiChipSelect({
  label, options, selected, onToggle, counts, showMoreThreshold, labels, splitCounts,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!options.length) return null;

  const tierCounts = splitCounts ?? counts;
  const primary = showMoreThreshold !== undefined
    ? options.filter(o => (tierCounts?.[o] ?? 0) >= showMoreThreshold)
    : options;
  const secondary = showMoreThreshold !== undefined
    ? options.filter(o => (tierCounts?.[o] ?? 0) < showMoreThreshold)
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

const styles = StyleSheet.create({
  rangeField: { marginBottom: space.xxl },
});
