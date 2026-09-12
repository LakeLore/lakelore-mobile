// Session tokens (IMPROVEMENT_PLAN 1.8 long-term item): the app exchanges
// its (userId, client signature) for a server-signed 7-day token and sends
// it as Authorization: Bearer on every API call. The server treats a valid
// token as the authoritative identity; the legacy X-User-Id header remains
// the fallback until enforcement flips (LAKELORE_REQUIRE_TOKEN=1).
// Failure-soft by design: if issuance fails, requests proceed on the legacy
// headers alone — never block a fisherman on an auth round trip.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserId } from './userId';
import { hmacSha256Hex } from './userSig';
import { getAttestation } from './attest';
import { KEYS } from './storage';

const STORE_KEY = KEYS.sessionToken;
// Refresh when less than a day of validity remains.
const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;

// `base` = the server that minted the token (2026-09-12). Tokens are signed
// with a per-server secret, so a token minted by production is garbage to
// staging (and vice versa) — every request 401s until it expires, up to 7
// days, with no recovery path. A token whose base doesn't match the server
// we're talking to is discarded and re-minted. Legacy disk records have no
// `base`; they're treated as foreign once, which costs one re-mint.
let _cached: { token: string; exp: number; base: string } = { token: '', exp: 0, base: '' };
let _hydrated = false;
let _hydrating: Promise<void> | null = null;
let _inflight: Promise<void> | null = null;

// One-time disk hydrate. Only adopts the disk copy if it is NEWER than
// whatever is in memory — so a refresh() that completed while the read was
// in flight can no longer be clobbered by the stale disk value (the
// 2026-07-25 T1.5 race). Refresh decisions WAIT for hydration, so a valid
// 7-day token on disk now actually prevents the cold-launch re-mint (and
// with it the per-launch App Attest attestation).
function hydrate(): Promise<void> {
  if (!_hydrating) {
    // 3 s race guard (bug-hunt #7): a never-settling native read must not
    // permanently gate every refresh decision behind an unresolved promise.
    _hydrating = Promise.race([
      AsyncStorage.getItem(STORE_KEY),
      new Promise<string | null>(resolve => setTimeout(() => resolve(null), 3000)),
    ])
      .then(raw => {
        if (raw) {
          const disk = JSON.parse(raw) as { token?: string; exp?: number; base?: string };
          if (disk?.token && (disk.exp ?? 0) > _cached.exp) {
            _cached = { token: disk.token, exp: disk.exp ?? 0, base: disk.base ?? '' };
          }
        }
      })
      .catch(() => {})
      .finally(() => { _hydrated = true; });
  }
  return _hydrating;
}

function maybeRefresh(baseUrl: string): void {
  const fresh = _cached.token && _cached.base === baseUrl
    && _cached.exp - Date.now() > REFRESH_MARGIN_MS;
  if (!fresh && !_inflight) {
    _inflight = refresh(baseUrl)
      .catch(() => {})
      .finally(() => { _inflight = null; });
  }
}

async function refresh(baseUrl: string): Promise<void> {
  const userId = await getUserId();
  const headers: Record<string, string> = {
    'X-User-Id': userId,
    'X-User-Sig': hmacSha256Hex(userId),
  };
  // Platform attestation (src/attest.ts): fetch a server challenge, have the
  // OS attest it, and attach the proof. Every step is failure-soft — any
  // hiccup falls back to an unattested session request.
  let attBody: string | undefined;
  try {
    const chRes = await fetch(`${baseUrl}/api/session/challenge`, { headers });
    if (chRes.ok) {
      const { challenge } = await chRes.json();
      const att = challenge ? await getAttestation(challenge) : null;
      if (att) {
        attBody = JSON.stringify(att);
        headers['Content-Type'] = 'application/json';
      }
    }
  } catch {}
  const res = await fetch(`${baseUrl}/api/session`, { method: 'POST', headers, body: attBody });
  if (!res.ok) throw new Error(`session ${res.status}`);
  const body = await res.json();
  if (!body?.token) throw new Error('session: no token');
  _cached = { token: body.token, exp: Date.now() + (body.expiresIn ?? 0) * 1000, base: baseUrl };
  AsyncStorage.setItem(STORE_KEY, JSON.stringify(_cached)).catch(() => {});
}

/** The server rejected our bearer token (401). Drop it — memory and disk —
 *  and mint a fresh one in the background. Callers retry on the legacy
 *  headers meanwhile (the server still accepts those until enforcement
 *  flips), so a rotated JWT secret or a server switch costs one retry, not
 *  seven days of 401s (2026-09-12: the staging build hit exactly that). */
export function invalidateSessionToken(baseUrl: string): void {
  _cached = { token: '', exp: 0, base: '' };
  AsyncStorage.removeItem(STORE_KEY).catch(() => {});
  maybeRefresh(baseUrl);
}

/** Current bearer token, or null. Kicks a background refresh when missing
 *  or near expiry — callers never wait on the network. The refresh decision
 *  is deferred until the disk hydrate completes, so a still-valid persisted
 *  token short-circuits the mint instead of racing it. */
export function getSessionToken(baseUrl: string): string | null {
  if (!_hydrated) {
    hydrate().then(() => maybeRefresh(baseUrl));
  } else {
    maybeRefresh(baseUrl);
  }
  const usable = _cached.token && _cached.base === baseUrl && _cached.exp - Date.now() > 0;
  return usable ? _cached.token : null;
}
