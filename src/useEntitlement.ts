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
import Purchases, { type CustomerInfo } from 'react-native-purchases';
import {
  ALL_STATES_ENTITLEMENT,
  hasAllStatesEntitlement,
  isIapConfigured,
} from './iap';

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
    const result = await hasAllStatesEntitlement();
    if (mountedRef.current) {
      setHasAllStates(result);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    // Subscribe to RC customer info updates — fires after purchase, restore,
    // or any backend-pushed change. Lets the UI flip to "subscribed" state
    // the instant the purchase sheet closes.
    let unsubscribe: (() => void) | undefined;
    if (isIapConfigured()) {
      const listener = (info: CustomerInfo) => {
        if (!mountedRef.current) return;
        setHasAllStates(!!info.entitlements.active[ALL_STATES_ENTITLEMENT]);
        setLoading(false);
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
