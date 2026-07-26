// src/useEntitlement.ts — React hook exposing the user's all-states
// entitlement state. Reads from the RevenueCat SDK (the local source of
// truth on the device) and re-fetches on:
//
//   - mount,
//   - app foreground,
//   - RevenueCat customer-info updates (e.g. after a purchase or restore).
//
// The server is the *authoritative* source of entitlement (so a hostile
// client can't lie its way past the API gate), but for UI purposes the
// device's RC SDK state is the right thing to render against. They
// converge once the server's webhook-driven cache catches up.

import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, { type CustomerInfo } from 'react-native-purchases';
import {
  ALL_STATES_ENTITLEMENT,
  hasAllStatesEntitlement,
  isIapConfigured,
} from './iap';
import { fetchMyEntitlement } from './api';

// Cache the last-known entitlement so subsequent app launches render the
// correct lock/unlock chips immediately, instead of flashing "locked" while
// the RC SDK + server round-trip resolves. Server is still authoritative on
// every refresh — this only primes the initial UI.
const ENTITLEMENT_CACHE_KEY = 'entitlement.allStates.v1';
// v2 (2026-07-25, T3.14): the cached flag now carries a timestamp and is
// ignored past 7 days — a lapsed subscriber cold-launching offline used to
// see unlocked chips indefinitely (cosmetic only: the server still redacts).
const ENTITLEMENT_CACHE_KEY_V2 = 'entitlement.allStates.v2';
const ENTITLEMENT_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface EntitlementState {
  hasAllStates: boolean;
  loading: boolean;
  /** Manually re-check entitlement (e.g. after a purchase completes). */
  refresh: () => Promise<void>;
}

export function useEntitlement(): EntitlementState {
  const [hasAllStates, setHasAllStates] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    // Two checks in parallel: the on-device RC SDK (instant, but can be
    // stale e.g. after a sandbox sub lapses) and the server's authoritative
    // /api/me/entitlement (matches the same RC lookup the API gate uses).
    //
    // Server wins on disagreement so the lock chips on State Select match
    // what the data endpoints will actually allow. Falls back to the SDK
    // result if the server is unreachable, so the app keeps working offline.
    //
    // Exception: source 'rc-error' means the SERVER couldn't reach RevenueCat
    // (and had no grace record) — its `false` is an outage artifact, not a
    // denial. Trusting it over the device's valid receipt locked paying
    // subscribers out during RC outages; treat it like an unreachable server.
    const [sdkResult, serverResult] = await Promise.all([
      hasAllStatesEntitlement(),
      fetchMyEntitlement()
        .then(r => (r.source === 'rc-error' ? null : (r.hasAllStates as boolean | null)))
        .catch(() => null),
    ]);
    const final = serverResult !== null ? serverResult : sdkResult;
    if (mountedRef.current) {
      setHasAllStates(final);
      setLoading(false);
    }
    AsyncStorage.setItem(ENTITLEMENT_CACHE_KEY_V2, JSON.stringify({ v: final, ts: Date.now() })).catch(() => {});
    AsyncStorage.removeItem(ENTITLEMENT_CACHE_KEY).catch(() => {}); // retire the v1 key
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Prime from cache so the first render after a cold start matches the
    // user's last-known entitlement, not the false default. Mark `loading`
    // false too so the screen can show the correct chips immediately; the
    // background refresh below still runs and reconciles if state changed
    // (e.g. subscription lapsed while the app was closed).
    AsyncStorage.getItem(ENTITLEMENT_CACHE_KEY_V2).then(cached => {
      if (!mountedRef.current || cached == null) return;
      const entry = JSON.parse(cached) as { v: boolean; ts: number };
      if (entry?.ts && Date.now() - entry.ts > ENTITLEMENT_CACHE_MAX_AGE_MS) return; // too old to prime
      setHasAllStates(!!entry.v);
      setLoading(false);
    }).catch(() => {});

    refresh();

    // Subscribe to RC customer info updates — fires after purchase, restore,
    // or any backend-pushed change. Lets the UI flip to "subscribed" state
    // the instant the purchase sheet closes.
    let unsubscribe: (() => void) | undefined;
    if (isIapConfigured()) {
      const listener = (info: CustomerInfo) => {
        if (!mountedRef.current) return;
        const next = !!info.entitlements.active[ALL_STATES_ENTITLEMENT];
        setHasAllStates(next);
        setLoading(false);
        AsyncStorage.setItem(ENTITLEMENT_CACHE_KEY, next ? '1' : '0').catch(() => {});
        // Fire-and-forget prime of the server's per-user entitlement cache.
        // Server caches per-user for 5 min; without this prime, the user can
        // buy a subscription, return to a paid-state search, and get bounced
        // back to the paywall on a stale "false" until the TTL expires.
        // PaywallScreen also awaits this synchronously around the purchase
        // flow — this is the belt-and-suspenders path for background syncs.
        fetchMyEntitlement().catch(() => {});
      };
      Purchases.addCustomerInfoUpdateListener(listener);
      unsubscribe = () => Purchases.removeCustomerInfoUpdateListener(listener);
    }

    // Re-check whenever the app comes back to the foreground — handles the
    // "user managed subscription externally" case (cancellation in iOS
    // Settings, refund, etc.).
    const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') refresh();
    });

    return () => {
      mountedRef.current = false;
      unsubscribe?.();
      appStateSub.remove();
    };
  }, [refresh]);

  return { hasAllStates, loading, refresh };
}
