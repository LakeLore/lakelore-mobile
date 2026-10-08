import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { FilterState, FilterOptions, MeasureResponse, ResultsResponse, StateKey } from './types';
import { getUserId } from './userId';

// Client version identity (2026-07-25, T1.2): rides every request so the
// server can histogram the fleet ([ver] hourly line) — the measurable
// precondition for the REQUIRE_USER_SIG/TOKEN/ATTEST enforcement flips.
// updateId identifies the OTA bundle (null on the embedded bundle / in dev).
export const APP_VERSION = `${Application.nativeApplicationVersion ?? '0'}+${Application.nativeBuildVersion ?? '0'}`;
export const OTA_UPDATE_ID: string | null = Updates.updateId ?? null;

// ── Server URL configuration ───────────────────────────────────────────────────
// Origin selection + failover live in ./apiOrigin. Requests are addressed by
// PATH ("/api/mn/results?…") and the origin is resolved per attempt, so a retry
// after a failover goes to the next origin instead of the one that just failed.
import { apiBase, failoverFrom, hydrateOrigin, isNetworkFailure, looksLikeWrongHost, noteAnswered, IS_PROD_API } from './apiOrigin';
import { recentlyPurchased } from './purchaseHint';
export { IS_PROD_API };

function statePath(state: StateKey) {
  return `/api/${state}`;
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
import { getSessionToken, invalidateSessionToken, waitForSessionToken } from './session';

// A 401 is never a user-facing condition: it means the server wants a session
// token we don't hold yet (enforcement on, token still minting) or no longer
// accepts the one we sent (rotated secret, different server). Drop a rejected
// token, then let get() wait for a fresh one and retry.
// The active origin answered, but not as the API (see looksLikeWrongHost).
// Retryable: the origin has been failed over, so the next attempt goes
// elsewhere.
class WrongHostError extends Error {
  constructor() { super('Server error (502)'); this.name = 'WrongHostError'; }
}
/** Classify a response's ORIGIN before reading it as an API answer. */
function checkOrigin(res: Response, base: string): void {
  if (looksLikeWrongHost(res)) { failoverFrom(base); throw new WrongHostError(); }
  noteAnswered(base);
}

class UnauthorizedError extends Error {
  constructor() { super('unauthorized'); this.name = 'UnauthorizedError'; }
}
function handleUnauthorized(res: Response, hadToken: boolean): void {
  if (res.status !== 401) return;
  if (hadToken) invalidateSessionToken();
  throw new UnauthorizedError();
}

// A state this bundle lists but the server no longer serves (pulled for
// licensing, or held) answers 400 "Unknown state". Typed so screens can say
// so and send the user to the picker, instead of a Retry that can never work.
export class StateUnavailableError extends Error {
  state: StateKey;
  constructor(state: StateKey) {
    super('This state is no longer available in LakeLore.');
    this.name = 'StateUnavailableError';
    this.state = state;
  }
}

// Standard identity headers for every request (GET and POST alike).
async function identityHeaders(): Promise<{ headers: Record<string, string>; hadToken: boolean }> {
  const userId = await getUserId();
  const headers: Record<string, string> = {
    'X-User-Id': userId,
    'X-User-Sig': hmacSha256Hex(userId),
    'X-App-Version': APP_VERSION,
  };
  if (OTA_UPDATE_ID) headers['X-Update-Id'] = OTA_UPDATE_ID;
  // Server-signed session token (see src/session.ts) — authoritative
  // identity when present; legacy headers remain the fallback.
  const token = getSessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (recentlyPurchased()) headers['X-Entitlement-Refresh'] = '1';
  return { headers, hadToken: !!token };
}

// Transient failures (cell blips, brief 5xx) get two quiet retries with
// backoff before surfacing an error banner (IMPROVEMENT_PLAN 1.15).
const RETRY_DELAYS_MS = [500, 1500];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getOnce<T>(path: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await hydrateOrigin();
    const base = apiBase();
    const { headers, hadToken } = await identityHeaders();
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, { signal: controller.signal, headers });
    } catch (err) {
      // Unreachable origin → counts against it (apiOrigin decides when to move).
      if (isNetworkFailure(err)) failoverFrom(base);
      throw err;
    }
    checkOrigin(res, base);
    if (res.status === 402) {
      // Subscription gate. Surface a typed error so callers can route to
      // the paywall instead of showing a generic "server error".
      const body = await res.json().catch(() => null);
      throw new SubscriptionRequiredError((body?.state as StateKey) ?? extractStateFromUrl(path));
    }
    if (res.status === 429) throw new Error('Slow down a moment — too many requests. Try again shortly.');
    handleUnauthorized(res, hadToken);
    if (res.status === 400) {
      const body = await res.json().catch(() => null);
      if (typeof body?.error === 'string' && body.error.startsWith('Unknown state')) {
        throw new StateUnavailableError(extractStateFromUrl(path));
      }
      throw new Error('Server error (400)');
    }
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof SubscriptionRequiredError) return false;
  if (err instanceof StateUnavailableError) return false;
  if (err instanceof UnauthorizedError) return true;
  if (err instanceof WrongHostError) return true;
  if (isNetworkFailure(err)) return true;
  if (err instanceof Error && /Server error \(5\d\d\)/.test(err.message)) return true;
  return false;
}

// How long a request waits for a session token after a 401 before retrying.
const TOKEN_WAIT_MS = 5_000;

async function get<T>(path: string, timeoutMs = 10_000): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await getOnce<T>(path, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === RETRY_DELAYS_MS.length) break;
      // After a 401 the useful wait is "until a token exists", not a fixed
      // backoff: with LAKELORE_REQUIRE_TOKEN on, a retry without a token is
      // just a second 401.
      if (err instanceof UnauthorizedError) await waitForSessionToken(TOKEN_WAIT_MS);
      else await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  const err = lastErr;
  if (err instanceof SubscriptionRequiredError) throw err;
  if (err instanceof UnauthorizedError) throw new Error('Session refused by the server — try again in a moment');
  if (err instanceof Error && err.name === 'AbortError') {
    throw new Error('Request timed out — check your connection');
  }
  if (isNetworkFailure(err) || err instanceof WrongHostError) {
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
  return get(`${statePath(state)}/status`);
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
  return get('/api/me/entitlement');
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
  updateId?: string | null;
}

export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  // Full header set (bug-hunt #2): a bare X-User-Id POST counted as
  // "unsigned pre-1.1.1 fleet" in the server's drain telemetry and would 401
  // the day LAKELORE_REQUIRE_TOKEN flips. Timeout (bug-hunt #6): a bare RN
  // fetch can hang for minutes on dead air, wedging the Send button.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  const { headers, hadToken } = await identityHeaders();
  headers['Content-Type'] = 'application/json';
  const base = apiBase();
  let res: Response;
  try {
    res = await fetch(`${base}/api/feedback`, {
      method: 'POST',
      signal: controller.signal,
      headers,
    // updateId identifies the exact OTA bundle the report came from (T1.4);
    // callers can override but never need to set it.
      body: JSON.stringify({ updateId: OTA_UPDATE_ID, ...payload }),
    });
  } catch (err) {
    if (isNetworkFailure(err)) failoverFrom(base);
    // Raw AbortError toasts as "Aborted" (round-2 A2) — translate.
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out — check your connection');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  try { checkOrigin(res, base); } catch { throw new Error('Could not reach server — check your network connection'); }
  if (res.status === 401) {
    if (hadToken) invalidateSessionToken();
    await waitForSessionToken(TOKEN_WAIT_MS);
    throw new Error('Session refreshed — please send again.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Server error (${res.status})`);
  }
}

// ── Ask LakeLore (POST /api/:state/ask, 2026-09-10) ──────────────────────────
// Stateless chat: the client sends the whole conversation each turn (plain
// strings, assistant turns WITHOUT lake markers) and gets back the answer with
// [[lake_id|Name]] markers plus the lake rows those markers reference.

export interface AskMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskLake {
  lake_id: string;
  lake_name: string | null;
  county?: string | null;
  acres?: number | null;
  max_depth_ft?: number | null;
  species?: string;         // display name
  species_native?: string;  // wire value — what LakeDetail's route wants
  survey_year?: number | null;
  gear?: string | null;
  cpue?: number | null;
  total_catch?: number | null;
  avg_weight_lb?: number | null;
  avg_length_in?: number | null;
  rating?: string | null;
  stocked_adults_per_100ac?: number | null;
  stocked_adults_est?: number | null;
}

export interface AskResponse {
  answer: string;       // with [[lake_id|Name]] markers
  answer_text: string;  // markers replaced by names — send this back as history
  lakes: AskLake[];
  usage?: { model?: string; ms?: number; tool_calls?: number };
}

export async function askLakes(state: StateKey, messages: AskMessage[]): Promise<AskResponse> {
  const controller = new AbortController();
  // An ask runs a multi-step model loop server-side; 60 s is generous but the
  // typical answer lands well under 20 s.
  const timer = setTimeout(() => controller.abort(), 60_000);
  const { headers, hadToken } = await identityHeaders();
  headers['Content-Type'] = 'application/json';
  // Staging closes /ask behind a shared token (server LAKELORE_ASK_TOKEN). Set
  // EXPO_PUBLIC_ASK_TOKEN for dev/staging builds only: anything EXPO_PUBLIC_ is
  // readable in the bundle, so it must never be set for a store build.
  const askToken = process.env.EXPO_PUBLIC_ASK_TOKEN;
  if (askToken) headers['X-Ask-Token'] = askToken;
  const base = apiBase();
  let res: Response;
  try {
    res = await fetch(`${base}${statePath(state)}/ask`, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify({ messages }),
    });
  } catch (err) {
    if (isNetworkFailure(err)) failoverFrom(base);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('The assistant took too long — try a narrower question.');
    }
    if (err instanceof TypeError && err.message.includes('Network request failed')) {
      throw new Error('Could not reach server — check your network connection');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  try { checkOrigin(res, base); } catch { throw new Error('Could not reach server — check your network connection'); }
  if (res.status === 402) throw new SubscriptionRequiredError(state);
  if (res.status === 401) {
    if (hadToken) invalidateSessionToken();
    await waitForSessionToken(TOKEN_WAIT_MS);
    throw new Error('Session refreshed — send that again.');
  }
  if (res.status === 429) throw new Error('You’ve asked a lot this hour — try again a little later.');
  if (res.status === 503) throw new Error('The assistant isn’t available right now.');
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? body?.error ?? `Server error (${res.status})`);
  }
  return res.json() as Promise<AskResponse>;
}

// ── Lake-name typeahead (2026-09-13) ─────────────────────────────────────────
// The public per-state lakes index (names + counts, no metrics — the same
// endpoint the marketing site uses). Fetched once per state and cached for
// the session; the Advanced Filters lake-name field filters it locally.
export interface LakeIndexEntry { id: string | number; name: string; county?: string | null }
const _lakeIndexCache = new Map<StateKey, LakeIndexEntry[]>();
export async function fetchLakesIndex(state: StateKey): Promise<LakeIndexEntry[]> {
  const hit = _lakeIndexCache.get(state);
  if (hit) return hit;
  const resp = await get<{ lakes: LakeIndexEntry[] }>(`${statePath(state)}/lakes-index`, 20_000);
  const lakes = (resp.lakes ?? []).filter(l => !!l.name);
  _lakeIndexCache.set(state, lakes);
  return lakes;
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
  return get(qs ? `${statePath(state)}/filters?${qs}` : `${statePath(state)}/filters`);
}

// Measure × Gear/Source manifest (DATA_MODEL_PROPOSAL_2026-07-20). Returns the
// measures with data in the current species×county scope, in cascade order, each
// with its nested Gear/Source options. Older servers 404 this route — callers
// treat a failure as "no measures" and fall back to the legacy sortOptions +
// defaultGear behavior.
export async function fetchMeasures(
  state: StateKey,
  species?: string,
  counties?: string[],
): Promise<MeasureResponse> {
  const params = new URLSearchParams();
  if (species) params.set('species', species);
  if (counties && counties.length > 0) params.set('county', counties.join(','));
  const qs = params.toString();
  return get(qs ? `${statePath(state)}/measures?${qs}` : `${statePath(state)}/measures`);
}

export async function fetchResults(
  state: StateKey,
  filters: FilterState,
  page: number,
  pageSize: number,
): Promise<ResultsResponse> {
  const params = buildParams(state, filters, page, pageSize);
  return get(`${statePath(state)}/results?${params}`);
}

// The server's REAL per-request row cap — it silently truncated the old 9999
// ask anyway (2026-07-25, T3.15). Asking for the honest number keeps client
// and server agreeing on what "all" means for the scatter; exported so the
// scatter's truncation caption names the same number.
export const SCATTER_ROW_CAP = 500;

export async function fetchAllResults(
  state: StateKey,
  filters: FilterState,
): Promise<ResultsResponse> {
  const params = buildParams(state, filters, 0, SCATTER_ROW_CAP);
  return get(`${statePath(state)}/results?${params}`, 30_000); // scatter plots may fetch many rows
}

export async function fetchLakeWithSpecies(
  lakeId: number | string,
  state: StateKey,
  species: string,
): Promise<unknown> {
  // metricsV2=1 opts into absolute adults_est metrics for lakes without
  // acreage (adults_per_100ac null on those rows) — 1.0.x builds that can't
  // render nulls don't send it and keep the legacy empty-metrics payload.
  return get(`${statePath(state)}/lake/${lakeId}?species=${encodeURIComponent(species)}&metricsV2=1`);
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
  // Measure/Source scope. presenceUnion → derived-union path (Presence measure);
  // stockingFirst → stocking-metrics path (Stocking Impact); cpueKind confines a
  // `normalized` abundance source (2026-07-25: relative/creel are now per-gear
  // sources and use the gear filter below, not cpueKind); a gear source uses the
  // gear filter below.
  if (f.presenceUnion)    params.set('presenceUnion', '1');
  if (f.stockingFirst)    params.set('stockingFirst', '1');
  if (f.cpueKind)         params.set('cpueKind', f.cpueKind);
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
  if (f.minTrophy)        params.set('minTrophy', f.minTrophy);
  if (f.maxTrophy)        params.set('maxTrophy', f.maxTrophy);
  if (f.maxCatch)         params.set('maxCatch', f.maxCatch);

  if (state === 'mn') {
    // MN "Survey Type" (Standard vs Targeted) removed per DATA_MODEL §4 — no
    // longer sent even though the server still accepts it.
    if (f.minWeight)           params.set('minWeight', f.minWeight);
    if (f.maxWeight)           params.set('maxWeight', f.maxWeight);
    if (f.minGearCount)        params.set('minGearCount', f.minGearCount);
    if (f.maxGearCount)        params.set('maxGearCount', f.maxGearCount);
  }

  return params;
}
