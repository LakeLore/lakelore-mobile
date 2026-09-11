// Feature flag for the "Ask LakeLore" assistant (2026-09-10).
//
// The server route (POST /api/:state/ask) only exists on servers started with
// LAKELORE_ASK_ENABLED=1 — production does not have it yet, so the entry
// point shows in dev builds and in builds whose EAS profile bakes in
// EXPO_PUBLIC_ASK_ENABLED=1 (the `staging` profile, pointed at the staging
// server — 2026-09-11). Flip the production side (or drive this from
// /api/client-config) in the same change that enables the route in production.
export const ASK_FEATURE_ENABLED: boolean =
  __DEV__ || process.env.EXPO_PUBLIC_ASK_ENABLED === '1';
