// src/lakeCache.ts — last-N lake-detail payload cache (IMPROVEMENT_PLAN_2026-07-17 D1).
//
// The results list has an offline cache; tapping through to a lake offline
// used to dead-end on "Couldn't load lake". Cache the last MAX_ENTRIES lake
// payloads (LRU by an index list) so recently-viewed lakes stay readable at
// the water with no signal. Best-effort: every failure here is swallowed —
// the cache must never break the online path.
import AsyncStorage from '@react-native-async-storage/async-storage';

const INDEX_KEY = 'lakeCache.v1.index';
const MAX_ENTRIES = 20;
// Hard expiry (2026-07-25, T3.14): a year-old survey payload rendering with
// only a small date label overstates freshness — past this age the entry is
// treated as absent and the screen shows the normal offline error instead.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const keyFor = (state: string, lakeId: string | number) => `lakeCache.v1.${state}:${lakeId}`;

export async function putLake(state: string, lakeId: string | number, data: unknown): Promise<void> {
  try {
    const key = keyFor(state, lakeId);
    await AsyncStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    let index: string[] = raw ? JSON.parse(raw) : [];
    index = [key, ...index.filter(k => k !== key)];
    const evicted = index.slice(MAX_ENTRIES);
    index = index.slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
    if (evicted.length) await AsyncStorage.multiRemove(evicted);
  } catch { /* best-effort */ }
}

export async function getLake(state: string, lakeId: string | number): Promise<{ ts: number; data: unknown } | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(state, lakeId));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (entry?.ts && Date.now() - entry.ts > MAX_AGE_MS) {
      AsyncStorage.removeItem(keyFor(state, lakeId)).catch(() => {}); // free the LRU slot (bug-hunt #10)
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}
