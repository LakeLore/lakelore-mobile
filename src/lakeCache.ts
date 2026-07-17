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
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
