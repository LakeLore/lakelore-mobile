// theme/spacing.ts
export const space = {
  xxs: 2,
  xs:  4,
  sm:  6,
  md:  8,
  lg:  12,
  xl:  16,
  xxl: 24,
  xxxl: 32,
} as const;

// Hairline border — 1px on all platforms.
// (RN's StyleSheet.hairlineWidth differs across DPI; we want a deliberate 1px.)
export const hairline = 1;

// Borders never round in this system — every container is square.
export const radii = {
  none: 0,
  pill: 999,   // only for the iOS-style toggle thumb
} as const;

export type Space = keyof typeof space;
