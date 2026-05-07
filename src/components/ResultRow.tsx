import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Result, StateKey } from '../types';
import { colors, text, space, hairline } from '../lakelore-rn/theme';
import { StatPill } from '../lakelore-rn/components';

interface Props {
  result: Result;
  state: StateKey;
  sortBy: string;
  onPress: () => void;
}

interface Stat { key: string; label: string; value: string | null }

function sdStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: 'CPUE',        value: r.cpue    != null ? r.cpue.toFixed(1)      : null },
    { key: 'length',  label: 'Avg length',  value: r.average_length != null ? `${r.average_length.toFixed(1)}"` : null },
    { key: 'psd',     label: 'PSD',         value: r.psd     != null ? String(r.psd)           : null },
    { key: 'psd_p',   label: 'PSD-P',       value: r.psd_p   != null ? String(r.psd_p)         : null },
    { key: 'wr',      label: 'Wr',          value: r.wr      != null ? String(r.wr)             : null },
    { key: 'stocked', label: 'stck/100ac',  value: r.stocked_per_100ac != null ? r.stocked_per_100ac.toFixed(0) : null },
  ];
}

function mnStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: 'CPUE',        value: r.cpue           != null ? r.cpue.toFixed(1)           : null },
    { key: 'weight',  label: 'Avg wt',      value: r.average_weight != null ? `${r.average_weight.toFixed(2)} lb` : null },
    { key: 'catch',   label: 'Catch',       value: r.total_catch    != null ? String(r.total_catch)        : null },
    { key: 'stocked', label: 'stck/100ac',  value: r.stocked_per_100ac != null ? r.stocked_per_100ac.toFixed(0) : null },
  ];
}

function ndStats(r: Result): Stat[] {
  return [
    { key: 'cpue',   label: 'CPUE',       value: r.cpue           != null ? r.cpue.toFixed(2)                : null },
    { key: 'length', label: 'Avg length', value: r.average_length != null ? `${r.average_length.toFixed(1)}"` : null },
  ];
}

function wiStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: 'CPUE',        value: r.cpue              != null ? r.cpue.toFixed(2)                : null },
    { key: 'length',  label: 'Avg length',  value: r.average_length    != null ? `${r.average_length.toFixed(1)}"` : null },
    { key: 'stocked', label: 'stck/100ac',  value: r.stocked_per_100ac != null ? r.stocked_per_100ac.toFixed(0)    : null },
  ];
}

function neStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: 'CPUE',       value: r.cpue           != null ? r.cpue.toFixed(2)                : null },
    { key: 'length',  label: 'Avg length', value: r.average_length != null ? `${r.average_length.toFixed(1)}"` : null },
    { key: 'stocked', label: 'stck/100ac', value: r.stocked_per_100ac != null ? r.stocked_per_100ac.toFixed(0) : null },
  ];
}

function miStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: 'CPUE',        value: r.cpue              != null ? r.cpue.toFixed(2)              : null },
    { key: 'length',  label: 'Avg length',  value: r.average_length    != null ? `${r.average_length.toFixed(1)}"` : null },
    { key: 'catch',   label: 'Total catch', value: r.total_catch       != null ? r.total_catch.toLocaleString() : null },
    { key: 'stocked', label: 'stck/100ac',  value: r.stocked_per_100ac != null ? r.stocked_per_100ac.toFixed(0)  : null },
  ];
}

function fmtCpue(v: number | null | undefined): string | null {
  if (v == null) return null;
  return v >= 10 ? v.toFixed(1) : v.toFixed(2);
}

function iaStats(r: Result): Stat[] {
  return [
    { key: 'cpue',    label: 'CPUE',         value: fmtCpue(r.cpue) },
    { key: 'catch',   label: 'Total catch',  value: r.total_catch       != null ? r.total_catch.toLocaleString()    : null },
    { key: 'length',  label: 'Avg length',   value: r.average_length    != null ? `${r.average_length.toFixed(1)}"` : null },
    { key: 'stocked', label: 'stck/100ac',   value: r.stocked_per_100ac != null ? r.stocked_per_100ac.toFixed(0)    : null },
    { key: 'ef_cpue', label: 'EF CPUE',      value: fmtCpue(r.ef_cpue) },
    { key: 'hn_cpue', label: 'HN CPUE',      value: fmtCpue(r.hn_cpue) },
    { key: 'fn_cpue', label: 'FN CPUE',      value: fmtCpue(r.fn_cpue) },
  ];
}

export default function ResultRow({ result: r, state, sortBy, onPress }: Props) {
  const allStats = state === 'sd' ? sdStats(r) : state === 'nd' ? ndStats(r) : state === 'ne' ? neStats(r) : state === 'ia' ? iaStats(r) : state === 'wi' ? wiStats(r) : state === 'mi' ? miStats(r) : mnStats(r);
  const sortStat = allStats.find(s => s.key === sortBy);
  const otherStats = allStats.filter(s => s.key !== sortBy && s.value !== null && !(state === 'mn' && s.key === 'date'));

  const yearLabel = (state === 'mn' || state === 'ia') && r.survey_date
    ? r.survey_date.substring(0, 10)
    : String(r.survey_year);

  const location = [
    r.county,
    r.area_acres ? `${r.area_acres.toLocaleString()} ac` : null,
    r.max_depth_feet ? `${r.max_depth_feet} ft` : null,
    yearLabel,
  ].filter(Boolean).join(' · ');

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.row,
      { backgroundColor: pressed ? colors.paper2 : colors.paper },
    ]}>
      <View style={{ flex: 1 }}>
        <Text style={[text.displayM, { color: colors.ink }]} numberOfLines={1}>
          {r.lake_name}
        </Text>
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
          {sortStat?.label ?? sortBy}
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
