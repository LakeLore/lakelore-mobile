// components/StatPill.tsx
// The compact "Avg wt 1.11 lb" tags shown under each lake row.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, text, hairline } from '../theme';

type Props = { label: string; value: string };

export function StatPill({ label, value }: Props) {
  return (
    <View style={styles.pill}>
      <Text style={[text.dataS, { color: colors.inkSoft }]}>{label}</Text>
      <Text style={[text.dataS, { color: colors.ink, fontWeight: '600' }]}>{value}</Text>
    </View>
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
