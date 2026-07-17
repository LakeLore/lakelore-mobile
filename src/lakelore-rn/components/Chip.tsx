// components/Chip.tsx
// Square-cornered, hairline-bordered, mono small-caps. Active = walleye gold.

import React, { ReactNode } from 'react';
import { Pressable, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, text, space, hairline } from '../theme';

type Props = {
  children: ReactNode;
  active?: boolean;
  dot?: boolean;       // tiny gold pip at left (used for "Filters •")
  soft?: boolean;      // hairline-only border, paper background
  disabled?: boolean;  // greyed out + non-interactive (loading / unavailable)
  onPress?: () => void;
  style?: ViewStyle;
};

export function Chip({ children, active, dot, soft, disabled, onPress, style }: Props) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      // ~26pt visual height + 9pt slop per side ≈ 44pt effective target (D8).
      hitSlop={{ top: 9, bottom: 9, left: 6, right: 6 }}
      disabled={disabled}
      // VoiceOver/TalkBack: announce button-ness and the selected state —
      // species/gear chips previously read as plain text (D8).
      accessibilityRole="button"
      accessibilityState={{ selected: !!active, disabled: !!disabled }}>
      <View
        style={[
          styles.chip,
          {
            borderColor: soft ? colors.paper3 : colors.ink,
            backgroundColor: active ? colors.walleye : colors.paper,
            opacity: disabled ? 0.4 : 1,
          },
          style,
        ]}
      >
        {dot && <View style={styles.dot} />}
        <Text style={[text.labelM, { color: colors.ink }]} numberOfLines={1}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderWidth: hairline,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.walleye,
  },
});
