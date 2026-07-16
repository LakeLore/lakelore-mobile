import Constants from 'expo-constants';
import { FilterState, FilterOptions, ResultsResponse, StateKey } from './types';
import { getUserId } from './userId';

// ── Server URL configuration ───────────────────────────────────────────────────
// Production builds always hit the Fly.io API. Dev builds derive the host
// from Metro's `hostUri` (e.g. "192.168.1.8:8081"), strip the port, and
// rewrite to port 3100 — the local server's port. That way LAN IP changes
// don't require a code edit; whatever IP `npx expo start` advertises just
// works. Falls back to a hardcoded LAN IP if hostUri isn't available
// (rare — happens when running through Metro tunnel mode).

const PROD_API_BASE = 'https://lake-fish-api.fly.dev';
const DEV_API_FALLBACK = 'http://192.168.1.8:3100';
const DEV_API_PORT = 3100;

function resolveDevApiBase(): string {
  // Constants.expoConfig.hostUri looks like "192.168.1.8:8081" in dev.
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return DEV_API_FALLBACK;
  const host = hostUri.split(':')[0];
  if (!host) return DEV_API_FALLBACK;
  return `http://${host}:${DEV_API_PORT}`;
}

export const API_BASE_URL: string = __DEV__ ? resolveDevApiBase() : PROD_API_BASE;

function baseUrl(state: StateKey) {
  return `${API_BASE_URL}/api/${state}`;
}

// ── Subscription error sentinel ───────────────────────────────────────────────
// Server returns 402 with `{ error: 'subscription_required', state }` for any
// non-MN state when the caller doesn't have the all-states entitlement. Callers
// can `instanceof SubscriptionRequiredError` to switch to the paywall flow.

export class SubscriptionRequiredError extends Error {
  state: StateKey;
  constructor(state: StateKey) {
    super(`Subscription required for ${state}`);
    this.name = 'SubscriptionRequiredError';
    this.state = state;
  }
}

// ── Fetch wrapper with retry, timeout, and user-friendly errors ────────────────

// Client identity signature (HMAC of the anonymous user id) — the server
// logs mismatches today and will eventually require it, raising the bar on
// spoofed X-User-Id headers. Must match LAKELORE_USER_SIG_KEY server-side.
import { hmacSha256Hex } from './userSig';

// Transient failures (cell blips, brief 5xx) get two quiet retries with
// backoff before surfacing an error banner (IMPROVEMENT_PLAN 1.15).
const RETRY_DELAYS_MS = [500, 1500];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getOnce<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const userId = await getUserId();
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'X-User-Id': userId, 'X-User-Sig': hmacSha256Hex(userId) },
    });
    if (res.status === 402) {
      // Subscription gate. Surface a typed error so callers can route to
      // the paywall instead of showing a generic "server error".
      const body = await res.json().catch(() => null);
      throw new SubscriptionRequiredError((body?.state as StateKey) ?? extractStateFromUrl(url));
    }
    if (res.status === 429) throw new Error('Slow down a moment — too many requests. Try again shortly.');
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof SubscriptionRequiredError) return false;
  if (err instanceof Error && err.name === 'AbortError') return true;
  if (err instanceof TypeError && err.message.includes('Network request failed')) return true;
  if (err instanceof Error && /Server error \(5\d\d\)/.test(err.message)) return true;
  return false;
}

async function get<T>(url: string, timeoutMs = 10_000): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await getOnce<T>(url, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === RETRY_DELAYS_MS.length) break;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  const err = lastErr;
  if (err instanceof SubscriptionRequiredError) throw err;
  if (err instanceof Error && err.name === 'AbortError') {
    throw new Error('Request timed out — check your connection');
  }
  if (err instanceof TypeError && err.message.includes('Network request failed')) {
    throw new Error('Could not reach server — check your network connection');
  }
  throw err;
}

function extractStateFromUrl(url: string): StateKey {
  const m = url.match(/\/api\/([a-z]{2})(?:\/|\?|$)/);
  return (m?.[1] as StateKey) ?? 'mn';
}

// ── API surface ───────────────────────────────────────────────────────────────

export interface DbStatus {
  ready: boolean;
  lakes?: number;
  surveys?: number;
  catches?: number;
  message?: string;
}

export async function fetchStatus(state: StateKey): Promise<DbStatus> {
  return get(`${baseUrl(state)}/status`);
}

export interface MyEntitlement {
  hasAllStates: boolean;
  expiresAt: string | null;
  source: string;
}

/**
 * Server-side entitlement check. Authoritative — matches the same RC lookup
 * the API gate uses. Call this alongside the on-device RC SDK so the UI's
 * lock chips don't disagree with what /api/{state}/results will actually
 * allow.
 */
export async function fetchMyEntitlement(): Promise<MyEntitlement> {
  return get(`${API_BASE_URL}/api/me/entitlement`);
}

export interface FeedbackPayload {
  message: string;
  state?: StateKey;
  lakeId?: number | string | null;
  lakeName?: string | null;
  species?: string | null;
  tab?: string | null;
  version?: string | null;
  build?: string | null;
}

export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  const userId = await getUserId();
  const res = await fetch(`${API_BASE_URL}/api/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Server error (${res.status})`);
  }
}

export async function fetchFilters(
  state: StateKey,
  species?: string,
  counties?: string[],
): Promise<FilterOptions> {
  const params = new URLSearchParams();
  if (species) params.set('species', species);
  if (counties && counties.length > 0) params.set('county', counties.join(','));
  const qs = params.toString();
  return get(qs ? `${baseUrl(state)}/filters?${qs}` : `${baseUrl(state)}/filters`);
}

export async function fetchResults(
  state: StateKey,
  filters: FilterState,
  page: number,
  pageSize: number,
): Promise<ResultsResponse> {
  const params = buildParams(state, filters, page, pageSize);
  return get(`${baseUrl(state)}/results?${params}`);
}

export async function fetchAllResults(
  state: StateKey,
  filters: FilterState,
): Promise<ResultsResponse> {
  const params = buildParams(state, filters, 0, 9999);
  return get(`${baseUrl(state)}/results?${params}`, 30_000); // scatter plots may fetch many rows
}

export async function fetchLakeWithSpecies(
  lakeId: number | string,
  state: StateKey,
  species: string,
): Promise<unknown> {
  // metricsV2=1 opts into absolute adults_est metrics for lakes without
  // acreage (adults_per_100ac null on those rows) — 1.0.x builds that can't
  // render nulls don't send it and keep the legacy empty-metrics payload.
  return get(`${baseUrl(state)}/lake/${lakeId}?species=${encodeURIComponent(species)}&metricsV2=1`);
}

// ── Query param builder ────────────────────────────────────────────────────────

function buildParams(
  state: StateKey,
  f: FilterState,
  page: number,
  pageSize: number,
): URLSearchParams {
  const params = new URLSearchParams({
    sortBy: f.sortBy,
    sortDir: f.sortDir,
    mostRecentOnly: String(f.mostRecentOnly),
    limit: String(pageSize),
    offset: String(page * pageSize),
  });

  if (f.species)          params.set('species', f.species);
  if (f.lakeName)         params.set('lakeName', f.lakeName);
  if (f.gearTypes.length) params.set('gear', f.gearTypes.join(','));
  if (f.minCpue)          params.set('minCpue', f.minCpue);
  if (f.maxCpue)          params.set('maxCpue', f.maxCpue);
  if (f.minYear)          params.set('minYear', f.minYear);
  if (f.maxYear)          params.set('maxYear', f.maxYear);
  if (f.counties.length)  params.set('county', f.counties.join(','));
  if (f.minAcres)         params.set('minAcres', f.minAcres);
  if (f.maxAcres)         params.set('maxAcres', f.maxAcres);
  if (f.minStocked)       params.set('minStocked', f.minStocked);
  if (f.maxStocked)       params.set('maxStocked', f.maxStocked);
  if (f.minLength)        params.set('minLength', f.minLength);
  if (f.maxLength)        params.set('maxLength', f.maxLength);
  if (f.minCatch)         params.set('minCatch', f.minCatch);
  if (f.maxCatch)         params.set('maxCatch', f.maxCatch);

  if (state === 'mn') {
    if (f.surveyTypes?.length) params.set('surveyType', f.surveyTypes.join(','));
    if (f.minWeight)           params.set('minWeight', f.minWeight);
    if (f.maxWeight)           params.set('maxWeight', f.maxWeight);
    if (f.minGearCount)        params.set('minGearCount', f.minGearCount);
    if (f.maxGearCount)        params.set('maxGearCount', f.maxGearCount);
  }

  return params;
}
