// src/userId.ts — anonymous user identifier.
//
// LakeLore has no account system. To tie subscription entitlement to a
// stable identity (so the server can answer "is this device's user paid?")
// we generate a random v4-style UUID once on first launch, cache it in
// AsyncStorage, and reuse it for the lifetime of the install.
//
// The same UUID is:
//   - passed to RevenueCat as the App User ID (so RC ties purchases to it),
//   - sent on every API request as `X-User-Id` (so the server can look up
//     entitlement against RC's REST API or its webhook-driven cache).
//
// Limitations
// ───────────
// AsyncStorage is wiped on app uninstall. If the user uninstalls and
// reinstalls, they get a new UUID and need to tap "Restore Purchases" to
// reattach their subscription via Apple/Google's account-level receipt.
// True cross-install persistence would require iCloud Keychain or an
// account system; out of scope for v1.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lakelore.userId';

let cached: string | null = null;

/**
 * Random v4 UUID. Crypto-strong when the expo-crypto native module is in the
 * binary (build 25+); Math.random fallback for OTA bundles running on older
 * binaries (2026-07-27, store red-team aside — the old comment claimed "this
 * isn't a secret", but the UUID is effectively a bearer credential for paid
 * entitlement, so a guessable PRNG was a collision/guessing surface).
 * NATIVE MODULE: probed before require, same lesson as the share card
 * (CLAUDE.md "Important constraints") — never bare-require a codegen module
 * on an OTA-to-older-binary path.
 */
function generateUuidV4(): string {
  try {
    if ((globalThis as { expo?: { modules?: Record<string, unknown> } }).expo?.modules?.ExpoCrypto) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Crypto = require('expo-crypto') as { randomUUID: () => string };
      return Crypto.randomUUID();
    }
  } catch { /* fall through to the PRNG path */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get the persistent anonymous user ID. Generates one on first call and
 * caches in memory + AsyncStorage for all subsequent calls.
 */
export async function getUserId(): Promise<string> {
  if (cached) return cached;
  try {
    let id = await AsyncStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = generateUuidV4();
      await AsyncStorage.setItem(STORAGE_KEY, id);
    }
    cached = id;
    return id;
  } catch (e) {
    // AsyncStorage failure (rare) — fall back to a session-only ID so the
    // app keeps working. Server entitlement just won't persist for this
    // install, which is acceptable degradation.
    if (__DEV__) console.warn('[userId] AsyncStorage failed, using ephemeral ID:', e);
    cached = generateUuidV4();
    return cached;
  }
}

/**
 * Synchronous accessor — returns the cached user ID if `getUserId()` has
 * resolved at least once, otherwise null. Useful when wiring the API
 * client header inside non-async code paths.
 */
export function getUserIdSync(): string | null {
  return cached;
}
