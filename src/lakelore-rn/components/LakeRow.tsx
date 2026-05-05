// components/LakeRow.tsx
// One row of the results list. Lake name (display), location (mono),
// stat pills, and the big CPUE number on the right.

import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { colors, text, space, hairline } from '../theme';
import { StatPill } from './StatPill';

type Stat = [label: string, value: string];

type Props = {
  name: string;
  location: string;        // pre-formatted "Murray · 1,209.24 ac · 10 ft · 2024-09-09"
  stats: Stat[];           // 0–3 stat pills
  rightValue: string;      // the CPUE value, e.g. "46.7"
  rightLabel?: string;     // small-caps label, default "CPUE"
  highlighted?: boolean;
  onPress?: () => void;
};

export function LakeRow({
  name, location, stats, rightValue, rightLabel = 'CPUE', highlighted, onPress,
}: Props) {
  return (
    <Pressable onPress={onPress}>
      <View style={[
        styles.row,
        { backgroundColor: highlighted ? colors.paper2 : colors.paper },
      ]}>
        <View style={{ flex: 1 }}>
          <Text style={text.displayM} numberOfLines={1}>{name}</Text>
          <Text style={[text.dataS, { color: colors.inkSoft, marginTop: 3 }]} numberOfLines={1}>
            {location}
          </Text>
          {stats.length > 0 && (
            <View style={styles.stats}>
              {stats.map(([l, v]) => <StatPill key={l} label={l} value={v} />)}
            </View>
          )}
        </View>
        <View style={styles.right}>
          <Text style={[text.dataXL, { color: colors.ink }]}>{rightValue}</Text>
          <Text style={[text.labelS, { color: colors.walleye2 }]}>{rightLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingVertical: 14,
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.md,
  },
  right: {
    alignItems: 'flex-end',
  },
});
