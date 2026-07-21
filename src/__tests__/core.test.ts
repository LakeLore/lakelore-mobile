// Core pure-function tests (IMPROVEMENT_PLAN 1.12): species-name mapping,
// cpue-kind labeling, the stocked-metric fallback, and client-signature
// parity with the server.
import { speciesDisplayName, STATE_CONFIGS, GENERATED_STATES, STATE_KEYS } from '../types';
import { hmacSha256Hex } from '../userSig';

describe('speciesDisplayName', () => {
  it('resolves MN codes through the generated registry map', () => {
    expect(speciesDisplayName('WAE', 'mn')).toBe('Walleye');
    expect(speciesDisplayName('NOP', 'mn')).toBe('Northern Pike');
  });
  it('passes through full-name states verbatim', () => {
    expect(speciesDisplayName('Largemouth Bass', 'tx')).toBe('Largemouth Bass');
  });
  it('never returns empty for unknown codes', () => {
    expect(speciesDisplayName('ZZZ', 'mn')).toBe('ZZZ');
  });
});

describe('state configs', () => {
  it('every state key has a config with a sortOptions array', () => {
    // sortOptions feeds only the LEGACY sort picker (fallback when the server
    // predates /measures); the Measure × Source model is the primary sort
    // mechanism (DATA_MODEL 2026-07-20). A pure presence-only state can have an
    // empty legacy array — the measure picker still gives it Presence.
    for (const k of STATE_KEYS) {
      expect(STATE_CONFIGS[k]).toBeDefined();
      expect(Array.isArray(STATE_CONFIGS[k].sortOptions)).toBe(true);
    }
  });
  it('relative-index states never label cpue as a real rate', () => {
    for (const k of STATE_KEYS) {
      const g = GENERATED_STATES[k];
      if (g.cpueKind === 'relative' && g.hasCpue) {
        const cpueOpt = STATE_CONFIGS[k].sortOptions.find(o => o.value === 'cpue');
        expect(cpueOpt?.label).toBe('Rel. Catch Index');
      }
    }
  });
  it('free state is exactly mn', () => {
    expect(STATE_KEYS.filter(k => GENERATED_STATES[k].free)).toEqual(['mn']);
  });
});

describe('client signature', () => {
  it('matches the server-side HMAC vector', () => {
    // Server: createHmac('sha256','lakelore-client-v1').update('test-user')
    //   .digest('hex').slice(0,32)
    expect(hmacSha256Hex('test-user')).toBe('1ce404c5ac0d285d8ea8f93ffb4a19a1');
  });
});
