import { Result } from './types';

// ── Scatter gear self-scoping (2026-08-11, DATA_MODEL §4 follow-through) ────
//
// The scatter's contract is one abundance unit per Y axis, guaranteed by the
// result set being scoped to a single Gear/Source. Gear-LESS measures broke
// that quietly: Stocking Impact and Presence sources carry no gear, so
// `applyMeasureSource` sets `gearTypes: []`, the query returns rows across
// every gear, and the scatter stacked fish/net-night against fish/hour — with
// the same lake appearing once per gear it was surveyed with.
//
// Fix (owner decision 2026-08-11, option B): when the filter state carries no
// single gear, the scatter scopes ITSELF to the dominant plottable gear and
// says so on the chart. This is presentation-layer only — the shared filter
// state is never touched, so switching back to list view shows exactly what
// the measure's own scope would have shown (the owner's explicit requirement).

export interface ScatterScope {
  /** Rows the scatter should plot (scoped when `derived`). */
  rows: Result[];
  /** The single gear in effect, or null when none could be determined. */
  gear: string | null;
  /** True when the scatter chose the gear itself (filter state had none). */
  derived: boolean;
  /** Plottable rows in OTHER gears dropped by the derivation (0 otherwise). */
  excluded: number;
}

// ── Which rows the scatter will actually DRAW ───────────────────────────────
//
// Single source of truth shared by ScatterPlot's dot builder, the results
// header's scatter-view count, and the fallback scoper's dominance vote —
// mirroring ScatterPlot's per-state branch structure exactly. Kept here (pure
// module) so tests and the scoper don't import the RN component.
//
// The 2026-08 post-launch fix this consolidates: MN plots weight-less rows at
// x=0 by design (cpue alone suffices), but the scoper's old heuristic required
// a positive size metric, undercounting MN in the dominance vote.

/** Majority vote for the generic branch's size axis (weight vs length) —
 * mirrors the server's /measures sizeField rule. */
export function genericSizeAxisIsWeight(results: Result[]): boolean {
  const wN = results.filter(r => r.cpue != null && (r.average_weight ?? 0) > 0).length;
  const lN = results.filter(r => r.cpue != null && (r.average_length ?? 0) > 0).length;
  return wN > lN;
}

export function plottedRowPredicate(
  state: string | null,
  results: Result[],
): (r: Result) => boolean {
  switch (state) {
    case 'mn':
      // MN: weight defaults to 0 on the plot — cpue alone qualifies.
      return r => r.cpue != null;
    case 'ia':
      return r => r.survey_date != null && r.cpue != null && r.average_length != null;
    case 'nd':
    case 'ne':
    case 'mi':
    case 'wi':
    case 'sd':
      return r => r.cpue != null && r.average_length != null;
    default: {
      // Generic abundance-vs-size branch when any row carries cpue + a size;
      // ratings-tier fallback (rating ordinal × length) otherwise.
      if (results.some(r => r.cpue != null && (r.average_length != null || r.average_weight != null))) {
        const usesWeight = genericSizeAxisIsWeight(results);
        return r => {
          if (r.cpue == null) return false;
          const size = usesWeight ? r.average_weight : r.average_length;
          return size != null && size > 0;
        };
      }
      return r => r.rating_ordinal != null && r.average_length != null;
    }
  }
}

export function scopeScatterRows(
  rows: Result[],
  gearTypes: string[],
  state: string | null = null,
): ScatterScope {
  // Dominance is voted by what the scatter can actually draw for THIS state.
  const plottable = plottedRowPredicate(state, rows);
  // ANY explicit gear selection IS the scope (owner decision 2026-08-12:
  // manual multi-select plots every selected gear — the user chose them, and
  // the multi-gear query returns each lake's latest row per gear). Passthrough.
  if (gearTypes.length >= 1) {
    return { rows, gear: gearTypes.length === 1 ? gearTypes[0] : null, derived: false, excluded: 0 };
  }

  // 0 gears (Stocking Impact / Presence sources): derive the dominant gear by
  // PLOTTABLE row count, so the pick is driven by what the scatter can
  // actually draw, not by raw row counts that presence buckets would win.
  // Tie-break alphabetically for determinism.
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.gear && plottable(r)) counts.set(r.gear, (counts.get(r.gear) ?? 0) + 1);
  }
  if (counts.size === 0) {
    // No gear-tagged plottable rows (state's wire may omit `gear`, or nothing
    // is plottable). Fall back to the old behavior rather than a blank chart.
    return { rows, gear: null, derived: false, excluded: 0 };
  }
  let best: string | null = null;
  let bestN = -1;
  for (const [g, n] of [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (n > bestN) { best = g; bestN = n; }
  }
  const excluded = [...counts.entries()]
    .filter(([g]) => g !== best)
    .reduce((sum, [, n]) => sum + n, 0);
  return {
    rows: rows.filter(r => r.gear === best),
    gear: best,
    derived: true,
    excluded,
  };
}
