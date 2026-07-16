// Client identity signature (IMPROVEMENT_PLAN 1.8 scaffolding).
//
// X-User-Sig = first 32 hex chars of HMAC-SHA256(userId) under an
// app-embedded key. The server verifies (log-only until the 1.0.x fleet
// drains, then LAKELORE_REQUIRE_USER_SIG=1 enforces). An embedded key is
// extractable from the binary — this raises the spoofing bar from "copy a
// header" to "reverse the app", not to real auth; the signed-token item
// remains on the plan. Pure-JS (js-sha256) so it ships via OTA.
//
// MUST match the server's LAKELORE_USER_SIG_KEY.
import { sha256 } from 'js-sha256';

const KEY = 'lakelore-client-v1';

export function hmacSha256Hex(message: string): string {
  return sha256.hmac(KEY, message).slice(0, 32);
}
