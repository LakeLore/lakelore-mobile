// BlurredLakeName — placeholder rendered where a lake name would appear when
// the server has redacted it (paid-state preview for non-subscribers).
//
// The real name never reaches the device in preview mode. Renders NEUTRAL
// REDACTION BARS (block glyphs) — length varies deterministically by seed so
// rows keep distinct, stable shapes across re-renders. Deliberately NOT a
// plausible fake name: decoys read as deception to users and App Review;
// honest redaction sells the same curiosity without the trust cost
// (IMPROVEMENT_PLAN 1.6, swapped 2026-07-16).

import React from 'react';
import { Text, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { colors } from '../lakelore-rn/theme';

// Deterministic small hash so a given lake keeps the same bar shape.
function hash(seed: number | string): number {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Two "words" of block glyphs, 4–7 + 3–5 blocks — reads as a redacted
// two-word lake name of plausible length.
function barsFor(seed: number | string): string {
  const h = hash(seed);
  const first = 4 + (h % 4);
  const second = 3 + ((h >> 3) % 3);
  return '▆'.repeat(first) + ' ' + '▆'.repeat(second);
}

interface Props {
  /** Stable per-lake seed (lake_id) so the placeholder doesn't flicker. */
  seed: number | string;
  /** Typography of the name it stands in for (e.g. text.displayM + color). */
  style?: StyleProp<TextStyle>;
  /** Render on a dark (ink) background — e.g. the PaperHeader title slot. */
  onDark?: boolean;
}

export default function BlurredLakeName({ seed, style, onDark }: Props) {
  return (
    <Text
      style={[style, styles.bars, onDark && styles.barsOnDark]}
      numberOfLines={1}
      accessibilityLabel="Lake name hidden — requires All-States subscription"
    >
      {barsFor(seed)}
    </Text>
  );
}

const styles = StyleSheet.create({
  bars: {
    color: colors.paper3,
  },
  barsOnDark: {
    color: 'rgba(244, 239, 228, 0.35)', // paper at partial opacity
  },
});
