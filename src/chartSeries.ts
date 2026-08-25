// src/chartSeries.ts — pure year×gear line-series builder shared by the Lake
// Detail Catch and Avg Size tabs. Extracted from LakeDetailScreen (T3.15,
// 2026-08-25) so the wire-contract fixture test can prove a real /lake payload
// still produces non-empty chart series — a silent server-side field rename
// used to render as a blank chart with no failing signal anywhere.

// Minimal structural view of a /lake `catches` row — only what the series
// builder reads. LakeDetailScreen's fuller CatchRow satisfies it.
export interface SeriesCatchRow {
  survey_year: number | null;
  gear?: string | null;
  survey_type?: string | null;
}

export function buildYearGearSeries<R extends SeriesCatchRow>(
  rows: R[],
  value: (c: R) => number | null | undefined,
) {
  const gearSet = new Set<string>();
  // Nested Map (year → gear → values), not a `${year}|${gear}` composite key —
  // a gear label containing '|' used to split apart on the way back out and
  // silently merge into whatever gear name preceded the first pipe.
  const byYearGear = new Map<number, Map<string, number[]>>();
  for (const c of rows) {
    const v = value(c);
    if (v == null || c.survey_year == null) continue;
    const gk = c.gear ?? (c.survey_type ?? 'Unknown');
    gearSet.add(gk);
    let byGear = byYearGear.get(c.survey_year);
    if (!byGear) { byGear = new Map(); byYearGear.set(c.survey_year, byGear); }
    if (!byGear.has(gk)) byGear.set(gk, []);
    byGear.get(gk)!.push(v);
  }
  const gearKeys = [...gearSet].sort();
  const yearMap = new Map<number, Record<string, number | null>>();
  for (const [year, byGear] of byYearGear) {
    for (const [gk, vals] of byGear) {
      if (!yearMap.has(year)) yearMap.set(year, { year });
      yearMap.get(year)![gk] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
  }
  const chartData = [...yearMap.values()]
    .map(e => { const r: Record<string, number | null> = { year: e.year as number }; for (const g of gearKeys) r[g] = e[g] ?? null; return r; })
    .sort((a, b) => (a.year as number) - (b.year as number));
  const activeKeys = gearKeys.filter(g => chartData.some(r => r[g] != null));
  return { chartData, gearKeys: activeKeys };
}
