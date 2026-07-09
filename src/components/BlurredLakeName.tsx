// BlurredLakeName — placeholder rendered where a lake name would appear when
// the server has redacted it (paid-state preview for non-subscribers).
//
// The real name never reaches the device in preview mode, so there is nothing
// to actually blur. Instead we render a DECOY name (picked deterministically
// from the seed, so a given row keeps the same shape across re-renders) with
// transparent ink and a wide text shadow — reads as a smudged, unreadable
// name of plausible length. Decoys are generic north-woods names that don't
// exist verbatim in our data, and the blur keeps them illegible regardless.

import React from 'react';
import { Text, StyleSheet, StyleProp, TextStyle } from 'react-native';

const DECOY_NAMES = [
  'Whispering Pines Lake',
  'Tamarack Hollow Lake',
  'Long Portage Lake',
  'Kingfisher Lake',
  'Blue Heron Lake',
  'Snowshoe Lake',
  'Meadowlark Lake',
  'Birch Narrows Lake',
  'Cattail Slough',
  'Loon Echo Lake',
];

function decoyFor(seed: number | string): string {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return DECOY_NAMES[Math.abs(h) % DECOY_NAMES.length];
}

interface Props {
  /** Stable per-lake seed (lake_id) so the placeholder doesn't flicker. */
  seed: number | string;
  /** Typography of the name it stands in for (e.g. text.displayM + color). */
  style?: StyleProp<TextStyle>;
}

export default function BlurredLakeName({ seed, style }: Props) {
  return (
    <Text
      style={[style, styles.blurred]}
      numberOfLines={1}
      accessibilityLabel="Lake name hidden — requires All-States subscription"
    >
      {decoyFor(seed)}
    </Text>
  );
}

const styles = StyleSheet.create({
  blurred: {
    color: 'transparent',
    textShadowColor: 'rgba(26, 31, 42, 0.45)', // ink at partial opacity
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
});
