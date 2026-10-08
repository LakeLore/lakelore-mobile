// GET /api/client-config — the one request an installed binary makes that is
// about the APP rather than the data: the upgrade nudge / kill switch
// (UpdateGate) and the served state list (activeStates). Tries every API
// origin in turn, because this is the request that must still work when one
// hostname has gone away.
import { API_ORIGINS, failoverFrom, isNetworkFailure, looksLikeWrongHost, noteAnswered } from './apiOrigin';
import { applyServedStates } from './activeStates';

export interface ClientConfig {
  minVersion: string | null;
  killedVersions: string[];
  message: string | null;
  states?: { active?: unknown };
}

/** Resolves the config, or null if no origin answered usefully. Never throws. */
export async function fetchClientConfig(): Promise<ClientConfig | null> {
  for (const base of API_ORIGINS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(`${base}/api/client-config`, { signal: controller.signal });
      if (looksLikeWrongHost(res)) { failoverFrom(base); continue; }
      if (!res.ok) continue;
      const cfg = (await res.json()) as ClientConfig;
      if (cfg && typeof cfg === 'object') {
        noteAnswered(base);
        applyServedStates(cfg.states?.active);
        return cfg;
      }
    } catch (err) {
      if (isNetworkFailure(err)) failoverFrom(base);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
