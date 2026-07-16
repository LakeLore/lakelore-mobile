import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Result, StateKey, STATE_CONFIGS } from '../types';
import { colors, text, space, hairline } from '../lakelore-rn/theme';
import { StatPill } from '../lakelore-rn/components';
import BlurredLakeName from './BlurredLakeName';

interface Props {
  result: Result;
  state: StateKey;
  sortBy: string;
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

// Stocked metric: density when the lake has acreage; absolute estimated
// adults when it doesn't (no denominator — the server ranks those rows below
// every density-ranked row in the stocked sort).
const stockedStat = (r: Result): Stat =>
  r.stocked_per_100ac != null || r.stocked_adults_est == null
    ? { key: 'stocked', label: 'Stck Adults / 100AC',
        value: r.stocked_per_100ac != null ? r.stocked_per_100ac.toFixed(0) : null }
    : { key: 'stocked', label: 'Stck Adults (est)',
        value: Math.round(r.stocked_adults_est).toLocaleString() };

function sdStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: 'Catch / Net', value: r.cpue    != null ? r.cpue.toFixed(1)      : null },
    { key: 'length',  label: 'Avg length',  value: r.average_length != null ? `${r.average_length.toFixed(1)}"` : null },
    stockedStat(r),
    ...metaStats(r),
  ];
}

function mnStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: 'Catch / Net', value: r.cpue           != null ? r.cpue.toFixed(1)           : null },
    { key: 'weight',  label: 'Avg wt',      value: r.average_weight != null ? `${r.average_weight.toFixed(2)} lb` : null },
    { key: 'catch',   label: 'Catch',       value: r.total_catch    != null ? String(r.total_catch)        : null },
    stockedStat(r),
    ...metaStats(r),
  ];
}

function ndStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: 'Catch / Net', value: r.cpue           != null ? r.cpue.toFixed(2)                : null },
    { key: 'length',  label: 'Avg length', value: r.average_length != null ? `${r.average_length.toFixed(1)}"` : null },
    { key: 'catch',   label: 'Total catch', value: r.total_catch    != null ? r.total_catch.toLocaleString()    : null },
    stockedStat(r),
    ...metaStats(r),
  ];
}

function wiStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: 'Catch / Net', value: r.cpue              != null ? r.cpue.toFixed(2)                : null },
    { key: 'length',  label: 'Avg length',  value: r.average_length    != null ? `${r.average_length.toFixed(1)}"` : null },
    { key: 'catch',   label: 'Total catch', value: r.total_catch       != null ? r.total_catch.toLocaleString()    : null },
    stockedStat(r),
    ...metaStats(r),
  ];
}

function neStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: 'Catch / Net', value: r.cpue           != null ? r.cpue.toFixed(2)                : null },
    { key: 'length',  label: 'Avg length', value: r.average_length != null ? `${r.average_length.toFixed(1)}"` : null },
    stockedStat(r),
    ...metaStats(r),
  ];
}

function miStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: 'Catch / Net', value: r.cpue              != null ? r.cpue.toFixed(2)              : null },
    { key: 'length',  label: 'Avg length',  value: r.average_length    != null ? `${r.average_length.toFixed(1)}"` : null },
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
export function cpueLabelForGear(state: StateKey, gear?: string | null): string {
  const fallback = STATE_CONFIGS[state].sortOptions.find(o => o.value === 'cpue')?.label ?? 'Catch / Net';
  if (!gear) return fallback;
  const g = gear.toLowerCase();
  if (/electrofish|shocker|(?:^|[\s-])ef(?:[-\s*]|$)/.test(g)) return 'Catch / Hour';
  if (state === 'wi' && /^(se|fe)\d?$/.test(g)) return 'Catch / Hour';
  if (g.includes('net')) return 'Catch / Net';
  return fallback;
}

function iaStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: 'Catch / Net',  value: fmtCpue(r.cpue) },
    { key: 'catch',   label: 'Total catch',  value: r.total_catch       != null ? r.total_catch.toLocaleString()    : null },
    { key: 'length',  label: 'Avg length',   value: r.average_length    != null ? `${r.average_length.toFixed(1)}"` : null },
    stockedStat(r),
    ...metaStats(r),
  ];
}

// Title-case an agency rating string ('excellent' -> 'Excellent').
const fmtRating = (s: string) => s.replace(/\b\w/g, ch => ch.toUpperCase());

// Generic layout for the 2026-07 all-states fleet: every canonical metric a
// new state can carry. Null values drop out of the pill row automatically, so
// presence-only states just show fewer pills.
function genericStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: 'Catch / Net',  value: fmtCpue(r.cpue) },
    { key: 'rating',  label: 'Forecast',     value: r.rating != null ? fmtRating(r.rating) : null },
    { key: 'length',  label: 'Avg length',   value: r.average_length != null ? `${r.average_length.toFixed(1)}"` : null },
    { key: 'weight',  label: 'Avg wt',       value: r.average_weight != null ? `${r.average_weight.toFixed(2)} lb` : null },
    { key: 'catch',   label: 'Total catch',  value: r.total_catch != null ? r.total_catch.toLocaleString() : null },
    stockedStat(r),
    ...metaStats(r),
  ];
}

export default function ResultRow({ result: r, state, sortBy, onPress }: Props) {
  const allStats = state === 'sd' ? sdStats(r) : state === 'nd' ? ndStats(r) : state === 'ne' ? neStats(r) : state === 'ia' ? iaStats(r) : state === 'wi' ? wiStats(r) : state === 'mi' ? miStats(r) : state === 'mn' ? mnStats(r) : genericStats(r);
  const sortStat = allStats.find(s => s.key === sortBy);
  // Label always pulled from sortOptions so it stays readable ("Lake Name")
  // even when there's no measurable value to show on the right (sortBy 'lake').
  // For NE the configured 'cpue' label is "Catch / Net" — but bass are sampled
  // by Electrofishing, where the unit is per-hour. Override per row so the
  // label matches the gear that produced the value.
  const sortLabel = sortBy === 'cpue'
    ? cpueLabelForGear(state, r.gear)
    : (STATE_CONFIGS[state].sortOptions.find(o => o.value === sortBy)?.label ?? sortBy);
  // Meta keys (acres/depth/year/date/lake) are excluded from the pill row —
  // their values appear in the location line beneath the lake name, so a pill
  // would just duplicate. Pills are reserved for measurable per-survey stats.
  const otherStats = allStats.filter(s => s.key !== sortBy && !META_KEYS.has(s.key) && s.value !== null);

  const yearLabel = (state === 'mn' || state === 'ia') && r.survey_date
    ? r.survey_date.substring(0, 10)
    : String(r.survey_year);

  const location = [
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
            {otherStats.slice(0, 6).map(s => (
              <StatPill key={s.key} label={s.label} value={s.value as string} />
            ))}
          </View>
        )}
      </View>
      <View style={styles.right}>
        <Text style={[text.dataXL, { color: colors.ink }]}>
          {sortStat?.value ?? '—'}
        </Text>
        <Text style={[text.labelS, { color: colors.walleye2, marginTop: 2 }]}>
          {sortLabel}
        </Text>
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
