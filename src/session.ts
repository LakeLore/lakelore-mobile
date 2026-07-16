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

const STORE_KEY = 'sessionToken.v1';
// Refresh when less than a day of validity remains.
const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;

let _cached: { token: string; exp: number } | null = null;
let _inflight: Promise<void> | null = null;

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
  _cached = { token: body.token, exp: Date.now() + (body.expiresIn ?? 0) * 1000 };
  AsyncStorage.setItem(STORE_KEY, JSON.stringify(_cached)).catch(() => {});
}

/** Current bearer token, or null. Kicks a background refresh when missing
 *  or near expiry — callers never wait on the network. */
export function getSessionToken(baseUrl: string): string | null {
  if (_cached === null) {
    // One-time hydrate from disk (sync miss on the very first call is fine).
    _cached = { token: '', exp: 0 };
    AsyncStorage.getItem(STORE_KEY)
      .then(raw => { if (raw) _cached = JSON.parse(raw); })
      .catch(() => {});
  }
  const usable = _cached.token && _cached.exp - Date.now() > 0;
  const fresh = _cached.token && _cached.exp - Date.now() > REFRESH_MARGIN_MS;
  if (!fresh && !_inflight) {
    _inflight = refresh(baseUrl)
      .catch(() => {})
      .finally(() => { _inflight = null; });
  }
  return usable ? _cached.token : null;
}
