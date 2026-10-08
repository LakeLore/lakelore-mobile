// "I just purchased" hint (2026-10-08).
//
// The server caches each user's entitlement for 5 minutes and learns about a
// purchase from a RevenueCat webhook that lands on ONE of its machines. A new
// subscriber's first requests could therefore still be answered from a cached
// "not subscribed": redacted results, or a bounce back to the paywall, right
// after paying. For a window after a successful local purchase or restore,
// requests carry X-Entitlement-Refresh: 1, which lets the server re-check a
// cached NEGATIVE with RevenueCat (never a positive — it cannot unlock
// anything), and the UI refuses to let a server "false" override the device's
// own valid receipt.
const WINDOW_MS = 10 * 60 * 1000;
let _purchasedAt = 0;

export function notePurchase(): void { _purchasedAt = Date.now(); }

export function recentlyPurchased(): boolean {
  return _purchasedAt > 0 && Date.now() - _purchasedAt < WINDOW_MS;
}

/** Test seam. */
export function _resetPurchaseHintForTests(at = 0): void { _purchasedAt = at; }
