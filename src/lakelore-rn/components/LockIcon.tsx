// components/LockIcon.tsx
// Field-guide padlock — square shackle outline above a square body.
// Replaces the macOS-emoji 🔒, which felt out of place against the
// paper-and-ink design.

import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

type Props = {
  size?: number;
  color?: string;
};

export function LockIcon({ size = 11, color = colors.walleye2 }: Props) {
  // Drawn on a 12×14 viewBox so the body fills nicely at small sizes; the
  // shackle is a 2px stroke that reads clearly down to ~10px on retina.
  return (
    <Svg width={size} height={size * (14 / 12)} viewBox="0 0 12 14">
      <Path
        d="M3 6 V4 a3 3 0 0 1 6 0 V6"
        stroke={color}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="square"
      />
      <Rect x="1.5" y="6" width="9" height="7" fill={color} />
    </Svg>
  );
}
