// components/PrimaryButton.tsx
// Ink-on-paper button. Square corners, mono label.
// Used for "Search" and other primary CTAs.

import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, text } from '../theme';

type Props = {
  children: string;
  onPress?: () => void;
  style?: ViewStyle;
};

export function PrimaryButton({ children, onPress, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={[text.labelL, { color: colors.paper }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
