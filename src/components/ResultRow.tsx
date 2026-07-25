import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Result, StateKey, STATE_CONFIGS, GENERATED_STATES, speciesDisplayName } from '../types';
import { colors, text, space, hairline } from '../lakelore-rn/theme';
import { StatPill } from '../lakelore-rn/components';
import { useToast } from '../Toast';
import BlurredLakeName from './BlurredLakeName';

interface Props {
  result: Result;
  state: StateKey;
  sortBy: string;
  /** True when the search is NOT species-scoped (All Species + lake-name
      search): each row is a different species, so the row must say which —
      without this the multi-species rows were indistinguishable except by
      their numbers (2026-07-17). */
  showSpecies?: boolean;
  onPress: () => void;
}

interface Stat { key: string; label: string; value: string | null }

// Location-derived stats: these values also appear in the location row under
// the lake name, so they're filtered out of the pill row below. They exist so
// that sorting by any of them surfaces the value on the right side of the row.
const metaStats = (r: Result): Stat[] => [
  { key: 'acres', label: 'Lake Size',
    value: r.area_acres != null ? `${Math.round(r.area_acres).toLocaleString()} ac` : null },
  { key: 'depth', label: 'Lake Depth',
    value: r.max_depth_feet != null ? `${Math.round(r.max_depth_feet)} ft` : null },
  { key: 'year',  label: 'Survey Year',
    value: r.survey_year != null ? String(r.survey_year) : null },
  { key: 'date',  label: 'Survey Date',
    value: r.survey_date ? r.survey_date.substring(0, 10) : null },
];

const META_KEYS = new Set(['acres', 'depth', 'year', 'date', 'lake']);

// Tap-to-define (IMPROVEMENT_PLAN 2.10): one-line plain-language definition
// per metric, shown as a toast when a stat pill (or the sort label) is
// tapped. cpue definitions switch on the label since the unit varies by
// gear and cpue_kind.
function metricDefinition(key: string, label: string): string | null {
  if (key === 'cpue') {
    if (label === 'Rel. Catch Index') return 'Agency relative-abundance index. Compare lakes for the same species only — not a true catch rate.';
    if (label === 'Angler Catch Rate') return 'Catch rate derived from angler/tournament creel data rather than standardized survey nets.';
    if (label === 'Norm. Catch Rate') return 'A catch rate normalized across gear types for lakes surveyed with mixed gear, expressed in spring-fyke-net-equivalent fish per net so it compares to net-sampled lakes.';
    if (label === 'Catch / Hour') return 'Fish caught per hour of electrofishing in the agency survey. Higher = more abundant.';
    return 'Fish caught per net set (gill, trap, or fyke net) in the agency survey. Higher = more abundant.';
  }
  switch (key) {
    case 'stocked':
      return label === 'Stck Adults (est)'
        ? 'Estimated stocked fish surviving to adulthood — an absolute count, because this lake has no recorded acreage for a per-acre rate. Based on the last 10 years of stocking.'
        : 'Estimated stocked fish surviving to adulthood per 100 acres, from the last 10 years of stocking run through a survival model.';
    case 'rating': return 'The state agency’s own fishing-forecast rating for this species at this lake.';
    case 'length':
      return label === 'Est. length'
        ? 'Estimated average length — derived from published size ranges, size classes, or length charts rather than direct measurement. Not comparable to measured averages.'
        : 'Average length of fish measured for this species in the survey.';
    case 'weight': return 'Average weight of fish sampled for this species in the survey.';
    case 'catch':  return 'Total fish of this species counted in the survey.';
    default: return null;
  }
}

// Length label (schema v6): non-measured derivations (prose midpoints, size
// classes, length charts, PSD midpoints) say so — KS's quality-size mean and
// GA's prose estimates must not read like CA/MS measured population means.
const lengthLabel = (r: Result): string =>
  r.length_derivation && r.length_derivation !== 'measured' ? 'Est. length' : 'Avg length';

// Stocked metric: density when the lake has acreage; absolute estimated
// adults when it doesn't (no denominator — the server ranks those rows below
// every density-ranked row in the stocked sort).
const stockedStat = (r: Result): Stat =>
  r.stocked_per_100ac != null || r.stocked_adults_est == null
    ? { key: 'stocked', label: 'Stck Adults / 100AC',
        // One decimal below 10 (D9): a real 0.4/100ac displayed as "0" was
        // indistinguishable from no meaningful stocking, and other surfaces
        // (scatter popup, lake detail) already show a decimal.
        value: r.stocked_per_100ac != null
          ? (r.stocked_per_100ac >= 10 ? r.stocked_per_100ac.toFixed(0) : r.stocked_per_100ac.toFixed(1))
          : null }
    : { key: 'stocked', label: 'Stck Adults (est)',
        value: Math.round(r.stocked_adults_est).toLocaleString() };

function sdStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: cpueLabelForGear('sd', r.gear, r.cpue_kind), value: r.cpue    != null ? r.cpue.toFixed(1)      : null },
    { key: 'length',  label: lengthLabel(r),  value: r.average_length != null ? `${r.average_length.toFixed(1)}"` : null },
    stockedStat(r),
    ...metaStats(r),
  ];
}

function mnStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: cpueLabelForGear('mn', r.gear, r.cpue_kind), value: r.cpue           != null ? r.cpue.toFixed(1)           : null },
    { key: 'weight',  label: 'Avg wt',      value: r.average_weight != null ? `${r.average_weight.toFixed(2)} lb` : null },
    { key: 'catch',   label: 'Catch',       value: r.total_catch    != null ? String(r.total_catch)        : null },
    stockedStat(r),
    ...metaStats(r),
  ];
}

function ndStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: cpueLabelForGear('nd', r.gear, r.cpue_kind), value: r.cpue           != null ? r.cpue.toFixed(2)                : null },
    { key: 'length',  label: lengthLabel(r), value: r.average_length != null ? `${r.average_length.toFixed(1)}"` : null },
    { key: 'catch',   label: 'Total catch', value: r.total_catch    != null ? r.total_catch.toLocaleString()    : null },
    stockedStat(r),
    ...metaStats(r),
  ];
}

function wiStats(r: Result): Stat[] {
  // Label follows the gear/cpue_kind: SE/FE electrofishing → Catch/Hour, the
  // SN nets → Catch/Net, and the synthetic normalized bucket → Norm. Catch Rate.
  return [
    { key: 'cpue',    label: cpueLabelForGear('wi', r.gear, r.cpue_kind), value: r.cpue != null ? r.cpue.toFixed(2) : null },
    { key: 'length',  label: lengthLabel(r),  value: r.average_length    != null ? `${r.average_length.toFixed(1)}"` : null },
    { key: 'catch',   label: 'Total catch', value: r.total_catch       != null ? r.total_catch.toLocaleString()    : null },
    stockedStat(r),
    ...metaStats(r),
  ];
}

function neStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: cpueLabelForGear('ne', r.gear, r.cpue_kind), value: r.cpue           != null ? r.cpue.toFixed(2)                : null },
    { key: 'length',  label: lengthLabel(r), value: r.average_length != null ? `${r.average_length.toFixed(1)}"` : null },
    stockedStat(r),
    ...metaStats(r),
  ];
}

function miStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: cpueLabelForGear('mi', r.gear, r.cpue_kind), value: r.cpue              != null ? r.cpue.toFixed(2)              : null },
    { key: 'length',  label: lengthLabel(r),  value: r.average_length    != null ? `${r.average_length.toFixed(1)}"` : null },
    { key: 'catch',   label: 'Total catch', value: r.total_catch       != null ? r.total_catch.toLocaleString() : null },
    stockedStat(r),
    ...metaStats(r),
  ];
}

function fmtCpue(v: number | null | undefined): string | null {
  if (v == null) return null;
  return v >= 10 ? v.toFixed(1) : v.toFixed(2);
}

// Pick the right catch-rate unit label for the gear that produced this row's
// value. Electrofishing is reported as fish per hour; netting is per net-set.
// Defaults to the state's configured sortOptions label when the gear-specific
// override doesn't apply.
//
// Electrofishing aliases across states:
//   MN  — "Backpack/Fall/Special/Standard electrofishing"
//   ND  — "Electrofishing-Boat"
//   IA  — "EF"
//   NE  — "Electrofishing"
//   MI  — "Electrofishing"
//   SD  — "boat shocker (night/day)", "spring/fall ... ef-lmb/smb/wae",
//         "spring day ef*", "electrofishing (flathead)"
//   WI  — 2-letter codes: "SE1"/"SE2" (Spring EF), "FE" (Fall EF)
// Matches on "electrofish", "shocker", or "ef" as a standalone token / hyphen
// prefix, plus WI's SE/FE codes (whole-string match — gating on state to
// avoid false positives in other states' gear strings).
export function cpueLabelForGear(state: StateKey, gear?: string | null, rowKind?: string | null): string {
  const fallback = STATE_CONFIGS[state].sortOptions.find(o => o.value === 'cpue')?.label ?? 'Catch / Net';
  // Per-ROW normalized rate (WI's synthetic 'CPUE Normalized' bucket): a
  // gear-efficiency-normalized index, not a raw per-net count. Label it as
  // such regardless of state (fleet-ready — keys off the wire's cpue_kind).
  if (rowKind === 'normalized') return 'Norm. Catch Rate';
  // Per-ROW relative / creel rows must NOT be dressed up as a real gear rate.
  // A cpue_kind='relative' value (a 0–5 rating, % composition, a historical
  // index) or a creel angler rate is not "Catch / Net" / "Catch / Hour", and
  // the gear heuristics below would mislabel it straight from the gear name.
  // This keys off the ROW's kind, not the state flag — a mixed state like MB
  // (state cpueKind 'gear', but individual walleye rows tagged 'relative')
  // otherwise fell through and labelled LIFA ratings + % composition as
  // gill-net / electrofishing catch rates, so one result list showed a
  // meaningless mix of "Catch / Net" and "Catch / Hour". A wholly
  // relative/creel state already carries a fitting cpue label in its
  // sortOptions (e.g. "Density Rating") — use it; a mixed state gets a neutral
  // "Index" / "Angler Rate" so the row reads honestly.
  const stateKind = GENERATED_STATES[state]?.cpueKind;
  if (rowKind === 'relative') return stateKind === 'relative' ? fallback : 'Index';
  if (rowKind === 'creel')    return stateKind === 'creel'    ? fallback : 'Angler Rate';
  // Rows with no per-row kind in a wholly relative/creel state keep the label.
  if (stateKind === 'relative' || stateKind === 'creel') return fallback;
  if (!gear) return fallback;
  const g = gear.toLowerCase();
  // Several states bake the CPUE unit into the gear string as a trailing
  // parenthetical — MS "electrofishing (fish/mile)", LA "lead net (fish/hour)"
  // and "gill net (pounds/net-night)", WV "Tournament (catfish/hr)". That unit
  // is authoritative; check it BEFORE the substring heuristics below, which
  // otherwise mislabel exactly these rows (electrofishing≠per-hour in MS,
  // net≠per-net in LA).
  const paren = g.match(/\(([^)]*\/[^)]*)\)\s*$/);
  if (paren) {
    const slash = paren[1].lastIndexOf('/');
    const num = paren[1].slice(0, slash).trim();
    const den = paren[1].slice(slash + 1).trim();
    const denLabel = /^(hr|hour)s?$/.test(den) ? 'Hour'
      : /^miles?$/.test(den) ? 'Mile'
      : /net/.test(den) || /night/.test(den) ? 'Net'
      : null;
    if (denLabel) return (/^(pound|lb)/.test(num) ? 'Lbs / ' : 'Catch / ') + denLabel;
  }
  if (/electrofish|shocker|(?:^|[\s-])ef(?:[-\s*]|$)/.test(g)) return 'Catch / Hour';
  // Two-letter gear codes are per-state vocabularies and MUST stay state-gated:
  // WI and PA use SE/FE for spring/fall ELECTROFISHING, but CO uses SE/SEI for
  // SEINE (and FE for electrofishing) — the same code means different gear in
  // different states (see the CO accumulator REPASS_SPEC gear key).
  if ((state === 'wi' || state === 'pa') && /^(se|fe)\d?$/.test(g)) return 'Catch / Hour';
  if (state === 'co' && g === 'fe') return 'Catch / Hour';
  if (g.includes('net')) return 'Catch / Net';
  return fallback;
}

function iaStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: cpueLabelForGear('ia', r.gear, r.cpue_kind),  value: fmtCpue(r.cpue) },
    { key: 'catch',   label: 'Total catch',  value: r.total_catch       != null ? r.total_catch.toLocaleString()    : null },
    { key: 'length',  label: lengthLabel(r),   value: r.average_length    != null ? `${r.average_length.toFixed(1)}"` : null },
    stockedStat(r),
    ...metaStats(r),
  ];
}

// Title-case an agency rating string ('excellent' -> 'Excellent').
const fmtRating = (s: string) => s.replace(/\b\w/g, ch => ch.toUpperCase());

// Generic layout for the 2026-07 all-states fleet: every canonical metric a
// new state can carry. Null values drop out of the pill row automatically, so
// presence-only states just show fewer pills.
function genericStats(r: Result, state: StateKey): Stat[] {
  return [
    { key: 'cpue',    label: cpueLabelForGear(state, r.gear, r.cpue_kind),  value: fmtCpue(r.cpue) },
    { key: 'rating',  label: 'Forecast',     value: r.rating != null ? fmtRating(r.rating) : null },
    { key: 'length',  label: lengthLabel(r),   value: r.average_length != null ? `${r.average_length.toFixed(1)}"` : null },
    { key: 'weight',  label: 'Avg wt',       value: r.average_weight != null ? `${r.average_weight.toFixed(2)} lb` : null },
    { key: 'catch',   label: 'Total catch',  value: r.total_catch != null ? r.total_catch.toLocaleString() : null },
    stockedStat(r),
    ...metaStats(r),
  ];
}

export default function ResultRow({ result: r, state, sortBy, showSpecies, onPress }: Props) {
  const { toast } = useToast();
  const allStats = state === 'sd' ? sdStats(r) : state === 'nd' ? ndStats(r) : state === 'ne' ? neStats(r) : state === 'ia' ? iaStats(r) : state === 'wi' ? wiStats(r) : state === 'mi' ? miStats(r) : state === 'mn' ? mnStats(r) : genericStats(r, state);
  const sortStat = allStats.find(s => s.key === sortBy);
  // Label always pulled from sortOptions so it stays readable ("Lake Name")
  // even when there's no measurable value to show on the right (sortBy 'lake').
  // For NE the configured 'cpue' label is "Catch / Net" — but bass are sampled
  // by Electrofishing, where the unit is per-hour. Override per row so the
  // label matches the gear that produced the value.
  // The stocked sort ranks in two blocks: lakes WITH acreage by density
  // (adults/100ac), then acreage-less lakes by ABSOLUTE estimated adults. The
  // two carry different units, so the sort label must switch per row —
  // otherwise the absolute block reads as "/100AC" (why 24,748 looks like a
  // giant density right after the density block hit 0).
  const sortLabel = sortBy === 'cpue'
    ? cpueLabelForGear(state, r.gear, r.cpue_kind)
    : sortBy === 'stocked'
    ? (r.stocked_per_100ac != null ? 'Stck Adults / 100AC' : 'Stck Adults (est)')
    : (STATE_CONFIGS[state].sortOptions.find(o => o.value === sortBy)?.label ?? sortBy);
  // Meta keys (acres/depth/year/date/lake) are excluded from the pill row —
  // their values appear in the location line beneath the lake name, so a pill
  // would just duplicate. Pills are reserved for measurable per-survey stats.
  const otherStats = allStats.filter(s => s.key !== sortBy && !META_KEYS.has(s.key) && s.value !== null);

  // Presence-only record: the agency lists this species as present but published
  // no survey metric (the server buckets these under a 'Presence Only' gear).
  // Show it honestly as "Present" instead of a bare "—" under a metric label
  // that has no value (the Hawaii "Stck Adults = null" confusion).
  const isPresenceRow = r.cpue == null && r.average_length == null && r.average_weight == null
    && r.rating == null && r.total_catch == null
    && r.stocked_per_100ac == null && r.stocked_adults_est == null;

  const yearLabel = (state === 'mn' || state === 'ia') && r.survey_date
    ? r.survey_date.substring(0, 10)
    : String(r.survey_year);

  const location = [
    // Species leads the line in un-scoped searches; dropped when the whole
    // list is one species (redundant).
    showSpecies ? speciesDisplayName(r.species, state) : null,
    r.county,
    r.area_acres ? `${Math.round(r.area_acres).toLocaleString()} ac` : null,
    r.max_depth_feet ? `${Math.round(r.max_depth_feet)} ft` : null,
    yearLabel,
  ].filter(Boolean).join(' · ');

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.row,
      { backgroundColor: pressed ? colors.paper2 : colors.paper },
    ]}>
      <View style={{ flex: 1 }}>
        {r.lake_name != null ? (
          <Text style={[text.displayM, { color: colors.ink }]} numberOfLines={1}>
            {r.lake_name}
          </Text>
        ) : (
          <BlurredLakeName seed={r.lake_id} style={text.displayM} />
        )}
        <Text style={[text.dataS, { color: colors.inkSoft, marginTop: 3 }]} numberOfLines={1}>
          {location}
        </Text>
        {otherStats.length > 0 && (
          <View style={styles.stats}>
            {otherStats.slice(0, 6).map(s => {
              const def = metricDefinition(s.key, s.label);
              return (
                <StatPill key={s.key} label={s.label} value={s.value as string}
                  onPress={def ? () => toast(`${s.label} — ${def}`) : undefined} />
              );
            })}
          </View>
        )}
      </View>
      <View style={styles.right}>
        {isPresenceRow ? (
          <Pressable
            onPress={() => toast(r.presence_basis === 'stocked'
              ? 'Stocked — presence inferred from stocking records: the agency stocked this species here but has not published a survey observing it.'
              : 'Presence Only — the agency lists this species as present in this water but published no survey metric (catch rate, length, or stocking).')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={r.presence_basis === 'stocked' ? 'Stocked presence definition' : 'Presence only definition'}>
            <Text style={[text.dataL, { color: colors.ink2, textAlign: 'right' }]}>Present</Text>
            <Text style={[text.labelS, { color: colors.walleye2, marginTop: 2 }]}>
              {r.presence_basis === 'stocked' ? 'Stocked · Inferred' : 'Presence Only'}
            </Text>
          </Pressable>
        ) : (
          <>
            <Text style={[text.dataXL, { color: colors.ink }]}>
              {sortStat?.value ?? '—'}
            </Text>
            {/* Tap the sort label for its definition (same map as the pills). */}
            <Pressable
              onPress={() => {
                const def = metricDefinition(sortBy, sortLabel);
                if (def) toast(`${sortLabel} — ${def}`);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${sortLabel} definition`}>
              <Text style={[text.labelS, {
                color: colors.walleye2, marginTop: 2,
                // Dotted underline = tap-to-define affordance (D2).
                textDecorationLine: 'underline', textDecorationStyle: 'dotted',
                textDecorationColor: colors.paper3,
              }]}>
                {sortLabel}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingVertical: 14,
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.md,
  },
  right: { alignItems: 'flex-end', minWidth: 56 },
});
