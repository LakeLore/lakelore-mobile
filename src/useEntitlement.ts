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
    const [sdkResult, serverResult] = await Promise.all([
      hasAllStatesEntitlement(),
      fetchMyEntitlement()
        .then(r => r.hasAllStates as boolean | null)
        .catch(() => null),
    ]);
    const final = serverResult !== null ? serverResult : sdkResult;
    if (mountedRef.current) {
      setHasAllStates(final);
      setLoading(false);
    }
    AsyncStorage.setItem(ENTITLEMENT_CACHE_KEY, final ? '1' : '0').catch(() => {});
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Prime from cache so the first render after a cold start matches the
    // user's last-known entitlement, not the false default. Mark `loading`
    // false too so the screen can show the correct chips immediately; the
    // background refresh below still runs and reconciles if state changed
    // (e.g. subscription lapsed while the app was closed).
    AsyncStorage.getItem(ENTITLEMENT_CACHE_KEY).then(cached => {
      if (!mountedRef.current || cached == null) return;
      setHasAllStates(cached === '1');
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
