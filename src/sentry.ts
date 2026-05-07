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
    // Performance monitoring sample rate. 10% in prod balances coverage
    // against the free-tier transaction quota (10K/month).
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    // Native crash capture is enabled by default once the Sentry config
    // plugin is in app.json (it is). No explicit toggle needed.
  });
  initialized = true;
}

export { Sentry };
