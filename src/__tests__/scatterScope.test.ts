import { scopeScatterRows } from '../scatterScope';
import { Result } from '../types';

// Minimal plottable/unplottable row builders — only the fields the scoper reads.
const row = (over: Partial<Result>): Result => ({
  lake_id: 1, lake_name: 'L', county: 'C', area_acres: null,
  survey_id: 1, survey_year: 2024, species: 'WAE', gear: null,
  stocked_per_100ac: null,
  ...over,
} as Result);

const gill = (n: number) => Array.from({ length: n }, (_, i) =>
  row({ lake_id: `g${i}`, gear: 'Standard gill net', cpue: 5, average_length: 14 }));
const fyke = (n: number) => Array.from({ length: n }, (_, i) =>
  row({ lake_id: `f${i}`, gear: 'Fyke net', cpue: 30, average_length: 7 }));
const presence = (n: number) => Array.from({ length: n }, (_, i) =>
  row({ lake_id: `p${i}`, gear: 'Presence Only', survey_year: null }));

describe('scopeScatterRows', () => {
  it('passes through untouched when exactly one gear is selected', () => {
    const rows = [...gill(3), ...fyke(2)]; // server already scoped in reality
    const s = scopeScatterRows(rows, ['Standard gill net']);
    expect(s.derived).toBe(false);
    expect(s.gear).toBe('Standard gill net');
    expect(s.rows).toBe(rows); // same reference — zero-cost passthrough
    expect(s.excluded).toBe(0);
  });

  it('derives the dominant plottable gear when no gear is selected (gear-less measure)', () => {
    const s = scopeScatterRows([...gill(5), ...fyke(2), ...presence(50)], []);
    expect(s.derived).toBe(true);
    expect(s.gear).toBe('Standard gill net');
    expect(s.rows).toHaveLength(5);
    expect(s.excluded).toBe(2); // the 2 plottable fyke rows, NOT the 50 presence rows
  });

  it('ignores presence rows in the dominance count even when they outnumber surveys', () => {
    // Presence Only has the most rows but zero plottable ones — it must never win.
    const s = scopeScatterRows([...presence(100), ...fyke(1)], []);
    expect(s.gear).toBe('Fyke net');
    expect(s.rows).toHaveLength(1);
  });

  it('requires BOTH an abundance signal and a size metric to count as plottable', () => {
    const cpueNoSize = row({ gear: 'A', cpue: 5 });                    // no size → not plottable
    const sizeNoCpue = row({ gear: 'A', average_length: 12 });         // no abundance → not plottable
    const ratingWithSize = row({ gear: 'B', rating_ordinal: 3, average_length: 12 }); // ratings tier counts
    const s = scopeScatterRows([cpueNoSize, sizeNoCpue, ratingWithSize], []);
    expect(s.gear).toBe('B');
  });

  it('breaks ties deterministically (alphabetical gear wins)', () => {
    const s = scopeScatterRows([...gill(2), ...fyke(2)], []);
    expect(s.gear).toBe('Fyke net'); // 'F' < 'S'
  });

  it('falls back to passthrough when nothing is plottable or gear is untagged', () => {
    const untagged = [row({ cpue: 5, average_length: 10, gear: null })];
    const s = scopeScatterRows(untagged, []);
    expect(s.derived).toBe(false);
    expect(s.gear).toBeNull();
    expect(s.rows).toBe(untagged);
  });

  it('passes through under manual multi-gear selection — the user chose them (owner 2026-08-12)', () => {
    const rows = [...gill(4), ...fyke(1)];
    const s = scopeScatterRows(rows, ['Standard gill net', 'Fyke net']);
    expect(s.derived).toBe(false);
    expect(s.gear).toBeNull(); // no single-gear claim — mixed by explicit choice
    expect(s.rows).toBe(rows);
  });
});
