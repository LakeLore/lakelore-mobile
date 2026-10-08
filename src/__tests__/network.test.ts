// Network-layer behaviour that can lock a paying user out or strand an
// installed binary (2026-10-08): origin failover, the 401 → token → retry
// recovery that makes LAKELORE_REQUIRE_TOKEN safe to turn on, the typed
// "state no longer served" error, the served-state list, and the
// just-purchased hint.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../attest', () => ({ getAttestation: async () => null }));

const g = globalThis as unknown as { __DEV__: boolean; fetch: jest.Mock };

type Handler = (url: string, init?: { headers?: Record<string, string>; method?: string }) => Promise<unknown> | unknown;
const json = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const netFail = () => { throw new TypeError('Network request failed'); };

function load(dev = false) {
  jest.resetModules();
  g.__DEV__ = dev;
  delete process.env.EXPO_PUBLIC_API_BASE;
  return {
    origin: require('../apiOrigin') as typeof import('../apiOrigin'),
    api: require('../api') as typeof import('../api'),
    session: require('../session') as typeof import('../session'),
    states: require('../activeStates') as typeof import('../activeStates'),
    hint: require('../purchaseHint') as typeof import('../purchaseHint'),
    cfg: require('../clientConfig') as typeof import('../clientConfig'),
  };
}
function mockFetch(handler: Handler) {
  g.fetch = jest.fn(async (url: string, init?: object) => handler(url, init as never)) as jest.Mock;
}

const OWNED = 'https://api.lakeloreapp.com';
const FLY = 'https://lake-fish-api.fly.dev';

describe('API origins', () => {
  it('prefers the owned hostname and keeps the Fly hostname as fallback', () => {
    const { origin } = load();
    expect(origin.API_ORIGINS).toEqual([OWNED, FLY]);
    expect(origin.apiBase()).toBe(OWNED);
    // Tokens minted by 1.1.1 and earlier are bound to the Fly hostname.
    expect(origin.SERVER_KEY).toBe(FLY);
  });

  it('fails over on a network failure and retries on the other origin', async () => {
    const { api, origin } = load();
    const seen: string[] = [];
    mockFetch(url => {
      seen.push(url);
      if (url.startsWith(OWNED)) return netFail();
      if (url.includes('/api/session')) return json(503, {});
      return json(200, { ready: true });
    });
    await expect(api.fetchStatus('mn')).resolves.toEqual({ ready: true });
    expect(seen.filter(u => u.endsWith('/api/mn/status'))).toEqual([`${OWNED}/api/mn/status`, `${FLY}/api/mn/status`]);
    expect(origin.apiBase()).toBe(FLY);
  });

  it('does NOT fail over on an HTTP error — a server that answers is up', async () => {
    const { api, origin } = load();
    mockFetch(url => (url.includes('/api/session') ? json(503, {}) : json(404, {})));
    await expect(api.fetchStatus('mn')).rejects.toThrow('Server error (404)');
    expect(origin.apiBase()).toBe(OWNED);
  });

  it('rotates once when concurrent requests fail on the same origin', () => {
    const { origin } = load();
    expect(origin.failoverFrom(OWNED)).toBe(true);
    expect(origin.failoverFrom(OWNED)).toBe(false); // already moved off it
    expect(origin.apiBase()).toBe(FLY);
  });
});

describe('401 recovery (token enforcement)', () => {
  it('waits for a session token after a 401, then retries with it', async () => {
    const { api } = load();
    const auth: (string | undefined)[] = [];
    mockFetch((url, init) => {
      if (url.endsWith('/api/session/challenge')) return json(200, {});
      if (url.endsWith('/api/session')) return json(200, { token: 'tok-1', expiresIn: 7 * 86400 });
      const a = init?.headers?.Authorization;
      auth.push(a);
      // Enforcement on: no bearer → 401 session_token_required.
      return a === 'Bearer tok-1' ? json(200, { ready: true }) : json(401, { error: 'session_token_required' });
    });
    await expect(api.fetchStatus('mn')).resolves.toEqual({ ready: true });
    expect(auth[auth.length - 1]).toBe('Bearer tok-1');
    expect(auth.length).toBeLessThanOrEqual(2); // one 401, one success
  });

  it('drops a rejected token and recovers with a fresh one', async () => {
    const { api } = load();
    let minted = 0;
    mockFetch((url, init) => {
      if (url.endsWith('/api/session/challenge')) return json(200, {});
      if (url.endsWith('/api/session')) return json(200, { token: `tok-${++minted}`, expiresIn: 7 * 86400 });
      // The server rotated its secret: tok-1 is no longer accepted.
      return init?.headers?.Authorization === 'Bearer tok-2' ? json(200, { ready: true }) : json(401, {});
    });
    await expect(api.fetchStatus('mn')).resolves.toEqual({ ready: true });
    expect(minted).toBe(2);
  });
});

describe('state no longer served', () => {
  it('maps 400 "Unknown state" to a typed, non-retried error', async () => {
    const { api } = load();
    let dataCalls = 0;
    mockFetch(url => {
      if (url.includes('/api/session')) return json(503, {});
      dataCalls++;
      return json(400, { error: 'Unknown state: ks' });
    });
    await expect(api.fetchStatus('ks' as never)).rejects.toBeInstanceOf(api.StateUnavailableError);
    expect(dataCalls).toBe(1);
  });

  it('narrows the baked list to what the server serves, and restores it', () => {
    const { states } = load();
    const baked = states.getActiveStates();
    expect(baked).toContain('tx');
    states.applyServedStates(baked.filter(s => s !== 'tx'));
    expect(states.isActiveState('tx' as never)).toBe(false);
    expect(states.isActiveState('mn' as never)).toBe(true);
    states.applyServedStates([...baked]);
    expect(states.isActiveState('tx' as never)).toBe(true);
  });

  it('never activates a state this bundle baked as inactive', () => {
    const { states } = load();
    const baked = states.getActiveStates();
    const { GENERATED_STATES, STATE_KEYS } = require('../generated/states');
    const inactive = STATE_KEYS.find((k: string) => !GENERATED_STATES[k].active);
    states.applyServedStates([...baked, inactive]);
    expect(states.isActiveState(inactive)).toBe(false);
  });

  it('ignores a malformed, empty, or free-state-less list', () => {
    const { states } = load();
    const n = states.getActiveStates().length;
    for (const bad of [null, [], 'mn', [1, 2], ['mn'], ['tx', 'wi'], { active: ['mn'] }]) {
      states.applyServedStates(bad);
      expect(states.getActiveStates().length).toBe(n);
    }
  });

  it('client-config tries the next origin and applies the served list', async () => {
    const { cfg, states } = load();
    const baked = states.getActiveStates();
    mockFetch(url => (url.startsWith(OWNED)
      ? netFail()
      : json(200, { minVersion: null, killedVersions: [], message: null, states: { active: baked.filter(s => s !== 'wi') } })));
    const c = await cfg.fetchClientConfig();
    expect(c?.killedVersions).toEqual([]);
    expect(states.isActiveState('wi' as never)).toBe(false);
  });

  it('client-config never throws when nothing answers', async () => {
    const { cfg } = load();
    mockFetch(netFail);
    await expect(cfg.fetchClientConfig()).resolves.toBeNull();
  });
});

describe('just-purchased hint', () => {
  it('sends X-Entitlement-Refresh only inside the window after a purchase', async () => {
    const { api, hint } = load();
    const seen: (string | undefined)[] = [];
    mockFetch((url, init) => {
      if (url.includes('/api/session')) return json(503, {});
      seen.push(init?.headers?.['X-Entitlement-Refresh']);
      return json(200, { hasAllStates: true, expiresAt: null, source: 'rc' });
    });
    await api.fetchMyEntitlement();
    hint.notePurchase();
    await api.fetchMyEntitlement();
    hint._resetPurchaseHintForTests(Date.now() - 11 * 60 * 1000);
    await api.fetchMyEntitlement();
    expect(seen).toEqual([undefined, '1', undefined]);
  });
});

// ── Added after the independent review (2026-10-08) ─────────────────────────
const storage = () => {
  const m = require('@react-native-async-storage/async-storage');
  return (m.default ?? m) as { setItem(k: string, v: string): Promise<void>; clear(): Promise<void> };
};
const abortErr = () => { const e = new Error('Aborted'); e.name = 'AbortError'; throw e; };
const withType = (status: number, body: unknown, type: string) => ({ ...json(status, body), headers: { get: () => type } });

describe('origin track record', () => {
  it('ends on the offline message the cached-results paths key off', async () => {
    const { api } = load();
    mockFetch(netFail);
    await expect(api.fetchStatus('mn')).rejects.toThrow(/Could not reach server/);
  });

  it('gives an origin that has answered a second chance before leaving it', async () => {
    const { api, origin } = load();
    let n = 0;
    mockFetch(url => {
      if (url.includes('/api/session')) return json(503, {});
      if (url.startsWith(OWNED)) { n++; return n === 2 ? abortErr() : json(200, { ready: true }); }
      return netFail(); // the other origin is dead
    });
    await api.fetchStatus('mn');                                   // OWNED answers → has a track record
    await expect(api.fetchStatus('mn')).resolves.toEqual({ ready: true }); // one timeout, retried on OWNED
    expect(origin.apiBase()).toBe(OWNED);
  });

  it('starts from the origin that worked last launch', async () => {
    // Seed AFTER load(): the storage mock is module-scoped, so it must be the
    // instance the freshly-loaded modules will read (hydration is lazy).
    const { api } = load();
    await storage().setItem('apiOrigin.lastGood.v1', FLY);
    const seen: string[] = [];
    mockFetch(url => {
      if (url.includes('/api/session')) return json(503, {});
      seen.push(url);
      return json(200, { ready: true });
    });
    await api.fetchStatus('mn');
    expect(seen).toEqual([`${FLY}/api/mn/status`]); // no wasted attempt on the other host
    await storage().clear();
  });

  it('fails over when the owned hostname answers as something that is not the API', async () => {
    const { api, origin } = load();
    mockFetch(url => {
      if (url.includes('/api/session')) return json(503, {});
      return url.startsWith(OWNED)
        ? withType(404, '<html>not found</html>', 'text/html; charset=utf-8')
        : withType(200, { ready: true }, 'application/json; charset=utf-8');
    });
    await expect(api.fetchStatus('mn')).resolves.toEqual({ ready: true });
    expect(origin.apiBase()).toBe(FLY);
  });
});

describe('401 bounds', () => {
  it('gives up after three attempts against a server that always 401s', async () => {
    const { api } = load();
    let data = 0;
    mockFetch(url => {
      if (url.endsWith('/api/session/challenge')) return json(200, {});
      if (url.endsWith('/api/session')) return json(200, { token: 't', expiresIn: 7 * 86400 });
      data++;
      return json(401, {});
    });
    await expect(api.fetchStatus('mn')).rejects.toThrow(/Session refused/);
    expect(data).toBe(3);
  });

  it('does not hang when the token mint fails', async () => {
    const { api } = load();
    let data = 0;
    mockFetch(url => {
      if (url.includes('/api/session')) return json(500, {});
      data++;
      return json(401, { error: 'session_token_required' });
    });
    await expect(api.fetchStatus('mn')).rejects.toThrow(/Session refused/);
    expect(data).toBe(3);
  });

  it('adopts a token minted by 1.1.1 (bound to the Fly hostname) without re-minting', async () => {
    const { api } = load();
    await storage().setItem('sessionToken.v1', JSON.stringify({ token: 'old-tok', exp: Date.now() + 6 * 86400_000, base: FLY }));
    let mints = 0; const auth: (string | undefined)[] = [];
    mockFetch((url, init) => {
      if (url.includes('/api/session')) { mints++; return json(200, { token: 'new', expiresIn: 7 * 86400 }); }
      auth.push(init?.headers?.Authorization);
      return init?.headers?.Authorization ? json(200, { ready: true }) : json(401, {});
    });
    await api.fetchStatus('mn');
    expect(auth[auth.length - 1]).toBe('Bearer old-tok');
    expect(mints).toBe(0);
    await storage().clear();
  });
});

describe('served list persistence', () => {
  it('restores the last served list from disk, and a live answer outranks it', async () => {
    const { states } = load();
    const baked = states.getActiveStates();
    await storage().setItem('servedStates.v1', JSON.stringify({ active: baked.filter(s => s !== 'tx'), ts: 1 }));
    await states.hydrateServedStates();
    expect(states.isActiveState('tx' as never)).toBe(false);

    const again = load().states;
    await storage().setItem('servedStates.v1', JSON.stringify({ active: baked.filter(s => s !== 'tx'), ts: 1 }));
    again.applyServedStates([...baked]);          // live answer lands first
    await again.hydrateServedStates();            // stale disk copy must not undo it
    expect(again.isActiveState('tx' as never)).toBe(true);
    await storage().clear();
  });
});
