// src/iap.ts — RevenueCat integration for the LakeLore All-States subscription.
//
// API keys: paste your *public* RevenueCat platform keys into the constants
// below. They appear in the RC dashboard under Project Settings → API Keys
// after you link the iOS and Android apps. These keys are designed to ship
// in the binary. The *secret* REST API key never goes in this file — it
// lives only as a Fly secret on the server.
//
// While the keys are empty strings, this module degrades gracefully:
// `isIapConfigured()` returns false and every other call no-ops. The app
// continues to run without a paywall, which lets development proceed
// before you've finished the RC + Apple/Google product setup.

import { Platform } from 'react-native';
import Purchases, {
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

// ── Configuration ──────────────────────────────────────────────────────────
// During RC dashboard onboarding, both platforms share the project-level
// `test_*` key — it lets `configure()` succeed and proves the SDK wiring
// before any platform is linked. Once you finish Apple/Google enrollment
// and link iOS + Android apps in RC, replace each with the real
// platform-specific public key (`appl_…` / `goog_…`).
const APPLE_PUBLIC_KEY  = 'test_dZCCVGGeZrUTSYjetHnOZTGEiOb';
const GOOGLE_PUBLIC_KEY = 'test_dZCCVGGeZrUTSYjetHnOZTGEiOb';

// Identifiers configured in the RevenueCat dashboard.
// The entitlement identifier matches what's in the RC dashboard literally —
// including the space and mixed case. RC entitlement identifiers are
// immutable once created, so we conform here rather than in the dashboard.
export const ALL_STATES_ENTITLEMENT = 'LakeLore All-States';
const OFFERING_ID = 'default';

// ── State ──────────────────────────────────────────────────────────────────

let initialized = false;

function getApiKey(): string | null {
  if (Platform.OS === 'ios')     return APPLE_PUBLIC_KEY  || null;
  if (Platform.OS === 'android') return GOOGLE_PUBLIC_KEY || null;
  return null;
}

/** True if a platform-specific RevenueCat key is configured. */
export function isIapConfigured(): boolean {
  return !!getApiKey();
}

/**
 * Initialize the RevenueCat SDK. Safe to call multiple times — only the
 * first call configures Purchases. No-ops if no key is configured for the
 * current platform, so the app still launches in environments where IAP
 * is intentionally disabled (Expo Go, web, dev with no keys).
 */
export async function initIAP(): Promise<void> {
  if (initialized) return;
  const key = getApiKey();
  if (!key) {
    if (__DEV__) console.warn(`[iap] no RevenueCat key for ${Platform.OS} — paywall disabled`);
    return;
  }
  try {
    if (__DEV__) Purchases.setLogLevel(Purchases.LOG_LEVEL.WARN);
    await Purchases.configure({ apiKey: key });
    initialized = true;
    if (__DEV__) console.log('[iap] RevenueCat initialized');
  } catch (e) {
    console.warn('[iap] configure failed:', e);
  }
}

/**
 * Return the App User ID RevenueCat is using. For an anonymous user this
 * is an `$RCAnonymousID:...` string that persists across launches. We send
 * this as `X-User-Id` on every API request so the server can check
 * entitlement against the same identity.
 */
export async function getUserId(): Promise<string | null> {
  if (!isIapConfigured()) return null;
  try {
    return await Purchases.getAppUserID();
  } catch {
    return null;
  }
}

/**
 * Fetch the active offering (the "default" offering with the annual
 * package). Returns null if RC is not configured or the offering hasn't
 * been published yet on the dashboard.
 */
export async function getOffering(): Promise<PurchasesOffering | null> {
  if (!isIapConfigured()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.all[OFFERING_ID] ?? offerings.current ?? null;
  } catch (e) {
    if (__DEV__) console.warn('[iap] getOfferings failed:', e);
    return null;
  }
}

/**
 * Best-effort check: does this user currently have the all-states
 * entitlement? Returns false if RC isn't configured. The server is the
 * authoritative source — this is for UI state only (e.g. hide the
 * paywall promo when already subscribed).
 */
export async function hasAllStatesEntitlement(): Promise<boolean> {
  if (!isIapConfigured()) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info.entitlements.active[ALL_STATES_ENTITLEMENT];
  } catch (e) {
    if (__DEV__) console.warn('[iap] getCustomerInfo failed:', e);
    return false;
  }
}

/**
 * Trigger the purchase flow for a given package (typically the annual
 * package from the default offering). Returns `{ ok: true }` on success,
 * `{ cancelled: true }` if the user dismissed the system sheet, or
 * `{ error: string }` on failure.
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<{ ok: true } | { cancelled: true } | { error: string }> {
  if (!isIapConfigured()) return { error: 'iap_not_configured' };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const granted = !!customerInfo.entitlements.active[ALL_STATES_ENTITLEMENT];
    return granted ? { ok: true } : { error: 'entitlement_not_active' };
  } catch (e: any) {
    if (e?.userCancelled) return { cancelled: true };
    return { error: e?.message ?? 'unknown' };
  }
}

/**
 * Restore a prior purchase (e.g. after reinstall on a new device). Returns
 * true if the user now has the all-states entitlement.
 */
export async function restorePurchases(): Promise<boolean> {
  if (!isIapConfigured()) return false;
  try {
    const info = await Purchases.restorePurchases();
    return !!info.entitlements.active[ALL_STATES_ENTITLEMENT];
  } catch (e) {
    if (__DEV__) console.warn('[iap] restorePurchases failed:', e);
    return false;
  }
}
