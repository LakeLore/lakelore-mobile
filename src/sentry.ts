// src/sentry.ts — Sentry initialization for the LakeLore mobile app.
//
// Captures JS errors, native crashes, and a breadcrumb trail of user
// actions before a crash. Initialized BEFORE the React tree mounts (see
// index.ts), so even errors in App startup get reported.
//
// The DSN is a write-only public ingest URL — designed to ship in the
// binary. There's no secret counterpart for Sentry; what would be a
// "secret" elsewhere is the Auth Token, which is only used during EAS
// Build for source-map upload (set as an EAS env var, never committed).
//
// Dev events are intentionally suppressed to keep the free-tier quota
// (5,000 events/month) reserved for real production issues. To verify
// integration during development, temporarily flip ENABLE_IN_DEV below.

import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';

const DSN =
  'https://fa36e03b83658996ccd1d55a0c454356@o4511350965993472.ingest.us.sentry.io/4511350972940288';

const ENABLE_IN_DEV = false;

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  if (__DEV__ && !ENABLE_IN_DEV) return;

  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',
    enableAutoSessionTracking: true,
    // OTA identity (2026-07-25, T1.3): dist distinguishes each OTA bundle so
    // "crashes by OTA" is chartable and source maps line up per update.
    // Embedded-bundle launches keep the native default (build number).
    dist: Updates.updateId ?? undefined,
    // Performance monitoring sample rate. 10% in prod balances coverage
    // against the free-tier transaction quota (10K/month).
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    // Native crash capture is enabled by default once the Sentry config
    // plugin is in app.json (it is). No explicit toggle needed.
    //
    // Privacy scrubbing (2026-07-26, store red-team #3/#5): never let the
    // ingest store a client IP, and strip query strings from network
    // breadcrumbs — search URLs embed the user's lake-name/species searches,
    // which we declare as NOT collected. (Also enable "Prevent Storing of IP
    // Addresses" in the Sentry project settings — server-side toggle.)
    beforeSend: (event) => {
      if (event.user) delete event.user.ip_address;
      return event;
    },
    beforeBreadcrumb: (breadcrumb) => {
      if ((breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') && breadcrumb.data?.url) {
        breadcrumb.data.url = String(breadcrumb.data.url).split('?')[0];
      }
      return breadcrumb;
    },
  });
  // Key crash reports to the same anonymous UUID as the API/RC identity —
  // makes the privacy policy's "keyed to the anonymous identifier" claim
  // literally true and lets a feedback report correlate with its crash.
  import('./userId').then(({ getUserId }) => getUserId().then(id => Sentry.setUser({ id }))).catch(() => {});
  Sentry.setTag('ota_update_id', Updates.updateId ?? 'embedded');
  // A fleet silently rolled back to the embedded bundle after a broken OTA
  // was previously invisible — surface every emergency launch (T1.3).
  if (Updates.isEmergencyLaunch) {
    Sentry.setTag('emergency_launch', 'true');
    Sentry.captureMessage('expo-updates emergency launch — rolled back to embedded bundle', {
      level: 'warning',
      extra: { reason: (Updates as { emergencyLaunchReason?: string | null }).emergencyLaunchReason ?? null },
    });
  }
  initialized = true;
}

export { Sentry };
