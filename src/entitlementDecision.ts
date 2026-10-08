// The rule useEntitlement applies to combine the device's RevenueCat answer
// with the server's. Kept free of React and native modules so it can be
// unit-tested; the hook owns the fetching, state and persistence.

export interface EntitlementDecision {
  /** What the UI should show. */
  hasAllStates: boolean;
  /** A live answer arrived, so a pending boot-cache read must not overwrite it. */
  live: boolean;
  /** Safe to write to the boot cache. */
  persist: boolean;
}

/**
 * @param sdk     the device's RevenueCat SDK answer
 * @param server  the server's answer, or null when it was unreachable or could
 *                not reach RevenueCat itself (source 'rc-error')
 * @param recentlyPurchased  a purchase/restore succeeded on this device within
 *                the hint window (purchaseHint.ts)
 */
export function decideEntitlement(
  sdk: boolean,
  server: boolean | null,
  recentlyPurchased: boolean,
): EntitlementDecision {
  // The server wins on disagreement, so the chips match what the data
  // endpoints will actually allow. One exception: right after a local purchase
  // the device's receipt is the newest fact there is, and a server `false` in
  // that window is its 5-minute cache not having caught up. It must not flip
  // a paying user back to preview.
  const serverLagging = server === false && sdk === true && recentlyPurchased;
  const hasAllStates = server !== null && !serverLagging ? server : sdk;
  // SDK-false with no server answer is a total outage: neither live nor worth
  // persisting, so a cached `true` keeps protecting the user.
  const known = server !== null || sdk === true;
  return { hasAllStates, live: known, persist: known };
}
