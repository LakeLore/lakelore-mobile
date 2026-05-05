// components/SectionLabel.tsx
// Small-caps mono section headings: "ALL COUNTIES", "SELECTED · 7"

import React from 'react';
import { Text, TextStyle } from 'react-native';
import { colors, text } from '../theme';

type Props = { children: string; style?: TextStyle };

export function SectionLabel({ children, style }: Props) {
  return <Text style={[text.labelS, { color: colors.inkSoft }, style]}>{children}</Text>;
}
