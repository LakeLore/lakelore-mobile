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
      {/* Dotted underline on tappable labels (D2): the affordance that a
          definition is one tap away — discovery was purely accidental before. */}
      <Text style={[text.dataS, { color: colors.inkSoft }, onPress && styles.defined]}>{label}</Text>
      <Text style={[text.dataS, { color: colors.ink, fontWeight: '600' }]}>{value}</Text>
    </>
  );
  if (!onPress) return <View style={styles.pill}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      // hitSlop lifts the effective target to ~44pt (the pill itself is ~20pt
      // tall) without changing the visual density (D8).
      hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
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
  defined: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: colors.paper3,
  },
});
