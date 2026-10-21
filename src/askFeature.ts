// Feature flag for the "Ask LakeLore" assistant (2026-09-10).
//
// Two layers (2026-10-20, production launch with 1.1.2):
//  1. COMPILE TIME — whether the chat is in this bundle at all. On in dev and
//     in any build or OTA made with EXPO_PUBLIC_ASK_ENABLED=1: the production
//     and staging EAS profiles set it, and scripts/ota.sh sets it only for
//     runtimes 1.1.2 and later, so OTAs to the 1.1.1 fleet keep it compiled
//     out (a new feature reaches store users through store review).
//  2. RUN TIME — whether the server says the assistant is open, from
//     GET /api/client-config `ask.enabled`. Lets the owner switch it off (credit
//     gone, a bad answer in the wild) without a release. The last answer is
//     remembered; with no answer yet it counts as open, and the server still
//     refuses asks itself when it is closed.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from './storage';

export const ASK_FEATURE_ENABLED: boolean =
  __DEV__ || process.env.EXPO_PUBLIC_ASK_ENABLED === '1';

let served = true;
// Set once a fresh client-config answer arrives; the stored answer must not
// overwrite it if storage happens to be slower than the network.
let fresh = false;
const listeners = new Set<(on: boolean) => void>();

// Restore the last served answer at module load.
AsyncStorage.getItem(KEYS.askServed)
  .then(v => { if (!fresh && (v === '0' || v === '1')) setServed(v === '1', false); })
  .catch(() => { /* default stays open */ });

function setServed(on: boolean, persist: boolean): void {
  if (persist) AsyncStorage.setItem(KEYS.askServed, on ? '1' : '0').catch(() => {});
  if (on === served) return;
  served = on;
  listeners.forEach(l => l(on));
}

/** Apply `ask` from /api/client-config. Older servers omit it: no change. */
export function applyServedAsk(ask: unknown): void {
  const enabled = (ask as { enabled?: unknown } | null | undefined)?.enabled;
  if (typeof enabled === 'boolean') { fresh = true; setServed(enabled, true); }
}

/** True when the chat is in this bundle AND the server has it open. */
export function useAskAvailable(): boolean {
  const [on, setOn] = useState(served);
  useEffect(() => {
    setOn(served);
    listeners.add(setOn);
    return () => { listeners.delete(setOn); };
  }, []);
  return ASK_FEATURE_ENABLED && on;
}
