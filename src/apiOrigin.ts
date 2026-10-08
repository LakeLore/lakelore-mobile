// API origin selection with failover (2026-10-08).
//
// Every binary through 1.1.1 hard-coded https://lake-fish-api.fly.dev — a host
// we rent, not own. A provider move, an app rename or an account problem would
// have stranded every installed app, and the kill switch (UpdateGate) with it,
// because the only place to announce the move was the dead host.
//
// From 1.1.2 the app prefers a hostname on OUR domain and keeps the Fly
// hostname as a fallback, so either can go away without a store release. A
// failure of the ORIGIN (DNS, TLS, refused, timeout, or an answer that is not
// the API) rotates to the next one; an API error response never does — a
// server that answers is a server that is up.
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from './storage';

const PROD_ORIGINS = ['https://api.lakeloreapp.com', 'https://lake-fish-api.fly.dev'] as const;
const DEV_API_FALLBACK = 'http://192.168.1.8:3100';
const DEV_API_PORT = 3100;

// Release-build server override (2026-09-11): the `staging` EAS profile bakes
// EXPO_PUBLIC_API_BASE=https://lake-fish-api-staging.fly.dev in at build time
// so a TestFlight build can exercise unreleased server code + data. Production
// builds set nothing. Only https origins are honored — a typo in eas.json
// can't silently point a store build at plain http.
function releaseOrigins(): readonly string[] {
  const override = process.env.EXPO_PUBLIC_API_BASE;
  if (override && /^https:\/\/[a-z0-9.-]+$/i.test(override)) return [override];
  return PROD_ORIGINS;
}

// Dev builds derive the host from Metro's `hostUri` (e.g. "192.168.1.8:8081")
// and rewrite to the local server's port, so LAN IP changes need no code edit.
function devOrigins(): readonly string[] {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return [host ? `http://${host}:${DEV_API_PORT}` : DEV_API_FALLBACK];
}

export const API_ORIGINS: readonly string[] = __DEV__ ? devOrigins() : releaseOrigins();

/** Stable name for "the server behind these origins". Session tokens are bound
 *  to it rather than to whichever origin answered: the production hostnames
 *  are one server with one signing secret, so failing over must not discard
 *  a valid token. It is the LAST origin — for production that is the Fly
 *  hostname, which is also what tokens minted by 1.1.1 and earlier carry. */
export const SERVER_KEY: string = API_ORIGINS[API_ORIGINS.length - 1];

export const IS_PROD_API: boolean = API_ORIGINS === PROD_ORIGINS;

let _active = 0;
// Which origins have answered (any HTTP response) since launch, and the one
// that answered last time the app ran (persisted). An origin with a track
// record is not abandoned on a single failure: weak signal at the lake makes
// a good origin time out, and rotating on the first timeout would hand the
// next attempt to a host that may not exist at all — one real try out of
// three instead of three. An origin with NO track record is abandoned at
// once, which is what makes a dead primary cost one fast failure, once.
const _answered = new Set<string>();
let _lastGood: string | null = null;
let _strikes = 0;

/** The origin requests should use right now. */
export function apiBase(): string {
  return API_ORIGINS[_active];
}

/** Record that `base` returned an HTTP response from the API. */
export function noteAnswered(base: string): void {
  if (base === API_ORIGINS[_active]) _strikes = 0;
  if (_answered.has(base)) return;
  _answered.add(base);
  if (base !== _lastGood) {
    _lastGood = base;
    AsyncStorage.setItem(KEYS.lastGoodOrigin, base).catch(() => {});
  }
}

/** Start from the origin that worked last launch (once, at boot). Bounded so a
 *  never-settling native read can't hold up the first request. */
let _hydrating: Promise<void> | null = null;
export function hydrateOrigin(): Promise<void> {
  if (!_hydrating) {
    let guard: ReturnType<typeof setTimeout> | undefined;
    _hydrating = Promise.race([
      AsyncStorage.getItem(KEYS.lastGoodOrigin),
      new Promise<string | null>(resolve => { guard = setTimeout(() => resolve(null), 1000); }),
    ]).then(saved => {
      const idx = saved ? API_ORIGINS.indexOf(saved) : -1;
      // Only before anything has been learned this session.
      if (idx >= 0 && _answered.size === 0 && _strikes === 0) { _lastGood = saved; _active = idx; }
    }).catch(() => {}).finally(() => clearTimeout(guard));
  }
  return _hydrating;
}

/** Report a failure of the ORIGIN (unreachable, or answering as something that
 *  is not the API) against `failedBase`. Rotates to the next origin once the
 *  active one has used up its allowance: one strike if it has no track record,
 *  two if it has answered this session or last launch. Concurrent requests
 *  that failed on an origin we already left do nothing. Returns true if a
 *  different origin is now active. */
export function failoverFrom(failedBase: string): boolean {
  if (API_ORIGINS.length < 2 || failedBase !== API_ORIGINS[_active]) return false;
  const trusted = _answered.has(failedBase) || failedBase === _lastGood;
  _strikes += 1;
  if (_strikes < (trusted ? 2 : 1)) return false;
  _strikes = 0;
  _active = (_active + 1) % API_ORIGINS.length;
  return true;
}

/** True for the failures that say "this ORIGIN is unreachable", as opposed to
 *  "the server answered with an error". */
export function isNetworkFailure(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') return true;
  return err instanceof TypeError && /Network request (failed|timed out)/.test(err.message);
}

/** An origin answered, but not as the API (a parked page, a proxy error, the
 *  marketing site on a mispointed record): no JSON content type. Without this
 *  a wrong DNS record on the owned hostname would pin every app to it while
 *  the fallback sat healthy. Only meaningful when there is another origin. */
export function looksLikeWrongHost(res: { headers?: { get?: (k: string) => string | null } }): boolean {
  if (API_ORIGINS.length < 2) return false;
  const type = res.headers?.get?.('content-type');
  return typeof type === 'string' && !/json/i.test(type);
}

/** Test seam. */
export function _resetOriginForTests(): void {
  _active = 0; _strikes = 0; _lastGood = null; _hydrating = null; _answered.clear();
}
