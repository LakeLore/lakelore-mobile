// src/storage.ts — the AsyncStorage key registry + boot-time migration
// (IMPROVEMENT_PLAN_2026-07-25 T3.14, shipped post-launch 2026-08-25).
//
// Every persisted key the app uses is declared here, so "what does the app
// store?" has one answer and key collisions/typos can't happen silently.
// Versioning convention: schema changes RENAME the key (`.v1` → `.v2`) — the
// old payload is simply never read again (drop-on-mismatch by construction) —
// and the superseded key is added to OBSOLETE_KEYS below so migrateStorage()
// reclaims the space on next boot. Prefix families (per-state caches) list a
// `prefix` instead of a literal key.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  /** Device identity — NEVER migrate, expire, or delete (subscription restore
   * and feedback threads key off it). */
  userId: 'lakelore.userId',
  /** Selected state (StateContext). Un-versioned by design: value is a state
   * code validated against the registry on read. */
  selectedState: 'selectedState',
  sessionToken: 'sessionToken.v1',
  attestCooldown: 'attest.cooldown.v1',
  attestLastAttempt: 'attest.lastAttempt.v1',
  ratingsLakeViews: 'ratings.lakeViews.v1',
  ratingsLastAsk: 'ratings.lastAsk.v1',
  entitlementCacheV2: 'entitlement.allStates.v2',
  countySelection: 'countySelection.v1',
  lakeCacheIndex: 'lakeCache.v1.index',
  schemaVersion: 'storage.schemaVersion',
} as const;

export const PREFIXES = {
  /** Per-state results cache (SearchScreen offline path); 30 d hard expiry. */
  offlineCache: 'offlineCache.v1.',
  /** Per-lake detail cache (lakeCache.ts LRU); 30 d hard expiry. */
  lakeCache: 'lakeCache.v1.',
} as const;

export const offlineCacheKey = (state: string) => `${PREFIXES.offlineCache}${state}`;
export const lakeCacheKey = (state: string, lakeId: string | number) =>
  `${PREFIXES.lakeCache}${state}:${lakeId}`;

// Keys retired by schema bumps — reclaimed at boot. Add the OLD key here when
// bumping a key's version suffix.
const OBSOLETE_KEYS = [
  'entitlement.allStates.v1', // superseded by v2 (timestamped) 2026-07-25
];

export const STORAGE_SCHEMA = 1;

/** Boot-time migration hook (App.tsx, fire-and-forget). Records the schema
 * version and reclaims obsolete keys; future schema steps go in the switch. */
export async function migrateStorage(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.schemaVersion);
    const from = raw ? Number(raw) : 0;
    if (from >= STORAGE_SCHEMA) return;
    // Stepwise migrations. Each case falls through to the next version.
    // v0 → v1: first stamped version; reclaim keys retired before stamping.
    await AsyncStorage.multiRemove(OBSOLETE_KEYS).catch(() => {});
    await AsyncStorage.setItem(KEYS.schemaVersion, String(STORAGE_SCHEMA));
  } catch { /* best-effort — storage hygiene must never block boot */ }
}
