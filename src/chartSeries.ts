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
  const byYearGear = new Map<string, number[]>();
  for (const c of rows) {
    const v = value(c);
    if (v == null || c.survey_year == null) continue;
    const gk = c.gear ?? (c.survey_type ?? 'Unknown');
    gearSet.add(gk);
    const key = `${c.survey_year}|${gk}`;
    if (!byYearGear.has(key)) byYearGear.set(key, []);
    byYearGear.get(key)!.push(v);
  }
  const gearKeys = [...gearSet].sort();
  const yearMap = new Map<number, Record<string, number | null>>();
  for (const [key, vals] of byYearGear) {
    const [yr, gk] = key.split('|');
    const year = Number(yr);
    if (!yearMap.has(year)) yearMap.set(year, { year });
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const entry = yearMap.get(year)!;
    if (entry[gk] == null) entry[gk] = avg;
    else entry[gk] = ((entry[gk] as number) + avg) / 2;
  }
  const chartData = [...yearMap.values()]
    .map(e => { const r: Record<string, number | null> = { year: e.year as number }; for (const g of gearKeys) r[g] = e[g] ?? null; return r; })
    .sort((a, b) => (a.year as number) - (b.year as number));
  const activeKeys = gearKeys.filter(g => chartData.some(r => r[g] != null));
  return { chartData, gearKeys: activeKeys };
}
