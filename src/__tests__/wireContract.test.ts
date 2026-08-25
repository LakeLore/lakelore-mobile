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
import { plottedRowPredicate } from '../scatterScope';
import { buildYearGearSeries } from '../chartSeries';
import { Result } from '../types';
import resultsFixture from './fixtures/mn-results.json';
import lakeFixture from './fixtures/mn-lake.json';

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
