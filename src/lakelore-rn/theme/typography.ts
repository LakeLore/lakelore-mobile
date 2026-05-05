// theme/typography.ts
// Font families: load with expo-font (see App.tsx in README).
// We expose a `text` object with named roles, NOT raw font names —
// so a future font swap touches one file, not every screen.

import { Platform, TextStyle } from 'react-native';

export const fonts = {
  display: 'YoungSerif_400Regular',
  edit:    'InstrumentSerif_400Regular',
  editIt:  'InstrumentSerif_400Regular_Italic',
  body:    'Newsreader_400Regular',
  bodyMed: 'Newsreader_500Medium',
  bodySemi:'Newsreader_600SemiBold',
  bodyBold:'Newsreader_700Bold',
  mono:    'JetBrainsMono_400Regular',
  monoMed: 'JetBrainsMono_500Medium',
  monoSemi:'JetBrainsMono_600SemiBold',
  monoBold:'JetBrainsMono_700Bold',
} as const;

// Letter-spacing helpers — RN takes a px value, not an em string.
const ls = (em: number, fontSize: number) => em * fontSize;

// lineHeight ratio targets ~1.3× fontSize so Young Serif's tall caps and
// JetBrains Mono's tight metrics aren't clipped at the top of single-line
// containers (modal headers, list rows with numberOfLines={1}).
export const text = {
  // Display — big titles, lake names
  displayXL: { fontFamily: fonts.display, fontSize: 30, lineHeight: 40 } as TextStyle,
  displayL:  { fontFamily: fonts.display, fontSize: 22, lineHeight: 30 } as TextStyle,
  displayM:  { fontFamily: fonts.display, fontSize: 18, lineHeight: 24 } as TextStyle,

  // Editorial — captions, intro paragraphs
  editorialM: { fontFamily: fonts.edit, fontSize: 18, lineHeight: 26 } as TextStyle,
  editorialS: { fontFamily: fonts.edit, fontSize: 14, lineHeight: 20 } as TextStyle,

  // Body — paragraph text and form values
  bodyL:    { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 } as TextStyle,
  bodyM:    { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 } as TextStyle,
  bodyS:    { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 } as TextStyle,
  bodyBold: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20 } as TextStyle,

  // Mono — data, labels, microcopy. Letter-spaced for legibility.
  dataXL: {
    fontFamily: fonts.monoMed, fontSize: 24, lineHeight: 32,
    letterSpacing: ls(-0.02, 24),
  } as TextStyle,
  dataL: {
    fontFamily: fonts.monoSemi, fontSize: 18, lineHeight: 24,
  } as TextStyle,
  dataM: {
    fontFamily: fonts.monoSemi, fontSize: 14, lineHeight: 20,
  } as TextStyle,
  dataS: {
    fontFamily: fonts.mono, fontSize: 11, lineHeight: 16,
  } as TextStyle,

  // Small-caps mono labels: "ATLAS · MN", "LATEST ONLY"
  // (no real small-caps in JetBrains; uppercase + tracking does the work)
  labelL: {
    fontFamily: fonts.mono, fontSize: 11, letterSpacing: ls(0.12, 11),
    textTransform: 'uppercase',
  } as TextStyle,
  labelM: {
    fontFamily: fonts.mono, fontSize: 10, letterSpacing: ls(0.10, 10),
    textTransform: 'uppercase',
  } as TextStyle,
  labelS: {
    fontFamily: fonts.mono, fontSize: 9, letterSpacing: ls(0.16, 9),
    textTransform: 'uppercase',
  } as TextStyle,
} as const;

export type TextRole = keyof typeof text;
