import { StateKey } from './types';

// States active in the current app build. To re-enable a state, add its key
// here (and to the server's ACTIVE_STATES in lake-fish-mobile-server/server.js
// + the marketing site's ACTIVE_STATES in web/app/page.tsx).
//
// Per-state data folders, county map paths, species/gear name maps, survival
// modules, and DBs on the Fly volume are all kept intact for inactive states
// — only the UI and server validation drop them.
export const ACTIVE_STATES: readonly StateKey[] = [
  'mn',
  'sd',
  'nd',
  'ia',
  'ne',
] as const;

export const isActiveState = (s: StateKey): boolean =>
  (ACTIVE_STATES as readonly StateKey[]).includes(s);
