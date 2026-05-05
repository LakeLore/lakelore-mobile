// components/PaperHeader.tsx
// The dark ink banner used on most screens (replaces your current green band).
// modal=true variant flips to paper-on-ink for sheet headers (county/species pickers).

import React, { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, text, space, hairline } from '../theme';

type Props = {
  title: string;
  eyebrow?: string;
  right?: ReactNode | string;
  onBack?: () => void;
  backLabel?: string;
  modal?: boolean;
};

export function PaperHeader({ title, eyebrow, right, onBack, backLabel, modal }: Props) {
  const fg = modal ? colors.ink : colors.paper;
  const bg = modal ? colors.paper : colors.ink;
  const eyebrowColor = modal ? colors.inkSoft : colors.paper3;

  return (
    <View style={[styles.bar, { backgroundColor: bg }]}>
      <View style={styles.left}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={8}>
            <View style={[styles.backBtn, { borderColor: modal ? colors.ink : colors.paper3 }]}>
              <Text style={[text.labelL, { color: fg }]}>
                {backLabel ?? '←'}
              </Text>
            </View>
          </Pressable>
        )}
        <View style={{ flexShrink: 1 }}>
          {eyebrow && <Text style={[text.labelS, { color: eyebrowColor }]}>{eyebrow}</Text>}
          <Text style={[text.displayL, { color: fg, marginTop: 2 }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>
      {typeof right === 'string'
        ? <Text style={[text.labelL, { color: modal ? colors.walleye2 : colors.paper3 }]}>{right}</Text>
        : right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: space.xl,
    paddingVertical: 14,
    borderBottomWidth: hairline,
    borderBottomColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: hairline,
  },
});
