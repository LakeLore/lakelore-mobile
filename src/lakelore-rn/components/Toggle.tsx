// components/Toggle.tsx
// Swap for your iOS-blue switch. Gold = on, ink thumb.

import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { colors, hairline } from '../theme';

type Props = {
  value: boolean;
  onValueChange?: (v: boolean) => void;
  accessibilityLabel?: string;
};

export function Toggle({ value, onValueChange, accessibilityLabel }: Props) {
  return (
    <Pressable
      onPress={() => onValueChange?.(!value)}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
    >
      <View
        style={[
          styles.track,
          { backgroundColor: value ? colors.walleye : colors.paper2 },
        ]}
      >
        <View style={[styles.thumb, { left: value ? 18 : 2 }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 38,
    height: 22,
    borderRadius: 11,
    borderWidth: hairline,
    borderColor: colors.ink,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.ink,
  },
});
