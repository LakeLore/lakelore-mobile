// Platform attestation (App Attest / Play Integrity) for the /api/session
// gate. The server hands us a challenge; the OS proves "genuine LakeLore
// binary on real hardware" over it; the proof rides the session POST and the
// server stamps an `att` claim on the token after verifying with Apple/Google
// (server/attest.js in the server repo).
//
// Failure-soft everywhere: any error returns null and the session flow
// proceeds unattested — never block a fisherman on an integrity check. A
// 24-hour cooldown after a failure keeps us from hammering Apple's
// rate-limited attestation service from devices that can't attest (old iOS,
// no Play Services, jailbreak).
//
// NATIVE MODULE: @pagopa/io-react-native-integrity ships with native build
// 21+. It is lazy-required (same pattern as the share card) so OTA updates to
// runtime 1.1.0 builds that lack the module degrade to unattested sessions
// instead of crashing on import.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface AttestationPayload {
  platform: 'ios' | 'android';
  challenge: string;
  keyId?: string;
  attestation?: string;
  token?: string;
}

const COOLDOWN_KEY = 'attest.cooldown.v1';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

// iOS: a FRESH hardware key per attestation. Apple attests a key once and
// the server's checker requires signCount 0, so reusing a key buys nothing;
// a weekly key + attestation per session refresh is far inside rate limits
// and keeps the server stateless (no per-device key store).
async function attestIos(integrity: any, challenge: string): Promise<AttestationPayload | null> {
  const available = await integrity.isAttestationServiceAvailable().catch(() => false);
  if (!available) return null;
  const keyId: string = await integrity.generateHardwareKey();
  const attestation: string = await integrity.getAttestation(challenge, keyId);
  return { platform: 'ios', challenge, keyId, attestation };
}

// Android: Play Integrity standard request. prepare() warms the token
// provider; the challenge rides as the requestHash and comes back to the
// server inside Google's signed verdict.
async function attestAndroid(integrity: any, challenge: string): Promise<AttestationPayload | null> {
  const available = await integrity.isPlayServicesAvailable().catch(() => false);
  if (!available) return null;
  const cloudProjectNumber = Constants.expoConfig?.extra?.playCloudProjectNumber;
  if (!cloudProjectNumber) return null;
  await integrity.prepareIntegrityToken(String(cloudProjectNumber));
  const token: string = await integrity.requestIntegrityToken(challenge);
  return { platform: 'android', challenge, token };
}

export async function getAttestation(challenge: string): Promise<AttestationPayload | null> {
  // Dev builds are development-signed — their attestations use Apple's
  // development environment and would fail production verification anyway.
  if (__DEV__) return null;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  try {
    const raw = await AsyncStorage.getItem(COOLDOWN_KEY);
    if (raw && Date.now() - Number(raw) < COOLDOWN_MS) return null;
  } catch {}
  let integrity: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    integrity = require('@pagopa/io-react-native-integrity');
  } catch {
    return null; // pre-build-21 binary — module not present
  }
  try {
    return Platform.OS === 'ios'
      ? await attestIos(integrity, challenge)
      : await attestAndroid(integrity, challenge);
  } catch {
    AsyncStorage.setItem(COOLDOWN_KEY, String(Date.now())).catch(() => {});
    return null;
  }
}
