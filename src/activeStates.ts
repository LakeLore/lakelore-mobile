import { StateKey } from './types';
import { STATE_KEYS } from './generated/states';

// States active in the current app build — the FULL registry fleet as of the
// 2026-07-15 all-states launch (50 US states + 6 Canadian provinces). The
// server derives its own ACTIVE_STATES from the same registry
// (lakelore-data/registry/states.json), and the marketing site mirrors it in
// web/app/page.tsx. To pull a state, remove it from the registry's active
// flags AND filter it here.
export const ACTIVE_STATES: readonly StateKey[] = STATE_KEYS;

export const isActiveState = (s: StateKey): boolean =>
  (ACTIVE_STATES as readonly StateKey[]).includes(s);

// Free tier. Paid states are browsable by everyone in PREVIEW mode (search,
// filters, scatter, all metrics visible) — but the server redacts lake names
// from /results and hard-gates /lake/:id, and the app routes any lake-detail
// tap to the paywall. Mirrors FREE_STATES in
// lake-fish-mobile-server/entitlement.js.
export const FREE_STATES: readonly StateKey[] = ['mn'] as const;

export const isFreeState = (s: StateKey): boolean =>
  (FREE_STATES as readonly StateKey[]).includes(s);
