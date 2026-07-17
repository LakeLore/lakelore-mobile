import { StateKey } from './types';
import { STATE_KEYS, GENERATED_STATES } from './generated/states';

// States active in the current app build — every registry state flagged
// active (2026-07-15 all-states launch: 50 active = 45 US states + 5 Canadian
// provinces; the 6 with no stocking AND no CPUE data — sc/az/ma/de/ri/qc —
// are registry active:false and not selectable). The server derives its ACTIVE_STATES
// from the same registry (lakelore-data/registry/states.json); the marketing
// site mirrors it in web/app/page.tsx. To pull or add a state, flip the
// registry active flag and regenerate src/generated/states.ts.
export const ACTIVE_STATES: readonly StateKey[] =
  STATE_KEYS.filter(k => GENERATED_STATES[k].active);

export const isActiveState = (s: StateKey): boolean =>
  (ACTIVE_STATES as readonly StateKey[]).includes(s);

// Free tier. Paid states are browsable by everyone in PREVIEW mode (search,
// filters, scatter, all metrics visible, lake detail included) — the server
// redacts lake identity (name, county, acres, coords, links; hashed ids)
// from both /results and /lake/:id, and the app renders redacted lake detail
// with an unlock banner; only /pdf hard-402s (2026-07-15 shape). Mirrors
// FREE_STATES in lake-fish-mobile-server/entitlement.js.
export const FREE_STATES: readonly StateKey[] = ['mn'] as const;

export const isFreeState = (s: StateKey): boolean =>
  (FREE_STATES as readonly StateKey[]).includes(s);
