import { StateKey } from './types';
import { STATE_KEYS, GENERATED_STATES } from './generated/states';

// States active in the current app build — every registry state flagged
// active. 2026-08-13: 38 active (38 US; MB product-held for the US-only
// submission — licence-clean, reactivation-eligible) — 11 states/provinces are
// on whole-state LEGAL HOLD (ab bc on sk ak hi ks ky mi ne vt; see
// ~/DATA_LICENSING_AUDIT_2026-07-28.md) and sc/az/ma/de/ri/qc stay inactive
// for product reasons. The server derives its ACTIVE_STATES from the same
// registry (lakelore-data/registry/states.json); the marketing site mirrors
// it in web/app/lib/lakelore.ts. To pull or add a state, flip the registry
// active flag, regenerate src/generated/states.ts — and run the
// serving-contract reachability check in SUBMIT_RUNBOOK §0.0b BEFORE
// deploying the server side.
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
