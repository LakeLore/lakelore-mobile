// components/StatPill.tsx
// The compact "Avg wt 1.11 lb" tags shown under each lake row. Tappable when
// given onPress (tap-to-define, IMPROVEMENT_PLAN 2.10 — the headline metrics
// read as jargon without an inline explanation).

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, text, hairline } from '../theme';

type Props = { label: string; value: string; onPress?: () => void };

export function StatPill({ label, value, onPress }: Props) {
  const body = (
    <>
      <Text style={[text.dataS, { color: colors.inkSoft }]}>{label}</Text>
      <Text style={[text.dataS, { color: colors.ink, fontWeight: '600' }]}>{value}</Text>
    </>
  );
  if (!onPress) return <View style={styles.pill}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && { backgroundColor: colors.paper3 }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint="Shows what this metric means">
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    borderWidth: hairline,
    borderColor: colors.paper3,
    backgroundColor: colors.paper2,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
});
