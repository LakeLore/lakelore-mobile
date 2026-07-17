import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Pressable, ActivityIndicator, Linking, useWindowDimensions,
  GestureResponderEvent, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Application from 'expo-application';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import Svg, { Line, Polyline, Circle, Rect, Text as SvgText, G } from 'react-native-svg';
import { fetchLakeWithSpecies, SubscriptionRequiredError, submitFeedback } from '../api';
import { putLake, getLake } from '../lakeCache';
import { useToast } from '../Toast';
import { StateKey, STATE_CONFIGS, GENERATED_STATES, speciesDisplayName, SD_SPECIES_FROM_NAME } from '../types';
import PaywallScreen from './PaywallScreen';
import BlurredLakeName from '../components/BlurredLakeName';
import { colors, text, space, hairline, fonts } from '../lakelore-rn/theme';
import { PaperHeader, Chip, PrimaryButton, LockIcon } from '../lakelore-rn/components';

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
// Iowa DNR's Fisheries Data Dashboard is a public Power BI report. We deep-link
// to the Survey Visit Summary tab so users skip the Menu landing page. The
// SiteName/SampleDate slicers are ChicletSlicer custom visuals that ignore
// Power BI's `?filter=` URL param, so the user types the lake name in the
// in-page search box to filter to their lake.
const IA_PBI_SURVEY_URL =
  'https://app.powerbi.com/view?r=eyJrIjoiOTNlM2M0YzQtNjUzNS00Yzk5LTlmMjYtNmQ5NGM3NTk0MTIxIiwidCI6ImU5MDM1MTk5LWQwNWEtNDExZS1iNzFkLWRkN2E5NWZkZGI2OCIsImMiOjZ9&pageName=ReportSectione96673ea27f95717c464';
// IA stocking comes from the lake's public Fish Iowa LakeDetails page — same
// URL the scraper hits to extract stocking rows.
const IA_LAKE_DETAILS_URL = (id: number | string) =>
  `https://programs.iowadnr.gov/lakemanagement/fishiowa/LakeDetails/${id}`;
// ND has separate per-lake report pages for survey vs stocking.
const ND_SURVEY_URL = (id: number | string) =>
  `https://gfappspublic.nd.gov/wheretofish/SurveyReport.aspx?Lake=${id}`;
const ND_STOCKING_URL = (id: number | string) =>
  `https://gfappspublic.nd.gov/wheretofish/StockingReport.aspx?Lake=${id}`;
// NE and WI scrape stocking from internal/staff APIs with no per-lake user
// page — link to the state-wide stocking database/search interface instead.
const NE_STOCKING_URL = 'https://outdoornebraska.gov/conservation/fisheries-management/fish-stocking-program/fish-stocking-database/';
const WI_STOCKING_URL = 'https://apps.dnr.wi.gov/fisheriesmanagement/Public/Summary/Index';

// States with hand-built per-lake source links above. Everyone else gets a
// generic agency link (homepage from the generated registry export) so every
// state's detail screen credits and links its data source, like MN does.
const BESPOKE_SOURCE_LINK_STATES = new Set<StateKey>(['sd', 'mn', 'ia', 'nd', 'ne', 'wi', 'mi']);

// name/county/area_acres are null in paid-state preview — the server redacts
// lake identity for non-subscribers (metrics still ship in full).
interface Lake {
  id: number | string; name: string | null; county: string | null;
  area_acres?: number | null; max_depth_feet?: number | null;
}
interface CatchRow {
  species: string; gear: string | null; survey_id: number | string;
  survey_year: number; report_id?: number | null; survey_date?: string | null;
  survey_type?: string | null;
  cpue: number | null;
  average_weight?: number | null; total_catch?: number | null; gear_count?: number | null;
  average_length?: number | null; species_name?: string | null;
  // Agency forecast rating — on the /lake wire for the ratings-tier states
  // (GA/MO/IL/FL/KY/OK/KS) since 2026-07-17; null/absent elsewhere.
  rating?: string | null; rating_ordinal?: number | null;
}
interface StockRow { stock_year: number; species: string; life_stage: string; quantity: number }
// adults_per_100ac is null for lakes with no usable acreage (metricsV2) —
// adults_est (absolute estimated survivors) carries the metric instead.
interface MetricRow { species: string; adults_per_100ac: number | null; adults_est?: number | null }
interface MetricByYearRow { species: string; year: number; adults_per_100ac: number | null; adults_est?: number | null }
interface LakeData { lake: Lake; surveys: { id: number|string; report_id?: number|null; source_pdf?: string|null; source_url?: string|null }[]; catches: CatchRow[]; stocking: StockRow[]; metrics: MetricRow[]; metrics_by_year?: MetricByYearRow[]; latest_stocking_report_id?: number|null; preview?: boolean }

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

// Shared year×gear line-series builder for the Catch and Avg Size tabs: one
// line per gear, values averaged when a year has multiple surveys with the
// same gear.
function buildYearGearSeries(rows: CatchRow[], value: (c: CatchRow) => number | null | undefined) {
  const gearSet = new Set<string>();
  const byYearGear = new Map<string, number[]>();
  for (const c of rows) {
    const v = value(c);
    if (v == null) continue;
    const gk = c.gear ?? (c.survey_type ?? 'Unknown');
    gearSet.add(gk);
    const key = `${c.survey_year}|${gk}`;
    if (!byYearGear.has(key)) byYearGear.set(key, []);
    byYearGear.get(key)!.push(v);
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
  const chartData = [...yearMap.values()]
    .map(e => { const r: Record<string,number|null> = { year: e.year as number }; for (const g of gearKeys) r[g] = e[g] ?? null; return r; })
    .sort((a,b) => (a.year as number) - (b.year as number));
  const activeKeys = gearKeys.filter(g => chartData.some(r => r[g] != null));
  return { chartData, gearKeys: activeKeys };
}

// Catch-tab caption phrase, honest about what this state's cpue IS (keyed off
// the generated cpueKind). Replaces the pre-all-states-launch hardcoded
// ternary that credited "MN DNR netting surveys" for every fleet state.
function cpueMetricPhrase(state: StateKey): string {
  switch (GENERATED_STATES[state]?.cpueKind) {
    case 'relative': return 'Relative catch index';
    case 'creel': return 'Angler catch rate';
    default: return 'Catch rate';
  }
}

// Title-case an agency rating string ('excellent' -> 'Excellent').
const fmtRating = (s: string) => s.replace(/\b\w/g, ch => ch.toUpperCase());

const CHART_TICK_FONT = { fontFamily: fonts.mono, fontSize: 9 };

function CpueChart({ data, seriesKeys, scaledGear, width, onDotPress, yLabel = 'Catch Rate' }: {
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
  // Bar width scales to the actual smallest gap between consecutive stocking
  // years on the x-scale — not bars-per-plotW. The x-scale extends to include
  // adultsPerYear (which runs to the current year for the overlay line), so
  // sparse stocking years can sit much closer together than plotW/stockYears.length
  // would suggest. Without this, lakes with multiple consecutive stocking years
  // get bars wider than their year-to-year spacing, causing overlap.
  const pxPerYear = xScaleRange > 0 ? plotW / xScaleRange : plotW;
  const minStockGap = stockYears.length > 1
    ? Math.min(...stockYears.slice(1).map((y, i) => y - stockYears[i]))
    : Math.max(xScaleRange, 1);
  const barW = Math.max(3, Math.min(20, pxPerYear * minStockGap * 0.8));

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
        const lastYear = adultsPerYear![adultsPerYear!.length - 1]?.year;
        return (
          <G>
            {pts.length >= 2 && (
              <Polyline points={pts.join(' ')} fill="none"
                stroke={ADULT_LINE} strokeWidth={2} strokeDasharray="5 3" />
            )}
            {/* Mark every overlay point — stocking-year vs non-stocking-year is
                already conveyed by the bars below, so dots here just anchor the
                survival curve so the latest value (often years after the last
                stocking event) is visible, not just clickable. The most recent
                year gets a larger dot to emphasize the current population. */}
            {adultsPerYear!.map(a => (
              <Circle key={a.year} cx={yearToX(a.year)} cy={toYAdult(a.adults_per_100ac)}
                r={a.year === lastYear ? 4 : 3}
                fill={ADULT_LINE} stroke={colors.paper} strokeWidth={1.5} />
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
          rotation="-90" originX={width-8} originY={PAD_T+plotH/2}>Stck Adults / 100AC</SvgText>
      )}
    </Svg>
  );
}

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <View style={styles.legend}>
      {items.map(item => (
        <View key={item.label} style={styles.legendItem}>
          {item.dashed ? (
            <Svg width={12} height={12}>
              <Line x1={0} y1={6} x2={12} y2={6}
                stroke={item.color} strokeWidth={2} strokeDasharray="5 3" />
            </Svg>
          ) : (
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          )}
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
  const [tab, setTab] = useState<'cpue'|'size'|'stocking'>('cpue');
  const [localSpecies, setLocalSpecies] = useState(initialSpecies);
  const [scaledGear, setScaledGear] = useState<string|null>(null);
  const [selectedStockYear, setSelectedStockYear] = useState<{year: number; row: Record<string,number> | undefined} | null>(null);
  const [selectedCpueYear, setSelectedCpueYear] = useState<{year: number; row: Record<string,number|null>} | null>(null);
  const [selectedSizeYear, setSelectedSizeYear] = useState<{year: number; row: Record<string,number|null>} | null>(null);
  const [cacheDate, setCacheDate] = useState<number | null>(null);
  const [paywallTriggered, setPaywallTriggered] = useState<StateKey | null>(null);
  // True when the paywall came from the preview banner (screen still usable
  // behind it) rather than a hard 402 (screen has nothing to show).
  const [paywallFromBanner, setPaywallFromBanner] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const { toast } = useToast();

  const applyLake = React.useCallback((ld: LakeData) => {
    setData(ld);
    if (!initialSpecies) {
      const counts = new Map<string,number>();
      for (const c of ld.catches) counts.set(c.species,(counts.get(c.species)??0)+1);
      const top = [...counts.entries()].sort((a,b)=>b[1]-a[1])[0];
      if (top) setLocalSpecies(top[0]);
    }
    // Open on the first tab that actually has data: rating- and
    // stocking-only lakes otherwise land on an empty Catch tab and the
    // user must discover the Stocking tab themselves (A5).
    if (!ld.catches.some(c => c.cpue != null)) {
      const hasSize = ld.catches.some(c => (c.average_length ?? 0) > 0 || (c.average_weight ?? 0) > 0);
      if (hasSize) setTab('size');
      else if (ld.stocking.length > 0) setTab('stocking');
    }
  }, [initialSpecies]);

  const loadLake = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetchLakeWithSpecies(lakeId, state, initialSpecies)
      .then(d => {
        const ld = d as LakeData;
        setCacheDate(null);
        applyLake(ld);
        putLake(state, lakeId, ld); // fire-and-forget offline cache (D1)
      })
      .catch(async err => {
        if (err instanceof SubscriptionRequiredError) {
          setPaywallTriggered(err.state);
          return;
        }
        // Offline: serve the cached payload for a recently-viewed lake
        // (stale beats a dead-end at the water) with a dated banner.
        const isNetwork = err instanceof Error && /reach server|timed out/.test(err.message);
        if (isNetwork) {
          const cached = await getLake(state, lakeId);
          if (cached?.data) {
            applyLake(cached.data as LakeData);
            setCacheDate(cached.ts ?? null);
            return;
          }
        }
        setError(err instanceof Error ? err.message : 'Could not load lake');
      })
      .finally(() => setLoading(false));
  }, [lakeId, state, initialSpecies, applyLake]);

  useEffect(() => { loadLake(); }, [loadLake]);

  // Shareable branded lake card (IMPROVEMENT_PLAN P3.3): captures the
  // detail content (charts + the lakeloreapp.com footer line) as a PNG and
  // opens the share sheet. Native modules (view-shot / expo-sharing) are
  // REQUIRED LAZILY: OTA bundles run on older binaries that don't ship
  // them — a top-level import would crash those at launch.
  const shareRef = React.useRef<View>(null);
  const shareLakeCard = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { captureRef } = require('react-native-view-shot');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Sharing = require('expo-sharing');
      if (!(await Sharing.isAvailableAsync())) {
        toast('Sharing is not available on this device.');
        return;
      }
      const uri = await captureRef(shareRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share lake card' });
    } catch {
      toast('Sharing needs the latest app version from the store.');
    }
  };

  const lakeSpecies = useMemo(() => {
    if (!data) return [];
    const set = new Set([
      // average_length/weight included: some states (e.g. CA) carry measured
      // size on rows with no CPUE — those species still deserve a chip.
      ...data.catches.filter(c => c.cpue != null || c.total_catch != null
        || c.average_length != null || c.average_weight != null).map(c => c.species),
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
    const filtered = data.catches.filter(c => !localSpecies || c.species === localSpecies);
    const { chartData, gearKeys } = buildYearGearSeries(filtered, c => c.cpue);
    return { cpueChartData: chartData, gearKeys };
  }, [data, localSpecies]);

  // Avg Size tab: average length (inches) where the state reports it; MN
  // reports average weight (lbs) instead — the tab adapts per lake and hides
  // entirely when the lake has neither.
  const { sizeChartData, sizeGearKeys, sizeField } = useMemo(() => {
    if (!data) return { sizeChartData: [], sizeGearKeys: [], sizeField: null as 'average_length'|'average_weight'|null };
    const field: 'average_length'|'average_weight'|null =
      data.catches.some(c => (c.average_length ?? 0) > 0) ? 'average_length'
      : data.catches.some(c => (c.average_weight ?? 0) > 0) ? 'average_weight'
      : null;
    if (!field) return { sizeChartData: [], sizeGearKeys: [], sizeField: null };
    const filtered = data.catches.filter(c => !localSpecies || c.species === localSpecies);
    // A 0 average is a survey placeholder (no fish measured), not a real size.
    const { chartData, gearKeys } = buildYearGearSeries(filtered, c => (c[field] ?? 0) > 0 ? c[field] : null);
    return { sizeChartData: chartData, sizeGearKeys: gearKeys, sizeField: field };
  }, [data, localSpecies]);
  const sizeUnit = sizeField === 'average_weight' ? 'lb' : 'in';

  // Latest agency forecast rating for the selected species (ratings-tier
  // states). This is those states' HEADLINE metric — before 2026-07-17 it
  // appeared in results but vanished entirely on this screen (A5).
  const latestRating = useMemo(() => {
    if (!data) return null;
    let best: { rating: string; year: number | null } | null = null;
    for (const c of data.catches) {
      if (c.rating == null) continue;
      if (localSpecies && c.species !== localSpecies) continue;
      if (!best || (c.survey_year ?? 0) > (best.year ?? 0)) {
        best = { rating: c.rating, year: c.survey_year ?? null };
      }
    }
    return best;
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
  //
  // Lakes with no usable acreage (metricsV2): the server sends
  // adults_per_100ac null + adults_est absolute — the chart plots the same
  // line with the absolute values and the labels switch to "Est. Stocked
  // Adults".
  const stockingAdultsAbsolute = useMemo(() =>
    !!data?.metrics_by_year?.length &&
    data.metrics_by_year.every(m => m.adults_per_100ac == null),
  [data]);
  const stockingAdultsPerYear = useMemo(() => {
    if (!data?.metrics_by_year?.length) return [];
    return data.metrics_by_year
      .filter(m => !localSpecies || m.species === localSpecies)
      .map(m => ({ year: m.year, adults_per_100ac: (m.adults_per_100ac ?? m.adults_est ?? 0) }))
      .filter(m => m.adults_per_100ac > 0)
      .sort((a, b) => a.year - b.year);
  }, [data, localSpecies]);
  const stockedAdultsLabel = stockingAdultsAbsolute ? 'Est. Stocked Adults' : 'Stck Adults / 100AC';

  // When a species is selected, the source-document link should point at the
  // most-recent survey that actually contains that species — not the lake's
  // overall latest report. The user might be viewing Crappie data from a
  // 2020 trap-net survey, but the lake's latest report (e.g. 2023 gill net)
  // wouldn't contain Crappie at all.
  // Surveys are returned year-DESC by the server, so the first match wins.
  const speciesSurveyIds = useMemo(() => {
    if (!localSpecies || !data?.catches) return null;
    return new Set(data.catches
      .filter(c => c.species === localSpecies)
      .map(c => String(c.survey_id)));
  }, [localSpecies, data?.catches]);

  const latestReportId = useMemo(() => {
    const pick = (data?.surveys ?? []).find(s =>
      s.report_id != null && (!speciesSurveyIds || speciesSurveyIds.has(String(s.id))),
    );
    return pick?.report_id ?? null;
  }, [data?.surveys, speciesSurveyIds]);
  const chartWidth = width - 32;

  const speciesName = localSpecies
    ? speciesDisplayName(localSpecies, state)
    : 'All species';

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <PaperHeader
        title="Loading…"
        eyebrow={state.toUpperCase()}
        onBack={() => navigation.goBack()}
        backLabel="←"
      />
      <ActivityIndicator style={{flex:1}} size="large" color={colors.ink} />
    </SafeAreaView>
  );
  if (error || !data) return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <PaperHeader
        title="Couldn’t load lake"
        eyebrow={state.toUpperCase()}
        onBack={() => navigation.goBack()}
        backLabel="←"
      />
      <View style={styles.errorBox}>
        <Text style={[text.bodyL, { color: colors.destructive, textAlign: 'center' }]}>
          {error ?? 'No data for this lake.'}
        </Text>
        <PrimaryButton onPress={loadLake} style={styles.errorRetry}>
          Try again
        </PrimaryButton>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ marginTop: space.lg }}>
          <Text style={[text.labelL, { color: colors.inkSoft }]}>Go back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );

  const { lake } = data;
  const isPreview = data.preview === true;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <PaperHeader
        title={lake.name != null
          ? lake.name
          : <BlurredLakeName seed={lake.id} onDark style={[text.displayL, { marginTop: 2 }]} />}
        eyebrow={lake.county
          ? `${lake.county.toUpperCase()} CO · ${state.toUpperCase()}`
          : state.toUpperCase()}
        onBack={() => navigation.goBack()}
        backLabel="←"
        right={lake.max_depth_feet ? `${Math.round(lake.max_depth_feet)} FT` : undefined}
      />

      {/* Preview banner — identity redacted, everything else live. */}
      {isPreview && (
        <View style={styles.previewBanner}>
          <LockIcon size={10} color={colors.paper} />
          <Text style={[text.labelM, { color: colors.paper, flex: 1 }]} numberOfLines={2}>
            Preview — this lake’s name &amp; location are hidden
          </Text>
          <Pressable
            onPress={() => { setPaywallFromBanner(true); setPaywallTriggered(state); }}
            accessibilityRole="button"
            accessibilityLabel="Unlock lake names with the All-States subscription"
            style={styles.unlockBtn}>
            <Text style={[text.labelM, { color: colors.ink }]}>Unlock</Text>
          </Pressable>
        </View>
      )}

      {/* Offline cache banner (D1) — same copy pattern as SearchScreen's. */}
      {cacheDate != null && (
        <View style={styles.cacheBanner}>
          <Text style={[text.labelM, { color: colors.ink2, flex: 1 }]} numberOfLines={1}>
            Offline — showing this lake saved {new Date(cacheDate).toLocaleDateString()}
          </Text>
          <Pressable onPress={loadLake} hitSlop={8}
            accessibilityRole="button" accessibilityLabel="Retry loading lake">
            <Text style={[text.labelM, { color: colors.walleye2 }]}>Retry</Text>
          </Pressable>
        </View>
      )}

      <ScrollView style={{ backgroundColor: colors.paper }}>
       {/* collapsable=false: Android flattens plain Views, which breaks
           view-shot's node lookup for the share card. */}
       <View ref={shareRef} collapsable={false} style={{ backgroundColor: colors.paper }}>
        {/* Lake meta + source links */}
        <View style={styles.metaBar}>
          <Text style={[text.labelM, { color: colors.inkSoft }]}>
            {[
              lake.county ? `${lake.county.toUpperCase()} CO` : null,
              lake.area_acres ? `${Math.round(lake.area_acres).toLocaleString()} AC` : null,
              lake.max_depth_feet ? `${Math.round(lake.max_depth_feet)} FT` : null,
            ].filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.linkRow}>
            {/* Source links are hidden in preview — they resolve to agency
                pages/PDFs that name the lake (and preview ids are hashed, so
                id-based URLs wouldn't work anyway). */}
            {!isPreview && <>
            {state === 'sd' && tab !== 'stocking' && latestReportId ? (
              <Pressable
                onPress={() => Linking.openURL(SD_REPORT_URL(latestReportId))}
                accessibilityRole="link"
                accessibilityLabel="Open SD GFP report"
                accessibilityHint="Opens in browser">
                <Text style={[text.labelM, { color: colors.walleye2 }]}>SD GFP Report ↗</Text>
              </Pressable>
            ) : null}
            {state === 'sd' && tab === 'stocking' && (data?.latest_stocking_report_id ?? latestReportId) ? (
              <Pressable
                onPress={() => Linking.openURL(SD_REPORT_URL((data?.latest_stocking_report_id ?? latestReportId) as number))}
                accessibilityRole="link"
                accessibilityLabel="Open SD GFP stocking report"
                accessibilityHint="Opens in browser">
                <Text style={[text.labelM, { color: colors.walleye2 }]}>SD GFP Stocking Report ↗</Text>
              </Pressable>
            ) : null}
            {state === 'mn' ? (
              <Pressable
                onPress={() => Linking.openURL(MN_LAKEFINDER_URL(lake.id))}
                accessibilityRole="link"
                accessibilityLabel="Open MN DNR LakeFinder"
                accessibilityHint="Opens in browser">
                <Text style={[text.labelM, { color: colors.walleye2 }]}>MN DNR LakeFinder ↗</Text>
              </Pressable>
            ) : null}
            {state === 'ia' && tab !== 'stocking' && (
              <Pressable
                onPress={() => Linking.openURL(IA_PBI_SURVEY_URL)}
                accessibilityRole="link"
                accessibilityLabel="Open Iowa DNR Survey Visit Summary"
                accessibilityHint="Opens in browser">
                <Text style={[text.labelM, { color: colors.walleye2 }]}>Iowa DNR Survey Visit Summary ↗</Text>
              </Pressable>
            )}
            {state === 'ia' && tab === 'stocking' && (
              <Pressable
                onPress={() => Linking.openURL(IA_LAKE_DETAILS_URL(lake.id))}
                accessibilityRole="link"
                accessibilityLabel="Open Iowa DNR lake stocking record"
                accessibilityHint="Opens in browser">
                <Text style={[text.labelM, { color: colors.walleye2 }]}>Iowa DNR Lake Stocking Record ↗</Text>
              </Pressable>
            )}
            {/* NE/MI/WI — CPUE tab (and MI Stocking too): per-lake survey PDF.
                Most recent survey with a source_pdf, narrowed by the currently-
                selected species when one is picked. URL per state:
                  NE: source_url captured directly during scrape (Cloudflare page)
                  WI: source_url captured from WDNR's reports index
                  MI: stable DNR directory listing — built from the filename */}
            {(state === 'ne' || state === 'mi' || state === 'wi') &&
              (tab !== 'stocking' || state === 'mi') && (() => {
              const pick = (data?.surveys ?? []).find(s =>
                s.source_pdf && (!speciesSurveyIds || speciesSurveyIds.has(String(s.id))),
              );
              if (!pick?.source_pdf) return null;
              const filename = pick.source_pdf;
              let url: string | null = null;
              if (state === 'ne' || state === 'wi') url = pick.source_url ?? null;
              else if (state === 'mi') url = `https://www2.dnr.state.mi.us/publications/pdfs/DNRFishLibrary/StatusoftheFisheryResourceReports/${filename}`;
              if (!url) return null;
              const label = filename.replace(/^Reports_/i, '').replace(/[-_]/g, ' ').replace(/\.pdf$/i, '').replace(/\b(20\d\d)\b/, '($1)').trim();
              return (
                <Pressable
                  onPress={() => Linking.openURL(url!)}
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${label}`}
                  accessibilityHint="Opens in browser">
                  <Text style={[text.labelM, { color: colors.walleye2 }]}>{label} ↗</Text>
                </Pressable>
              );
            })()}
            {state === 'ne' && tab === 'stocking' && (
              <Pressable
                onPress={() => Linking.openURL(NE_STOCKING_URL)}
                accessibilityRole="link"
                accessibilityLabel="Open NE Fish Stocking Database"
                accessibilityHint="Opens in browser">
                <Text style={[text.labelM, { color: colors.walleye2 }]}>NE Fish Stocking Database ↗</Text>
              </Pressable>
            )}
            {state === 'wi' && tab === 'stocking' && (
              <Pressable
                onPress={() => Linking.openURL(WI_STOCKING_URL)}
                accessibilityRole="link"
                accessibilityLabel="Open WI Stocking Records Search"
                accessibilityHint="Opens in browser">
                <Text style={[text.labelM, { color: colors.walleye2 }]}>WI Stocking Records Search ↗</Text>
              </Pressable>
            )}
            {state === 'nd' && tab !== 'stocking' && (
              <Pressable
                onPress={() => Linking.openURL(ND_SURVEY_URL(lake.id))}
                accessibilityRole="link"
                accessibilityLabel="Open ND survey report"
                accessibilityHint="Opens in browser">
                <Text style={[text.labelM, { color: colors.walleye2 }]}>ND Survey Report ↗</Text>
              </Pressable>
            )}
            {state === 'nd' && tab === 'stocking' && (
              <Pressable
                onPress={() => Linking.openURL(ND_STOCKING_URL(lake.id))}
                accessibilityRole="link"
                accessibilityLabel="Open ND stocking report"
                accessibilityHint="Opens in browser">
                <Text style={[text.labelM, { color: colors.walleye2 }]}>ND Stocking Report ↗</Text>
              </Pressable>
            )}
            {/* Non-legacy states: deep link to THIS lake's source wherever the
                pipeline captured one (per-lake agency pages, survey-summary /
                management-plan PDFs, forecast documents) — most recent survey
                with a source_url, narrowed by the selected species like the
                NE/WI/MI block above. Falls back to the agency homepage. */}
            {!BESPOKE_SOURCE_LINK_STATES.has(state) && (() => {
              // Guard on http(s) — some states' source_url carries a
              // provenance label (e.g. OR "myodfw stocked-waters KML"), not
              // a link.
              const linkable = (s: { source_url?: string | null }) =>
                !!s.source_url && /^https?:/i.test(s.source_url);
              const pick = (data?.surveys ?? []).find(s =>
                linkable(s) && (!speciesSurveyIds || speciesSurveyIds.has(String(s.id))),
              ) ?? (data?.surveys ?? []).find(linkable);
              if (!pick?.source_url) return null;
              const isPdf = /\.pdf(\?|$)/i.test(pick.source_url);
              return (
                <Pressable
                  onPress={() => Linking.openURL(pick.source_url!)}
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${GENERATED_STATES[state].agency} source for this lake`}
                  accessibilityHint="Opens in browser">
                  <Text style={[text.labelM, { color: colors.walleye2 }]}>
                    {isPdf ? 'Survey Report ↗' : 'Agency Lake Page ↗'}
                  </Text>
                </Pressable>
              );
            })()}
            {!BESPOKE_SOURCE_LINK_STATES.has(state) && !!GENERATED_STATES[state].agencyUrl && (
              <Pressable
                onPress={() => Linking.openURL(GENERATED_STATES[state].agencyUrl)}
                accessibilityRole="link"
                accessibilityLabel={`Open ${GENERATED_STATES[state].agency} website`}
                accessibilityHint="Opens in browser">
                <Text style={[text.labelM, { color: colors.walleye2 }]}>
                  {GENERATED_STATES[state].agency} ↗
                </Text>
              </Pressable>
            )}
            </>}
            {!isPreview && (
              <Pressable
                onPress={shareLakeCard}
                accessibilityRole="button"
                accessibilityLabel="Share this lake as an image">
                <Text style={[text.labelM, { color: colors.walleye2 }]}>Share Lake Card</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => { setFeedbackText(''); setFeedbackOpen(true); }}
              accessibilityRole="button"
              accessibilityLabel="Report data issue">
              <Text style={[text.labelM, { color: colors.inkSoft }]}>Report data issue</Text>
            </Pressable>
          </View>
        </View>

        {/* Species selector */}
        {lakeSpecies.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={styles.speciesBar} contentContainerStyle={styles.speciesBarContent}>
            {lakeSpecies.map(sp => {
              const name = speciesDisplayName(sp, state);
              const active = localSpecies === sp;
              return (
                <Chip key={sp} active={active}
                  onPress={() => { setLocalSpecies(sp); setScaledGear(null); setSelectedStockYear(null); setSelectedCpueYear(null); setSelectedSizeYear(null); }}>
                  {name}
                </Chip>
              );
            })}
          </ScrollView>
        )}

        {/* Agency forecast rating (GA/MO/IL/FL/KY/OK/KS) — shown above the
            tabs so it's visible whichever tab has data. */}
        {latestRating && (
          <Pressable
            style={styles.ratingBadge}
            onPress={() => toast(`Forecast — ${GENERATED_STATES[state].agency}'s own fishing-forecast rating for this species at this lake.`)}
            accessibilityRole="button"
            accessibilityLabel={`Forecast rating ${fmtRating(latestRating.rating)}${latestRating.year ? `, ${latestRating.year}` : ''}. Tap for definition.`}>
            <Text style={[text.labelM, { color: colors.walleye2 }]}>FORECAST</Text>
            <Text style={[text.dataL, { color: colors.ink }]}>
              {fmtRating(latestRating.rating)}{latestRating.year ? `  ·  ${latestRating.year}` : ''}
            </Text>
          </Pressable>
        )}

        {/* Tabs — Avg Size only shows when this lake reports a size metric
            (average length, or average weight in MN). ONE vocabulary whatever
            the tab count (D9 — the old two-tab layout switched to 'Catch Over
            Time'/'Stocking History', same concepts under different names). */}
        <View style={styles.tabs}>
          {(sizeField ? (['cpue','size','stocking'] as const) : (['cpue','stocking'] as const)).map(t => {
            const on = tab === t;
            const label = t === 'cpue' ? 'Catch' : t === 'size' ? 'Avg Size' : 'Stocking';
            return (
              <Pressable key={t} style={[styles.tab, on && styles.tabActive]} onPress={() => setTab(t)}>
                <Text numberOfLines={1} style={[
                  text.labelL,
                  { color: on ? colors.ink : colors.inkSoft, fontFamily: on ? fonts.monoSemi : fonts.mono },
                ]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* CPUE tab */}
        {tab === 'cpue' && (
          cpueChartData.length > 0 ? (
            <View style={styles.chartSection}
              accessible
              accessibilityLabel={`Catch chart for ${speciesName}: ${gearKeys.length} gear ${gearKeys.length === 1 ? 'series' : 'series'} across ${cpueChartData.length} survey ${cpueChartData.length === 1 ? 'year' : 'years'}, ${cpueChartData[0]?.year} to ${cpueChartData[cpueChartData.length - 1]?.year}`}>
              <Text style={[text.bodyS, { color: colors.inkSoft, marginBottom: 8 }]}>
                {state === 'ia'
                  ? 'Total fish caught from Iowa DNR comprehensive surveys. Each line = one gear type.'
                  : `${cpueMetricPhrase(state)} from ${GENERATED_STATES[state].agency} surveys. Each line = one gear type.`}
              </Text>
              <CpueChart data={cpueChartData} seriesKeys={gearKeys} scaledGear={scaledGear} width={chartWidth}
                yLabel={GENERATED_STATES[state]?.cpueKind === 'relative' ? 'Catch Index' : 'Catch Rate'}
                onDotPress={(year, row) => setSelectedCpueYear(prev => prev?.year === year ? null : { year, row })} />
              <Text style={[text.bodyS, { color: colors.inkSoft, textAlign: 'center', marginTop: 4 }]}>
                Tap a dot to see year detail · tap a gear to rescale Y axis
              </Text>
              {selectedCpueYear && (
                <View style={styles.yearPopup}>
                  <View style={styles.yearPopupHeader}>
                    <Text style={[text.dataL, { color: colors.ink }]}>{selectedCpueYear.year}</Text>
                    <Pressable
                      onPress={() => setSelectedCpueYear(null)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Close year detail">
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
              <Text style={[text.editorialS, { color: colors.inkSoft }]}>No catch data for {speciesName}</Text>
            </View>
          )
        )}

        {/* Avg Size tab — same line chart as Catch, y-axis is the state's
            size metric (avg length in inches, or avg weight in lbs for MN). */}
        {tab === 'size' && (
          sizeChartData.length > 0 ? (
            <View style={styles.chartSection}>
              <Text style={[text.bodyS, { color: colors.inkSoft, marginBottom: 8 }]}>
                {sizeField === 'average_weight'
                  ? 'Average weight (lbs) of fish sampled, by survey year. Each line = one gear type.'
                  : 'Average length (inches) of fish sampled, by survey year. Each line = one gear type.'}
              </Text>
              <CpueChart data={sizeChartData} seriesKeys={sizeGearKeys} scaledGear={scaledGear} width={chartWidth}
                yLabel={sizeField === 'average_weight' ? 'Avg Weight (lb)' : 'Avg Length (in)'}
                onDotPress={(year, row) => setSelectedSizeYear(prev => prev?.year === year ? null : { year, row })} />
              <Text style={[text.bodyS, { color: colors.inkSoft, textAlign: 'center', marginTop: 4 }]}>
                Tap a dot to see year detail · tap a gear to rescale Y axis
              </Text>
              {selectedSizeYear && (
                <View style={styles.yearPopup}>
                  <View style={styles.yearPopupHeader}>
                    <Text style={[text.dataL, { color: colors.ink }]}>{selectedSizeYear.year}</Text>
                    <Pressable
                      onPress={() => setSelectedSizeYear(null)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Close year detail">
                      <Text style={[text.labelL, { color: colors.inkSoft }]}>✕</Text>
                    </Pressable>
                  </View>
                  {sizeGearKeys.map((g, i) => {
                    const val = selectedSizeYear.row[g];
                    if (val == null) return null;
                    return (
                      <View key={g} style={styles.popupRow}>
                        <View style={[styles.popupDot, { backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }]} />
                        <Text style={[text.bodyM, { flex: 1, color: colors.ink2 }]} numberOfLines={1}>{g}</Text>
                        <Text style={[text.dataM, { color: colors.ink }]}>
                          {`${(val as number).toFixed(sizeUnit === 'lb' ? 2 : 1)} ${sizeUnit}`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
              <View style={styles.gearLegend}>
                {sizeGearKeys.map((g, i) => {
                  const sel = scaledGear === g;
                  return (
                    <Pressable key={g}
                      style={[styles.gearChip, { borderColor: sel ? colors.ink : colors.paper3,
                        backgroundColor: sel ? colors.paper2 : colors.paper }]}
                      onPress={() => { setScaledGear(sel ? null : g); setSelectedSizeYear(null); }}>
                      <View style={[styles.gearDot, { backgroundColor: LINE_COLORS[i%LINE_COLORS.length] }]} />
                      <Text style={[text.labelM, { color: colors.ink }]} numberOfLines={1}>{g}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={[text.editorialS, { color: colors.inkSoft }]}>No size data for {speciesName}</Text>
            </View>
          )
        )}

        {/* Stocking tab */}
        {tab === 'stocking' && (
          stockChartData.length > 0 ? (
            <View style={styles.chartSection}>
              <Text style={[text.bodyS, { color: colors.inkSoft, marginBottom: 8 }]}>
                Fish stocked by year. Bar colors = life stage at stocking.
                {stockingAdultsPerYear.length > 0 ? ' Dashed line = Stck Adults / 100AC from stocking (right axis).' : ''}
              </Text>
              <StockingChart data={stockChartData} stageKeys={stageKeys} width={chartWidth}
                onBarPress={(year, row) => setSelectedStockYear(prev => prev?.year === year ? null : { year, row })}
                adultsPerYear={stockingAdultsPerYear.length > 0 ? stockingAdultsPerYear : undefined} />
              {selectedStockYear && (
                <View style={styles.yearPopup}>
                  <View style={styles.yearPopupHeader}>
                    <Text style={[text.dataL, { color: colors.ink }]}>{selectedStockYear.year}</Text>
                    <Pressable
                      onPress={() => setSelectedStockYear(null)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Close year detail">
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
                          <Text style={[text.bodyM, { flex: 1, color: colors.ink2 }]}>{stockedAdultsLabel}</Text>
                          <Text style={[text.dataM, { color: ADULT_LINE }]}>
                            {stockingAdultsAbsolute
                              ? Math.round(entry.adults_per_100ac).toLocaleString()
                              : entry.adults_per_100ac.toFixed(1)}
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
              )}
              <Legend items={[
                ...stageKeys.map(s => ({ label: s.charAt(0).toUpperCase()+s.slice(1), color: STAGE_COLORS[s] ?? DEFAULT_COLOR })),
                ...(stockingAdultsPerYear.length > 0 ? [{ label: stockedAdultsLabel, color: ADULT_LINE, dashed: true }] : []),
              ]} />
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={[text.editorialS, { color: colors.inkSoft }]}>No stocking records for {speciesName}</Text>
            </View>
          )
        )}

        {/* Brand line — subtle in the app, the watermark on shared cards. */}
        <Text style={[text.labelS, { color: colors.inkSoft, textAlign: 'center', marginTop: 18, letterSpacing: 1.5 }]}>
          LAKELORE · lakeloreapp.com
        </Text>
       </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Report data issue: posts to /api/feedback so the user doesn't need
          Mail/Gmail configured. */}
      <Modal
        visible={feedbackOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFeedbackOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
          <PaperHeader
            modal
            title="Report data issue"
            right={
              <Pressable onPress={() => setFeedbackOpen(false)} hitSlop={8}>
                <Text style={[text.labelL, { color: colors.ink }]}>Cancel</Text>
              </Pressable>
            }
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: space.xl }}>
              <Text style={[text.bodyM, { color: colors.ink2 }]}>
                What looks wrong with {lake.name ?? 'this lake'}? Be as specific as you can
                (species, year, value you expected vs. what's shown).
              </Text>
              <Text style={[text.labelS, { color: colors.inkSoft, marginTop: space.lg }]}>
                CONTEXT (auto-attached)
              </Text>
              <Text style={[text.dataS, { color: colors.inkSoft, marginTop: 4 }]}>
                {`${STATE_CONFIGS[state]?.label ?? state.toUpperCase()} · ${lake.name ?? 'name hidden'} · ID ${lake.id} · `}
                {`${localSpecies ? speciesDisplayName(localSpecies, state) : 'no species'} · `}
                {`${tab === 'cpue' ? 'Catch tab' : tab === 'size' ? 'Avg Size tab' : 'Stocking tab'}`}
              </Text>
              <TextInput
                style={styles.feedbackInput}
                placeholder="Describe the issue…"
                placeholderTextColor={colors.inkSoft}
                multiline
                value={feedbackText}
                onChangeText={setFeedbackText}
                maxLength={2000}
                editable={!feedbackSending}
              />
              <Pressable
                onPress={async () => {
                  if (feedbackSending) return;
                  if (feedbackText.trim().length === 0) {
                    toast('Add a description before sending.');
                    return;
                  }
                  setFeedbackSending(true);
                  try {
                    await submitFeedback({
                      message: feedbackText,
                      state,
                      lakeId: lake.id,
                      lakeName: lake.name,
                      species: localSpecies ?? null,
                      tab: tab === 'cpue' ? 'catch' : tab === 'size' ? 'size' : 'stocking',
                      version: Application.nativeApplicationVersion ?? null,
                      build: Application.nativeBuildVersion ?? null,
                    });
                    setFeedbackOpen(false);
                    toast('Thanks — sent.');
                  } catch (e) {
                    toast(e instanceof Error ? e.message : 'Could not send. Try again.');
                  } finally {
                    setFeedbackSending(false);
                  }
                }}
                style={({ pressed }) => [
                  styles.feedbackSend,
                  { opacity: pressed || feedbackSending ? 0.7 : 1 },
                ]}>
                <Text style={[text.labelL, { color: colors.paper }]}>
                  {feedbackSending ? 'Sending…' : 'Send'}
                </Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Subscription gate: opened from the preview banner's Unlock button,
          or by a hard 402 (older server / pdf-only paths). */}
      <PaywallScreen
        visible={paywallTriggered !== null}
        triggeredFrom={paywallTriggered ? STATE_CONFIGS[paywallTriggered].label : undefined}
        onClose={() => {
          setPaywallTriggered(null);
          if (paywallFromBanner) {
            // Dismissed from the preview banner — the redacted screen behind
            // it is still perfectly usable; stay put.
            setPaywallFromBanner(false);
            return;
          }
          // Dismissed a hard 402 without subscribing — nothing to show here,
          // back out of the lake detail.
          navigation.goBack();
        }}
        onPurchased={() => {
          setPaywallTriggered(null);
          setPaywallFromBanner(false);
          loadLake();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  // Mirrors SearchScreen's preview banner so the two read as one system.
  previewBanner: {
    backgroundColor: colors.ink,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    marginHorizontal: space.xl,
    marginTop: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  unlockBtn: {
    backgroundColor: colors.walleye,
    paddingHorizontal: space.lg,
    paddingVertical: 5,
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xxxl,
    gap: space.md,
  },
  errorRetry: { marginTop: space.lg, paddingHorizontal: space.xxl },

  feedbackInput: {
    marginTop: space.lg,
    minHeight: 160,
    padding: space.md,
    borderWidth: hairline,
    borderColor: colors.paper3,
    borderRadius: 6,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  feedbackSend: {
    marginTop: space.xl,
    backgroundColor: colors.ink,
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center',
  },

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

  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
    backgroundColor: colors.paper2,
  },
  cacheBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
    backgroundColor: colors.paper2,
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
