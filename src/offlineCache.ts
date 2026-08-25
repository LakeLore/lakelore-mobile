// src/offlineCache.ts — per-state last-search results cache (SearchScreen
// offline path), promoted out of inline AsyncStorage calls 2026-08-25.
//
// storage.ts and the 1.1.1 CHANGELOG both promised "30 d hard expiry" for
// offlineCache.v1.*, but no read site ever checked the age — cached.ts fed
// only the "saved <date>" banner, so a year-old result set would render as if
// current. This module makes the documented contract real, mirroring
// lakeCache.ts: hard 30 d expiry on read, LRU cap (by index key) on write.
// The cap is 3 STATES — a full 50-row + 500-scatter-row payload per state is
// heavy, and three most-recent states covers the realistic "at the lake with
// no signal" cases. Best-effort throughout: every failure is swallowed — the
// cache must never break the online path.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Result } from './types';
import { KEYS, offlineCacheKey } from './storage';

const INDEX_KEY = KEYS.offlineCacheIndex;
const MAX_STATES = 3;
// Hard expiry — mirrors lakeCache.ts: past this age the entry is treated as
// absent and the screen shows the normal offline error instead.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface OfflineCacheEntry {
  ts: number;
  results: Result[];
  scatterResults: Result[];
  total: number;
}

export async function putOfflineResults(
  state: string,
  entry: Omit<OfflineCacheEntry, 'ts'>,
): Promise<void> {
  try {
    const key = offlineCacheKey(state);
    await AsyncStorage.setItem(key, JSON.stringify({ ts: Date.now(), ...entry }));
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    let index: string[] = raw ? JSON.parse(raw) : [];
    index = [key, ...index.filter(k => k !== key)];
    const evicted = index.slice(MAX_STATES);
    index = index.slice(0, MAX_STATES);
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
    if (evicted.length) await AsyncStorage.multiRemove(evicted);
  } catch { /* best-effort */ }
}

/** Patch just the scatter rows into an existing entry (the scatter fetch is
 * lazy since 2026-08-25, so it lands after the search that wrote the entry).
 * No-op when the entry is gone (evicted between the search and the fetch). */
export async function mergeOfflineScatter(state: string, scatterResults: Result[]): Promise<void> {
  try {
    const key = offlineCacheKey(state);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return;
    const entry = JSON.parse(raw) as OfflineCacheEntry;
    await AsyncStorage.setItem(key, JSON.stringify({ ...entry, scatterResults }));
  } catch { /* best-effort */ }
}

export async function getOfflineResults(state: string): Promise<OfflineCacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(offlineCacheKey(state));
    if (!raw) return null;
    const entry = JSON.parse(raw) as OfflineCacheEntry;
    if (entry?.ts && Date.now() - entry.ts > MAX_AGE_MS) {
      AsyncStorage.removeItem(offlineCacheKey(state)).catch(() => {}); // free the payload (index entry ages out naturally)
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}
