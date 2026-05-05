// components/Segmented.tsx
// Replaces the iOS-style List/Scatter/CPUE↓ control.
// Square corners, ink border, monospace labels.

import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { colors, text, hairline } from '../theme';

type Props = {
  options: string[];
  active: number;
  onChange?: (i: number) => void;
};

export function Segmented({ options, active, onChange }: Props) {
  return (
    <View style={styles.row}>
      {options.map((o, i) => {
        const on = i === active;
        return (
          <Pressable
            key={o}
            onPress={() => onChange?.(i)}
            style={[
              styles.cell,
              {
                backgroundColor: on ? colors.ink : colors.paper,
                borderRightWidth: i < options.length - 1 ? hairline : 0,
                borderRightColor: colors.ink,
              },
            ]}
          >
            <Text style={[text.labelM, { color: on ? colors.paper : colors.ink }]}>
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: hairline,
    borderColor: colors.ink,
    alignSelf: 'flex-start',
  },
  cell: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
