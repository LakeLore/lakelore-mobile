// Wire-contract fixture test (T3.15, 2026-08-25). Golden /results and /lake
// payloads captured from PRODUCTION (MN walleye · Mille Lacs 48000200,
// 2026-08-25) must keep producing non-empty chart series through the app's
// real derivation code. A server-side field rename used to fail SILENTLY into
// a blank chart/scatter — this makes that class of regression a red test.
//
// Refreshing the fixtures (only needed if the wire contract changes ON
// PURPOSE — record the change in the server README first):
//   curl -s 'https://lake-fish-api.fly.dev/api/mn/results?species=WAE&mostRecentOnly=true&sortBy=cpue&sortDir=desc' > src/__tests__/fixtures/mn-results.json
//   curl -s 'https://lake-fish-api.fly.dev/api/mn/lake/48000200' > src/__tests__/fixtures/mn-lake.json  # then trim to the WAE slice
//   curl -s 'https://lake-fish-api.fly.dev/api/wi/results?limit=25' > src/__tests__/fixtures/wi-results-preview.json
import { plottedRowPredicate } from '../scatterScope';
import { buildYearGearSeries } from '../chartSeries';
import { Result, ResultsResponse } from '../types';
import resultsFixture from './fixtures/mn-results.json';
import lakeFixture from './fixtures/mn-lake.json';
import wiPreviewFixture from './fixtures/wi-results-preview.json';

describe('golden /results payload (MN walleye, prod)', () => {
  const rows = (resultsFixture as { total: number; results: Result[] }).results;

  it('parses into a non-empty result set', () => {
    expect(rows.length).toBeGreaterThan(10);
  });

  it('carries the fields the list rows render', () => {
    const r = rows[0];
    expect(r.lake_id).toBeDefined();
    expect(typeof r.lake_name).toBe('string');
    expect(typeof r.cpue).toBe('number');
    expect(r.species).toBeDefined();
  });

  it('produces a non-empty scatter through the real dot predicate', () => {
    const plots = plottedRowPredicate('mn', rows);
    const dots = rows.filter(plots).length;
    expect(dots).toBeGreaterThan(10); // MN: every cpue-bearing row plots
  });
});

describe('golden /lake payload (Mille Lacs walleye slice, prod)', () => {
  const lake = lakeFixture as {
    lake: Record<string, unknown>;
    catches: { species: string; gear: string | null; survey_year: number | null; cpue: number | null; average_weight?: number | null }[];
    stocking: { stock_year: number; quantity: number }[];
  };

  it('parses into a lake with a walleye catch history', () => {
    expect(lake.lake).toBeDefined();
    expect(lake.catches.length).toBeGreaterThan(50);
  });

  it('produces a non-empty CPUE-over-time series through the real builder', () => {
    const { chartData, gearKeys } = buildYearGearSeries(lake.catches, c => c.cpue);
    expect(chartData.length).toBeGreaterThan(10); // decades of surveys
    expect(gearKeys.length).toBeGreaterThan(0);   // at least one gear line
  });

  it('produces a non-empty Avg Size series (MN reports weight)', () => {
    const { chartData } = buildYearGearSeries(lake.catches, c => c.average_weight);
    expect(chartData.length).toBeGreaterThan(5);
  });

  it('carries a stocking history for the stocking tab', () => {
    expect(lake.stocking.length).toBeGreaterThan(0);
    expect(typeof lake.stocking[0].stock_year).toBe('number');
    expect(typeof lake.stocking[0].quantity).toBe('number');
  });
});

describe('golden /results payload (WI preview, unauthenticated prod)', () => {
  // Captured 2026-08-25 with a plain GET (no entitlement) — the server serves
  // paid-state results in PREVIEW shape: identity redacted (lake_name/county/
  // acres null), lake/survey ids replaced with deterministic hashes, metrics
  // (cpue/rating/length) intact. WI also exercises the rating tier MN never
  // does — "correct on MN" is a hypothesis, MN is the best-behaved state.
  // (through unknown: the JSON module's inferred literal types carry nulls
  // where Result declares strings — the runtime shape is what's under test)
  const payload = wiPreviewFixture as unknown as ResultsResponse;
  const rows = payload.results;

  it('parses into a non-empty preview result set', () => {
    expect(payload.preview).toBe(true);
    expect(rows.length).toBeGreaterThan(10);
    expect(payload.total).toBeGreaterThan(rows.length);
  });

  it('redacts identity but keeps hashed ids and metrics (list projection)', () => {
    for (const r of rows) {
      expect(r.lake_name).toBeNull();          // BlurredLakeName path
      expect(typeof r.lake_id).toBe('string'); // hashed, never a raw WBIC
      expect(typeof r.survey_id).toBe('string');
      expect(r.species).toBeDefined();
    }
    expect(rows.some(r => r.cpue != null)).toBe(true);
  });

  it('carries the WI rating fields on the wire', () => {
    expect(rows.some(r => r.rating != null && r.rating_ordinal != null)).toBe(true);
  });

  it('produces a non-empty scatter through the real WI dot predicate', () => {
    // WI branch: cpue + average_length — preview redaction must never strip
    // the metric fields the chart plots.
    const dots = rows.filter(plottedRowPredicate('wi', rows)).length;
    expect(dots).toBeGreaterThan(0);
  });
});
