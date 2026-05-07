import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  Pressable, ActivityIndicator, Linking, useWindowDimensions,
  GestureResponderEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import Svg, { Line, Polyline, Circle, Rect, Text as SvgText, G } from 'react-native-svg';
import { fetchLakeWithSpecies, API_BASE_URL } from '../api';
import { StateKey, speciesDisplayName, SD_SPECIES_FROM_NAME } from '../types';
import { colors, text, space, hairline, fonts } from '../lakelore-rn/theme';
import { PaperHeader, Chip } from '../lakelore-rn/components';

const GAME_FISH_CODES = new Set([
  'WAE','NOP','LMB','SMB','MUE','TME','BLC','WHC','BLG','YEP',
  'SAU','SAR','RBT','BNT','BKT','LAK','LKS','CCF','WHB','STH','TLC','RKB','PMK',
]);
import type { RootStackParamList } from '../navigation';

type RouteT = RouteProp<RootStackParamList, 'LakeDetail'>;

const SD_REPORT_URL = (id: number) =>
  `https://apps.sd.gov/GF56FisheriesReports/ExportPDF.ashx?ReportID=${id}`;
const MN_LAKEFINDER_URL = (id: number | string) =>
  `https://www.dnr.state.mn.us/lakefind/lake.html?id=${id}`;

interface Lake {
  id: number | string; name: string; county: string;
  area_acres?: number | null; max_depth_feet?: number | null;
}
interface CatchRow {
  species: string; gear: string | null; survey_id: number | string;
  survey_year: number; report_id?: number | null; survey_date?: string | null;
  survey_type?: string | null;
  cpue: number | null;
  average_weight?: number | null; total_catch?: number | null; gear_count?: number | null;
  average_length?: number | null; species_name?: string | null;
}
interface StockRow { stock_year: number; species: string; life_stage: string; quantity: number }
interface MetricRow { species: string; adults_per_100ac: number }
interface MetricByYearRow { species: string; year: number; adults_per_100ac: number }
interface LakeData { lake: Lake; surveys: { id: number|string; report_id?: number|null; source_pdf?: string|null }[]; catches: CatchRow[]; stocking: StockRow[]; metrics: MetricRow[]; metrics_by_year?: MetricByYearRow[] }

// Palette — paper-and-ink chart palette
const LINE_COLORS = [colors.rust, colors.walleye, colors.moss, colors.lake3, '#8a6aa8', colors.lakeInk];
const STAGE_COLORS: Record<string, string> = {
  fry:        colors.walleye,
  fingerling: colors.flash,
  yearling:   colors.lake3,
  adult:      colors.rust,
};
const DEFAULT_COLOR = colors.paper3;
const ADULT_LINE = '#8a6aa8';

function inchesToStage(inches: number): string {
  if (inches < 1)  return 'fry';
  if (inches < 6)  return 'fingerling';
  if (inches < 12) return 'yearling';
  return 'adult';
}

function normalizeStage(s: string) {
  const l = s.toLowerCase().trim().replace(/"/g, '').replace(/\s+/g, ' ');
  if (l.includes('egg'))        return 'fry';
  if (l.includes('fry'))        return 'fry';
  if (l.includes('fingerling') || l.includes('juvenile')) return 'fingerling';
  if (l.includes('yearling'))   return 'yearling';
  if (l.includes('adult') || l.includes('legal') || l.includes('catchable') || l.includes('pre-spawn')) return 'adult';
  if (l.includes('/lb'))        return 'fingerling';
  const rangeMatch = l.match(/^(\d+\.?\d*)\s*-\s*(\d+\.?\d*)$/);
  if (rangeMatch) return inchesToStage((parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2);
  const ltMatch = l.match(/^<\s*(\d+\.?\d*)$/);
  if (ltMatch) return inchesToStage(parseFloat(ltMatch[1]) - 1);
  const numMatch = l.match(/^(\d+\.?\d*)\+?$/);
  if (numMatch) return inchesToStage(parseFloat(numMatch[1]));
  return l;
}

function niceTicks(min: number, max: number, count = 5): number[] {
  const range = max - min; if (range <= 0) return [min];
  const raw = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1,2,2.5,5,10].map(f=>f*mag).find(s=>s>=raw) ?? mag*10;
  const start = Math.ceil(min/step)*step;
  const ticks: number[] = [];
  for (let t=start; t<=max+step*0.01; t=Math.round((t+step)*1e9)/1e9) ticks.push(t);
  return ticks;
}

function fmtK(v: number) { return v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v); }

const CHART_TICK_FONT = { fontFamily: fonts.mono, fontSize: 9 };

function CpueChart({ data, seriesKeys, scaledGear, width, onDotPress, yLabel = 'CPUE' }: {
  data: Record<string,number|null>[];
  seriesKeys: string[];
  scaledGear?: string | null;
  width: number;
  onDotPress?: (year: number, row: Record<string,number|null>) => void;
  yLabel?: string;
}) {
  const PAD_L=44, PAD_R=12, PAD_T=10, PAD_B=32;
  const h = 220;
  const plotW = width - PAD_L - PAD_R;
  const plotH = h - PAD_T - PAD_B;

  const years = data.map(d => d.year as number).sort((a,b)=>a-b);
  const keysForScale = scaledGear ? [scaledGear] : seriesKeys;
  const allVals = data.flatMap(d => keysForScale.map(k => d[k] as number|null).filter(v=>v!=null)) as number[];
  const yMax = allVals.length ? Math.max(...allVals)*1.15 : 1;
  const yTicks = niceTicks(0, yMax, 5);

  const xStep = years.length > 1 ? plotW / (years.length - 1) : plotW;
  const toX = (yr: number) => PAD_L + (years.indexOf(yr)) * xStep;
  const toY = (v: number) => PAD_T + plotH - (v / yMax) * plotH;

  return (
    <Svg width={width} height={h}>
      <Rect x={PAD_L} y={PAD_T} width={plotW} height={plotH}
        fill={colors.paper2} stroke={colors.ink} strokeWidth={0.8} />
      {yTicks.map(t => {
        const py = toY(t);
        return (
          <G key={t}>
            <Line x1={PAD_L} y1={py} x2={PAD_L+plotW} y2={py}
              stroke={colors.paper3} strokeWidth={0.5} strokeDasharray="2 3" />
            <SvgText x={PAD_L-4} y={py+3.5} {...CHART_TICK_FONT}
              textAnchor="end" fill={colors.inkSoft}>
              {t%1===0?t:t.toFixed(1)}
            </SvgText>
          </G>
        );
      })}
      {years.map((yr,i) => {
        const px = toX(yr);
        const step = Math.max(1, Math.ceil(years.length / 6));
        if (i % step !== 0 && i !== years.length - 1) return null;
        return <SvgText key={yr} x={px} y={h-6} {...CHART_TICK_FONT}
          textAnchor="middle" fill={colors.inkSoft}>{yr}</SvgText>;
      })}
      {seriesKeys.map((key, ki) => {
        const pts = data
          .filter(d => d[key] != null)
          .map(d => `${toX(d.year as number)},${toY(d[key] as number)}`);
        if (!pts.length) return null;
        const c = LINE_COLORS[ki%LINE_COLORS.length];
        return (
          <G key={key}>
            <Polyline points={pts.join(' ')} fill="none" stroke={c} strokeWidth={2} />
            {data.filter(d=>d[key]!=null).map(d => (
              <Circle key={d.year as number}
                cx={toX(d.year as number)} cy={toY(d[key] as number)}
                r={5} fill={c} stroke={colors.paper} strokeWidth={1.5} />
            ))}
          </G>
        );
      })}
      <SvgText x={10} y={PAD_T+plotH/2} {...CHART_TICK_FONT}
        textAnchor="middle" fill={colors.inkSoft}
        rotation="-90" originX={10} originY={PAD_T+plotH/2}>{yLabel}</SvgText>
      {onDotPress && years.length > 0 && (
        <Rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} fill="transparent"
          onPress={(evt) => {
            const tapX = (evt as GestureResponderEvent).nativeEvent.locationX ?? 0;
            const fracIdx = years.length > 1 ? tapX / xStep : 0;
            const idx = Math.max(0, Math.min(years.length - 1, Math.round(fracIdx)));
            const yr = years[idx];
            const row = data.find(d => (d.year as number) === yr);
            if (row) onDotPress(yr, row);
          }}
        />
      )}
    </Svg>
  );
}

function StockingChart({ data, stageKeys, width, onBarPress, adultsPerYear }: {
  data: Record<string,number>[];
  stageKeys: string[];
  width: number;
  onBarPress?: (year: number, row: Record<string,number> | undefined) => void;
  adultsPerYear?: { year: number; adults_per_100ac: number }[];
}) {
  const hasOverlay = !!adultsPerYear?.length;
  const PAD_L=44, PAD_R=hasOverlay ? 52 : 12, PAD_T=10, PAD_B=32;
  const h = 220;
  const plotW = width - PAD_L - PAD_R;
  const plotH = h - PAD_T - PAD_B;

  const stockYears = data.map(d=>d.year).sort((a,b)=>a-b);
  const allYears = [...new Set([...stockYears, ...(adultsPerYear ?? []).map(a=>a.year)])].sort((a,b)=>a-b);
  const xMin = allYears[0] ?? 0;
  const xMax = allYears[allYears.length-1] ?? xMin;
  const xRange = xMax - xMin;
  const xPad = xRange > 0 ? xRange * 0.06 : 1;
  const xScaleMin = xMin - xPad;
  const xScaleMax = xMax + xPad;
  const xScaleRange = xScaleMax - xScaleMin;
  const yearToX = (yr: number) => PAD_L + ((yr - xScaleMin) / xScaleRange) * plotW;

  const yMax = Math.max(...data.map(d => stageKeys.reduce((s,k)=>s+(d[k]||0),0))) * 1.1;
  const yTicks = niceTicks(0, yMax, 5);
  const barW = Math.max(3, Math.min(20, (plotW / Math.max(stockYears.length, 1)) * 0.5));

  const aMax = hasOverlay
    ? (Math.max(...adultsPerYear!.map(a => a.adults_per_100ac)) * 1.15 || 1)
    : 1;
  const aTicks = hasOverlay ? niceTicks(0, aMax, 4) : [];
  const toYAdult = (v: number) => PAD_T + plotH - (v / aMax) * plotH;

  return (
    <Svg width={width} height={h}>
      <Rect x={PAD_L} y={PAD_T} width={plotW} height={plotH}
        fill={colors.paper2} stroke={colors.ink} strokeWidth={0.8} />

      {yTicks.map(t => {
        const py = PAD_T + plotH - (t/yMax)*plotH;
        return (
          <G key={t}>
            <Line x1={PAD_L} y1={py} x2={PAD_L+plotW} y2={py}
              stroke={colors.paper3} strokeWidth={0.5} strokeDasharray="2 3" />
            <SvgText x={PAD_L-4} y={py+3.5} {...CHART_TICK_FONT}
              textAnchor="end" fill={colors.inkSoft}>{fmtK(t)}</SvgText>
          </G>
        );
      })}

      {hasOverlay && aTicks.map(t => {
        const py = toYAdult(t);
        return (
          <G key={`a${t}`}>
            <Line x1={PAD_L+plotW} y1={py} x2={PAD_L+plotW+4} y2={py}
              stroke={ADULT_LINE} strokeWidth={1} />
            <SvgText x={PAD_L+plotW+7} y={py+3.5} {...CHART_TICK_FONT}
              textAnchor="start" fill={ADULT_LINE}>
              {t < 10 ? t.toFixed(1) : String(Math.round(t))}
            </SvgText>
          </G>
        );
      })}

      {stockYears.map((yr) => {
        const cx = yearToX(yr);
        const row = data.find(d=>d.year===yr)!;
        let stackY = PAD_T + plotH;
        return (
          <G key={yr}>
            {stageKeys.map(stage => {
              const val = row[stage] || 0;
              if (!val) return null;
              const bh = (val/yMax)*plotH;
              stackY -= bh;
              return (
                <Rect key={stage} x={cx-barW/2} y={stackY} width={barW} height={bh}
                  fill={STAGE_COLORS[stage] ?? DEFAULT_COLOR} />
              );
            })}
          </G>
        );
      })}

      {(() => {
        const step = Math.max(1, Math.ceil(allYears.length / 6));
        return allYears
          .filter((_, i) => i % step === 0 || i === allYears.length - 1)
          .map(yr => (
            <SvgText key={`xl-${yr}`} x={yearToX(yr)} y={h-6} {...CHART_TICK_FONT}
              textAnchor="middle" fill={colors.inkSoft}>{yr}</SvgText>
          ));
      })()}

      {hasOverlay && (() => {
        const pts = adultsPerYear!.map(a => `${yearToX(a.year)},${toYAdult(a.adults_per_100ac)}`);
        const stockYearSet = new Set(stockYears);
        return (
          <G>
            {pts.length >= 2 && (
              <Polyline points={pts.join(' ')} fill="none"
                stroke={ADULT_LINE} strokeWidth={2} strokeDasharray="5 3" />
            )}
            {adultsPerYear!.filter(a => stockYearSet.has(a.year)).map(a => (
              <Circle key={a.year} cx={yearToX(a.year)} cy={toYAdult(a.adults_per_100ac)}
                r={3} fill={ADULT_LINE} stroke={colors.paper} strokeWidth={1.5} />
            ))}
          </G>
        );
      })()}

      {onBarPress && allYears.length > 0 && (
        <Rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} fill="transparent"
          onPress={(evt) => {
            const tapX = (evt as GestureResponderEvent).nativeEvent.locationX ?? 0;
            const svgX = PAD_L + tapX;
            let bestYear = allYears[0];
            let bestDist = Infinity;
            for (const yr of allYears) {
              const d = Math.abs(yearToX(yr) - svgX);
              if (d < bestDist) { bestDist = d; bestYear = yr; }
            }
            onBarPress(bestYear, data.find(d => d.year === bestYear));
          }}
        />
      )}

      <SvgText x={10} y={PAD_T+plotH/2} {...CHART_TICK_FONT}
        textAnchor="middle" fill={colors.inkSoft}
        rotation="-90" originX={10} originY={PAD_T+plotH/2}>Fish stocked</SvgText>
      {hasOverlay && (
        <SvgText x={width-8} y={PAD_T+plotH/2} {...CHART_TICK_FONT}
          textAnchor="middle" fill={ADULT_LINE}
          rotation="-90" originX={width-8} originY={PAD_T+plotH/2}>Est. adults/100ac</SvgText>
      )}
    </Svg>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={styles.legend}>
      {items.map(item => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text style={[text.labelM, { color: colors.inkSoft }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function LakeDetailScreen() {
  const route = useRoute<RouteT>();
  const navigation = useNavigation();
  const { lakeId, species: initialSpecies, state } = route.params;
  const { width } = useWindowDimensions();

  const [data, setData] = useState<LakeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'cpue'|'stocking'>('cpue');
  const [localSpecies, setLocalSpecies] = useState(initialSpecies);
  const [scaledGear, setScaledGear] = useState<string|null>(null);
  const [selectedStockYear, setSelectedStockYear] = useState<{year: number; row: Record<string,number> | undefined} | null>(null);
  const [selectedCpueYear, setSelectedCpueYear] = useState<{year: number; row: Record<string,number|null>} | null>(null);

  useEffect(() => {
    fetchLakeWithSpecies(lakeId, state, initialSpecies)
      .then(d => {
        const ld = d as LakeData;
        setData(ld);
        if (!initialSpecies) {
          const counts = new Map<string,number>();
          for (const c of ld.catches) counts.set(c.species,(counts.get(c.species)??0)+1);
          const top = [...counts.entries()].sort((a,b)=>b[1]-a[1])[0];
          if (top) setLocalSpecies(top[0]);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [lakeId, state, initialSpecies]);

  const lakeSpecies = useMemo(() => {
    if (!data) return [];
    const set = new Set([
      ...data.catches.filter(c => c.cpue != null || c.total_catch != null).map(c => c.species),
      ...data.stocking.map(s => s.species),
    ]);
    return [...set].sort((a, b) => {
      const aCode = state === 'sd' ? (SD_SPECIES_FROM_NAME[a] ?? a) : a;
      const bCode = state === 'sd' ? (SD_SPECIES_FROM_NAME[b] ?? b) : b;
      const ag = GAME_FISH_CODES.has(aCode);
      const bg = GAME_FISH_CODES.has(bCode);
      if (ag && !bg) return -1;
      if (!ag && bg) return 1;
      return a.localeCompare(b);
    });
  }, [data, state]);

  const { cpueChartData, gearKeys } = useMemo(() => {
    if (!data) return { cpueChartData: [], gearKeys: [] };
    const filtered = data.catches.filter(c =>
      (!localSpecies || c.species === localSpecies) &&
      c.cpue != null
    );
    const gearSet = new Set<string>();
    const byYearGear = new Map<string, number[]>();
    for (const c of filtered) {
      const gk = c.gear ?? (c.survey_type ?? 'Unknown');
      gearSet.add(gk);
      const key = `${c.survey_year}|${gk}`;
      if (!byYearGear.has(key)) byYearGear.set(key, []);
      byYearGear.get(key)!.push(c.cpue!);
    }
    const gearKeys = [...gearSet].sort();
    const yearMap = new Map<number, Record<string,number|null>>();
    for (const [key, vals] of byYearGear) {
      const [yr, gk] = key.split('|');
      const year = Number(yr);
      if (!yearMap.has(year)) yearMap.set(year, { year });
      const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
      const entry = yearMap.get(year)!;
      if (entry[gk] == null) entry[gk] = avg;
      else entry[gk] = ((entry[gk] as number) + avg) / 2;
    }
    const cpueChartData = [...yearMap.values()]
      .map(e => { const r: Record<string,number|null> = { year: e.year as number }; for (const g of gearKeys) r[g] = e[g] ?? null; return r; })
      .sort((a,b) => (a.year as number) - (b.year as number));
    const activeKeys = gearKeys.filter(g => cpueChartData.some(r => r[g] != null));
    return { cpueChartData, gearKeys: activeKeys };
  }, [data, localSpecies]);

  const { stockChartData, stageKeys } = useMemo(() => {
    if (!data) return { stockChartData: [], stageKeys: [] };
    const records = data.stocking.filter(s => !localSpecies || s.species === localSpecies);
    const stageSet = new Set<string>();
    const yearMap = new Map<number, Record<string,number>>();
    for (const r of records) {
      const stage = normalizeStage(r.life_stage);
      stageSet.add(stage);
      if (!yearMap.has(r.stock_year)) yearMap.set(r.stock_year, { year: r.stock_year });
      const entry = yearMap.get(r.stock_year)!;
      entry[stage] = (entry[stage] || 0) + r.quantity;
    }
    const stageOrder = ['fry','fingerling','yearling','adult'];
    const stageKeys = [...stageSet].sort((a,b)=>(stageOrder.indexOf(a)+1||99)-(stageOrder.indexOf(b)+1||99));
    return { stockChartData: [...yearMap.values()].sort((a,b)=>a.year-b.year), stageKeys };
  }, [data, localSpecies]);

  // Per-year adults/100ac comes from the server, computed by the same survival.js
  // that produces the headline metric — guarantees the chart's latest point
  // matches the headline reading.
  const stockingAdultsPerYear = useMemo(() => {
    if (!data?.metrics_by_year?.length) return [];
    return data.metrics_by_year
      .filter(m => !localSpecies || m.species === localSpecies)
      .map(m => ({ year: m.year, adults_per_100ac: m.adults_per_100ac }))
      .sort((a, b) => a.year - b.year);
  }, [data, localSpecies]);

  const latestReportId = data?.surveys?.[0]?.report_id;
  const chartWidth = width - 32;

  const speciesName = localSpecies
    ? speciesDisplayName(localSpecies, state)
    : 'All species';

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ActivityIndicator style={{flex:1}} size="large" color={colors.ink} />
    </SafeAreaView>
  );
  if (error || !data) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.errorBox}>
        <Text style={[text.bodyL, { color: colors.destructive }]}>{error ?? 'No data'}</Text>
      </View>
    </SafeAreaView>
  );

  const { lake, metrics } = data;
  const metricsForSpecies = metrics.filter(m => !localSpecies || m.species === localSpecies);
  const headlineMetric = metricsForSpecies[0];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <PaperHeader
        title={lake.name}
        eyebrow={lake.county
          ? `${lake.county.toUpperCase()} CO · ${state.toUpperCase()}`
          : state.toUpperCase()}
        onBack={() => navigation.goBack()}
        backLabel="←"
        right={lake.max_depth_feet ? `${lake.max_depth_feet} FT` : undefined}
      />

      <ScrollView style={{ backgroundColor: colors.paper }}>
        {/* Lake meta + source links */}
        <View style={styles.metaBar}>
          <Text style={[text.labelM, { color: colors.inkSoft }]}>
            {[
              lake.county ? `${lake.county.toUpperCase()} CO` : null,
              lake.area_acres ? `${lake.area_acres.toLocaleString()} AC` : null,
              lake.max_depth_feet ? `${lake.max_depth_feet} FT` : null,
            ].filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.linkRow}>
            {state === 'sd' && latestReportId ? (
              <Pressable onPress={() => Linking.openURL(SD_REPORT_URL(latestReportId))}>
                <Text style={[text.labelM, { color: colors.walleye2 }]}>SD GFP Report ↗</Text>
              </Pressable>
            ) : null}
            {state === 'mn' ? (
              <Pressable onPress={() => Linking.openURL(MN_LAKEFINDER_URL(lake.id))}>
                <Text style={[text.labelM, { color: colors.walleye2 }]}>MN DNR LakeFinder ↗</Text>
              </Pressable>
            ) : null}
            {state === 'ia' ? (
              <Pressable onPress={() => Linking.openURL(`https://programs.iowadnr.gov/lakemanagement/fishiowa/LakeDetails/${lake.id}`)}>
                <Text style={[text.labelM, { color: colors.walleye2 }]}>Iowa DNR Lake Page ↗</Text>
              </Pressable>
            ) : null}
            {state === 'ne' && (() => {
              const pdfs = [...new Set((data?.surveys ?? []).map(s => s.source_pdf).filter(Boolean))] as string[];
              return pdfs.map(pdf => (
                <Pressable key={pdf} onPress={() => Linking.openURL(`${API_BASE_URL}/api/ne/pdf/${encodeURIComponent(pdf)}`)}>
                  <Text style={[text.labelM, { color: colors.walleye2 }]}>
                    {pdf.replace(/[-_]/g, ' ').replace(/\.pdf$/i, '').replace(/\b(20\d\d)\b/, '($1)').trim()} ↗
                  </Text>
                </Pressable>
              ));
            })()}
          </View>
        </View>

        {/* Headline reading */}
        {headlineMetric && (
          <View style={styles.headline}>
            <Text style={[text.labelS, { color: colors.inkSoft }]}>
              {speciesDisplayName(headlineMetric.species, state).toUpperCase()} · POPULATION READING
            </Text>
            <Text style={[text.dataXL, { color: colors.ink, marginTop: 4 }]}>
              {headlineMetric.adults_per_100ac.toFixed(1)}{' '}
              <Text style={[text.bodyS, { color: colors.inkSoft }]}>est. adults / 100 ac</Text>
            </Text>
          </View>
        )}

        {/* Species selector */}
        {lakeSpecies.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={styles.speciesBar} contentContainerStyle={styles.speciesBarContent}>
            {lakeSpecies.map(sp => {
              const name = speciesDisplayName(sp, state);
              const active = localSpecies === sp;
              return (
                <Chip key={sp} active={active}
                  onPress={() => { setLocalSpecies(sp); setScaledGear(null); setSelectedStockYear(null); setSelectedCpueYear(null); }}>
                  {name}
                </Chip>
              );
            })}
          </ScrollView>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['cpue','stocking'] as const).map(t => {
            const on = tab === t;
            return (
              <Pressable key={t} style={[styles.tab, on && styles.tabActive]} onPress={() => setTab(t)}>
                <Text style={[
                  text.labelL,
                  { color: on ? colors.ink : colors.inkSoft, fontFamily: on ? fonts.monoSemi : fonts.mono },
                ]}>
                  {t === 'cpue' ? 'CPUE Over Time' : 'Stocking History'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* CPUE tab */}
        {tab === 'cpue' && (
          cpueChartData.length > 0 ? (
            <View style={styles.chartSection}>
              <Text style={[text.bodyS, { color: colors.inkSoft, marginBottom: 8 }]}>
                {state === 'ia'
                  ? 'Total fish caught from Iowa DNR comprehensive surveys. Each line = one gear type.'
                  : `CPUE (catch per net) from ${state==='sd'?'SD GFP':state==='nd'?'ND GF&P':state==='ne'?'Nebraska Game & Parks':'MN DNR'} netting surveys. Each line = one gear type.`}
              </Text>
              <CpueChart data={cpueChartData} seriesKeys={gearKeys} scaledGear={scaledGear} width={chartWidth}
                yLabel="CPUE"
                onDotPress={(year, row) => setSelectedCpueYear(prev => prev?.year === year ? null : { year, row })} />
              <Text style={[text.labelS, { color: colors.paper3, textAlign: 'center', marginTop: 4 }]}>
                Tap a dot to see year detail · tap a gear to rescale Y axis
              </Text>
              {selectedCpueYear && (
                <View style={styles.yearPopup}>
                  <View style={styles.yearPopupHeader}>
                    <Text style={[text.dataL, { color: colors.ink }]}>{selectedCpueYear.year}</Text>
                    <Pressable onPress={() => setSelectedCpueYear(null)} hitSlop={8}>
                      <Text style={[text.labelL, { color: colors.inkSoft }]}>✕</Text>
                    </Pressable>
                  </View>
                  {gearKeys.map((g, i) => {
                    const val = selectedCpueYear.row[g];
                    if (val == null) return null;
                    return (
                      <View key={g} style={styles.popupRow}>
                        <View style={[styles.popupDot, { backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }]} />
                        <Text style={[text.bodyM, { flex: 1, color: colors.ink2 }]} numberOfLines={1}>{g}</Text>
                        <Text style={[text.dataM, { color: colors.ink }]}>
                          {state === 'ia' ? (val as number).toLocaleString() : (val as number).toFixed(2)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
              <View style={styles.gearLegend}>
                {gearKeys.map((g, i) => {
                  const sel = scaledGear === g;
                  return (
                    <Pressable key={g}
                      style={[styles.gearChip, { borderColor: sel ? colors.ink : colors.paper3,
                        backgroundColor: sel ? colors.paper2 : colors.paper }]}
                      onPress={() => { setScaledGear(sel ? null : g); setSelectedCpueYear(null); }}>
                      <View style={[styles.gearDot, { backgroundColor: LINE_COLORS[i%LINE_COLORS.length] }]} />
                      <Text style={[text.labelM, { color: colors.ink }]} numberOfLines={1}>{g}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={[text.editorialS, { color: colors.inkSoft }]}>No CPUE data for {speciesName}</Text>
            </View>
          )
        )}

        {/* Stocking tab */}
        {tab === 'stocking' && (
          stockChartData.length > 0 ? (
            <View style={styles.chartSection}>
              <Text style={[text.bodyS, { color: colors.inkSoft, marginBottom: 8 }]}>
                Fish stocked by year. Bar colors = life stage at stocking.
                {stockingAdultsPerYear.length > 0 ? ' Dashed line = estimated adult fish/100ac from stocking (right axis).' : ''}
              </Text>
              <StockingChart data={stockChartData} stageKeys={stageKeys} width={chartWidth}
                onBarPress={(year, row) => setSelectedStockYear(prev => prev?.year === year ? null : { year, row })}
                adultsPerYear={stockingAdultsPerYear.length > 0 ? stockingAdultsPerYear : undefined} />
              {selectedStockYear && (
                <View style={styles.yearPopup}>
                  <View style={styles.yearPopupHeader}>
                    <Text style={[text.dataL, { color: colors.ink }]}>{selectedStockYear.year}</Text>
                    <Pressable onPress={() => setSelectedStockYear(null)} hitSlop={8}>
                      <Text style={[text.labelL, { color: colors.inkSoft }]}>✕</Text>
                    </Pressable>
                  </View>
                  {selectedStockYear.row && stageKeys.map(stage => {
                    const val = selectedStockYear.row![stage];
                    if (!val) return null;
                    return (
                      <View key={stage} style={styles.popupRow}>
                        <View style={[styles.popupDot, { backgroundColor: STAGE_COLORS[stage] ?? DEFAULT_COLOR }]} />
                        <Text style={[text.bodyM, { flex: 1, color: colors.ink2 }]}>
                          {stage.charAt(0).toUpperCase()+stage.slice(1)}
                        </Text>
                        <Text style={[text.dataM, { color: colors.ink }]}>{val.toLocaleString()}</Text>
                      </View>
                    );
                  })}
                  {selectedStockYear.row && (
                    <>
                      <View style={styles.popupDivider} />
                      <View style={styles.popupRow}>
                        <Text style={[text.bodyBold, { flex: 1, color: colors.ink }]}>Total stocked</Text>
                        <Text style={[text.dataM, { color: colors.ink }]}>
                          {stageKeys.reduce((s,k)=>s+(selectedStockYear.row![k]||0),0).toLocaleString()}
                        </Text>
                      </View>
                    </>
                  )}
                  {(() => {
                    const entry = stockingAdultsPerYear.find(a => a.year === selectedStockYear.year);
                    if (!entry) return null;
                    return (
                      <>
                        <View style={styles.popupDivider} />
                        <View style={styles.popupRow}>
                          <View style={[styles.popupDot, { backgroundColor: ADULT_LINE }]} />
                          <Text style={[text.bodyM, { flex: 1, color: colors.ink2 }]}>Est. adults/100ac</Text>
                          <Text style={[text.dataM, { color: ADULT_LINE }]}>
                            {entry.adults_per_100ac.toFixed(1)}
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
              )}
              <Legend items={[
                ...stageKeys.map(s => ({ label: s.charAt(0).toUpperCase()+s.slice(1), color: STAGE_COLORS[s] ?? DEFAULT_COLOR })),
                ...(stockingAdultsPerYear.length > 0 ? [{ label: 'Est. adults/100ac', color: ADULT_LINE }] : []),
              ]} />
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={[text.editorialS, { color: colors.inkSoft }]}>No stocking records for {speciesName}</Text>
            </View>
          )
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxxl },

  metaBar: {
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    backgroundColor: colors.paper,
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, marginTop: space.md },

  headline: {
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    backgroundColor: colors.paper2,
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },

  speciesBar: {
    backgroundColor: colors.paper,
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },
  speciesBarContent: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: 6,
  },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: hairline,
    borderBottomColor: colors.ink,
    backgroundColor: colors.paper,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.walleye },

  chartSection: { padding: space.xl },

  yearPopup: {
    marginTop: space.lg,
    backgroundColor: colors.paper2,
    borderWidth: hairline,
    borderColor: colors.ink,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  yearPopupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  popupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  popupDot: { width: 10, height: 10, flexShrink: 0 },
  popupDivider: { height: hairline, backgroundColor: colors.paper3, marginVertical: 6 },

  gearLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.md },
  gearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: hairline,
    maxWidth: 200,
  },
  gearDot: { width: 10, height: 10, flexShrink: 0 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, marginTop: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12 },

  emptyChart: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
