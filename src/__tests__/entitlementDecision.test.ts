import { decideEntitlement } from '../entitlementDecision';
import { notePurchase, recentlyPurchased, _resetPurchaseHintForTests } from '../purchaseHint';

describe('decideEntitlement', () => {
  it('lets the server win when it disagrees with the device', () => {
    expect(decideEntitlement(true, false, false).hasAllStates).toBe(false);
    expect(decideEntitlement(false, true, false).hasAllStates).toBe(true);
  });

  it('keeps a just-purchased user unlocked when the server still says no', () => {
    expect(decideEntitlement(true, false, true)).toEqual({ hasAllStates: true, live: true, persist: true });
  });

  it('never unlocks from the purchase hint alone', () => {
    // The hint only protects a device receipt; without one the server's no stands.
    expect(decideEntitlement(false, false, true).hasAllStates).toBe(false);
  });

  it('falls back to the device when the server gave no answer', () => {
    expect(decideEntitlement(true, null, false)).toEqual({ hasAllStates: true, live: true, persist: true });
  });

  it('does not persist or mark live the false of a total outage', () => {
    expect(decideEntitlement(false, null, false)).toEqual({ hasAllStates: false, live: false, persist: false });
  });

  it('persists a real server denial', () => {
    expect(decideEntitlement(false, false, false)).toEqual({ hasAllStates: false, live: true, persist: true });
  });
});

describe('purchase hint window', () => {
  afterEach(() => _resetPurchaseHintForTests());

  it('is off until a purchase is noted', () => {
    expect(recentlyPurchased()).toBe(false);
    notePurchase();
    expect(recentlyPurchased()).toBe(true);
  });

  it('expires after ten minutes', () => {
    _resetPurchaseHintForTests(Date.now() - 9 * 60 * 1000);
    expect(recentlyPurchased()).toBe(true);
    _resetPurchaseHintForTests(Date.now() - 11 * 60 * 1000);
    expect(recentlyPurchased()).toBe(false);
  });
});
