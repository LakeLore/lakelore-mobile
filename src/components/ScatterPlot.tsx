import React, { useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Svg, { Circle, Line, Text as SvgText, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Result, StateKey, SD_SPECIES_NAMES, MN_SPECIES_NAMES, ND_SPECIES_NAMES } from '../types';
import { colors, text, space, hairline, fonts } from '../lakelore-rn/theme';

function stockedColor(stocked: number|null|undefined, min: number, max: number): string {
  if (stocked==null) return colors.paper3;
  if (max===min) return colors.lake3;
  const t = Math.max(0,Math.min(1,(stocked-min)/(max-min)));
  // paper-and-ink stock gradient: lake → moss → walleye → flash → rust
  const stops:[number,number,number][] = [
    [74,106,122],   // lake3
    [106,122,74],   // moss
    [200,154,60],   // walleye
    [232,188,90],   // flash
    [168,90,58],    // rust
  ];
  const sc = t*(stops.length-1);
  const i = Math.min(Math.floor(sc),stops.length-2);
  const f = sc-i;
  return `rgb(${Math.round(stops[i][0]+f*(stops[i+1][0]-stops[i][0]))},${Math.round(stops[i][1]+f*(stops[i+1][1]-stops[i][1]))},${Math.round(stops[i][2]+f*(stops[i+1][2]-stops[i][2]))})`;
}

function niceTicks(min: number, max: number, count = 5): number[] {
  const range = max - min;
  if (range <= 0) return [min];
  const raw = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1,2,2.5,5,10].map(f=>f*mag).find(s=>s>=raw) ?? mag*10;
  const start = Math.ceil(min/step)*step;
  const ticks: number[] = [];
  for (let t=start; t<=max+step*0.01; t=Math.round((t+step)*1e9)/1e9) ticks.push(t);
  return ticks;
}

interface DotData {
  x: number; y: number;
  stocked: number|null|undefined;
  name: string; species: string; year: number;
  lake_id: number|string;
  survey_date?: string;
  average_weight?: number|null;
  total_catch?: number|null;
  estLength?: number;
}

type ViewBounds = { xMin:number; xMax:number; yMin:number; yMax:number };

interface Props {
  results: Result[];
  state: StateKey;
  onLakePress: (lakeId: number|string, lakeName: string) => void;
}

export default function ScatterPlot({ results, state, onLakePress }: Props) {
  const { width } = useWindowDimensions();

  const PAD_L = 48, PAD_R = 16, PAD_T = 12, PAD_B = 44;
  const svgW = width - 24;
  const svgH = 300;
  const plotW = svgW - PAD_L - PAD_R;
  const plotH = svgH - PAD_T - PAD_B;

  const [selectedDot, setSelectedDot] = useState<DotData|null>(null);
  const [view, setView] = useState<ViewBounds|null>(null);

  // Refs for gesture state (avoids closure stale-value issues)
  const viewRef = useRef<ViewBounds|null>(null);
  const dataBoundsRef = useRef<ViewBounds>({ xMin: 0, xMax: 1, yMin: 0, yMax: 1 });
  const pinchActiveRef = useRef(false);
  const prevTransXRef = useRef(0);
  const prevTransYRef = useRef(0);
  const prevScaleRef = useRef(1);
  const plotWRef = useRef(plotW);
  const plotHRef = useRef(plotH);
  plotWRef.current = plotW;
  plotHRef.current = plotH;
  const pointsRef = useRef<DotData[]>([]);
  const selectedDotRef = useRef<DotData|null>(null);

  const { points, minStocked, maxStocked, dataBounds, xLabel, yLabel } = useMemo(() => {
    const pts: DotData[] = [];
    const namesMap = state==='mn' ? MN_SPECIES_NAMES : state==='nd' ? ND_SPECIES_NAMES : SD_SPECIES_NAMES;

    if (state==='mn') {
      for (const r of results) {
        if (r.cpue==null) continue;
        pts.push({
          x: r.average_weight??0, y: r.cpue,
          stocked: r.stocked_per_100ac,
          name: r.lake_name, species: namesMap[r.species]??r.species,
          year: r.survey_year, lake_id: r.lake_id,
          survey_date: r.survey_date??undefined,
          average_weight: r.average_weight,
          total_catch: r.total_catch,
        });
      }
    } else if (state==='nd') {
      for (const r of results) {
        if (r.cpue==null || r.average_length==null) continue;
        pts.push({
          x: r.average_length, y: r.cpue,
          stocked: r.stocked_per_100ac,
          name: r.lake_name, species: namesMap[r.species]??r.species,
          year: r.survey_year, lake_id: r.lake_id,
        });
      }
    } else if (state==='ia') {
      for (const r of results) {
        if (r.survey_date == null || r.cpue == null || r.average_length == null) continue;
        pts.push({
          x: r.average_length, y: r.cpue,
          stocked: r.stocked_per_100ac,
          name: r.lake_name, species: r.species,
          year: r.survey_year, lake_id: r.lake_id,
          survey_date: r.survey_date ?? undefined,
          total_catch: r.total_catch,
        });
      }
    } else if (state === 'ne') {
      for (const r of results) {
        if (r.cpue == null || r.average_length == null) continue;
        pts.push({
          x: r.average_length, y: r.cpue,
          stocked: r.stocked_per_100ac,
          name: r.lake_name, species: r.species,
          year: r.survey_year, lake_id: r.lake_id,
        });
      }
    } else if (state === 'mi' || state === 'wi') {
      for (const r of results) {
        if (r.cpue == null || r.average_length == null) continue;
        pts.push({
          x: r.average_length, y: r.cpue,
          stocked: r.stocked_per_100ac,
          name: r.lake_name, species: r.species,
          year: r.survey_year, lake_id: r.lake_id,
          total_catch: r.total_catch,
          average_weight: r.average_weight,
        });
      }
    } else {
      // SD: server already returns the PSD-derived avg length as average_length.
      for (const r of results) {
        if (r.cpue==null || r.average_length==null) continue;
        pts.push({
          x: r.average_length, y: r.cpue,
          stocked: r.stocked_per_100ac,
          name: r.lake_name, species: namesMap[r.species]??r.species,
          year: r.survey_year, lake_id: r.lake_id,
          estLength: r.average_length,
        });
      }
    }

    const allStocked = results.filter(r=>r.stocked_per_100ac!=null).map(r=>r.stocked_per_100ac as number);
    const minStocked = allStocked.length ? Math.min(...allStocked) : 0;
    const maxStocked = allStocked.length ? Math.max(...allStocked) : 0;

    const xs = pts.map(p=>p.x);
    const ys = pts.map(p=>p.y);
    const dataBounds: ViewBounds = {
      xMin: xs.length ? Math.min(...xs) : 0,
      xMax: xs.length ? Math.max(...xs)*1.05 : 1,
      yMin: 0,
      yMax: ys.length ? Math.max(...ys)*1.1 : 1,
    };
    const xLabel = state==='mn' ? 'Avg Weight (lb)' : 'Avg Length (in)';
    // desc shown in render — keep in sync with xLabel
    const yLabel = 'CPUE';
    return { points: pts, minStocked, maxStocked, dataBounds, xLabel, yLabel };
  }, [results, state]);

  // Keep refs in sync with latest render values
  pointsRef.current = points;
  selectedDotRef.current = selectedDot;
  dataBoundsRef.current = dataBounds;

  // Reset zoom on new results
  const prevResults = useRef(results);
  if (prevResults.current !== results) {
    prevResults.current = results;
    viewRef.current = null;
    // Don't call setView here — just update the ref, the render will use dataBounds
  }

  const activeView = view ?? dataBounds;

  const toPixel = useCallback((dx: number, dy: number) => ({
    px: PAD_L + ((dx - activeView.xMin) / (activeView.xMax - activeView.xMin)) * plotW,
    py: PAD_T + (1 - (dy - activeView.yMin) / (activeView.yMax - activeView.yMin)) * plotH,
  }), [activeView, plotW, plotH]);

  const xTicks = useMemo(() => niceTicks(dataBounds.xMin, dataBounds.xMax, 5), [dataBounds]);
  const yTicks = useMemo(() => niceTicks(dataBounds.yMin, dataBounds.yMax, 5), [dataBounds]);

  // ── Gesture-handler driven pan + pinch + tap ─────────────────────────────────
  // Mirrors the smooth pattern used by CountyMapPicker: a Tap (for dot
  // selection) raced against a simultaneous Pan + Pinch (for zoom/scroll).
  // gesture-handler runs on the native thread so it doesn't fight with the
  // outer ScrollView the way PanResponder did.
  const tapGesture = useMemo(() => Gesture.Tap()
    .runOnJS(true)
    .maxDuration(300)
    .maxDistance(15)
    .onEnd((e, success) => {
      if (!success) return;
      // e.x/e.y are already relative to the GestureDetector — no page-coord math needed.
      const cur = viewRef.current ?? dataBoundsRef.current;
      const xRange = cur.xMax - cur.xMin;
      const yRange = cur.yMax - cur.yMin;
      const pW = plotWRef.current;
      const pH = plotHRef.current;
      let bestDot: DotData | null = null;
      let bestDist2 = 40 * 40;
      for (const p of pointsRef.current) {
        if (p.x < cur.xMin || p.x > cur.xMax || p.y < cur.yMin || p.y > cur.yMax) continue;
        const px = PAD_L + ((p.x - cur.xMin) / xRange) * pW;
        const py = PAD_T + (1 - (p.y - cur.yMin) / yRange) * pH;
        const d2 = (e.x - px) * (e.x - px) + (e.y - py) * (e.y - py);
        if (d2 < bestDist2) { bestDist2 = d2; bestDot = p; }
      }
      if (bestDot) {
        const sel = selectedDotRef.current;
        const isSel = sel?.lake_id === bestDot.lake_id && sel?.year === bestDot.year;
        setSelectedDot(isSel ? null : bestDot);
      }
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  // activeOffsetX/Y([-2,2]) makes the pan claim the gesture as soon as the
  // touch moves more than 2px in any direction — wins the race against the
  // outer ScrollView's vertical-scroll recognizer.
  const panGesture = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .activeOffsetX([-2, 2])
    .activeOffsetY([-2, 2])
    .onBegin(() => {
      prevTransXRef.current = 0;
      prevTransYRef.current = 0;
    })
    .onUpdate((e) => {
      if (pinchActiveRef.current) return;
      const pdx = e.translationX - prevTransXRef.current;
      const pdy = e.translationY - prevTransYRef.current;
      prevTransXRef.current = e.translationX;
      prevTransYRef.current = e.translationY;
      const cur = viewRef.current ?? dataBoundsRef.current;
      const dDataX = -(pdx / plotWRef.current) * (cur.xMax - cur.xMin);
      const dDataY = (pdy / plotHRef.current) * (cur.yMax - cur.yMin);
      const newView = {
        xMin: cur.xMin + dDataX, xMax: cur.xMax + dDataX,
        yMin: Math.max(0, cur.yMin + dDataY), yMax: cur.yMax + dDataY,
      };
      viewRef.current = newView;
      setView(newView);
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  const pinchGesture = useMemo(() => Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => {
      pinchActiveRef.current = true;
      prevScaleRef.current = 1;
    })
    .onUpdate((e) => {
      const incrementalScale = prevScaleRef.current / e.scale;
      prevScaleRef.current = e.scale;
      const cur = viewRef.current ?? dataBoundsRef.current;
      const cx = (cur.xMin + cur.xMax) / 2;
      const cy = (cur.yMin + cur.yMax) / 2;
      const hw = (cur.xMax - cur.xMin) / 2 * incrementalScale;
      const hh = (cur.yMax - cur.yMin) / 2 * incrementalScale;
      const newView = { xMin: cx-hw, xMax: cx+hw, yMin: Math.max(0, cy-hh), yMax: cy+hh };
      viewRef.current = newView;
      setView(newView);
    })
    .onEnd(() => { pinchActiveRef.current = false; })
    .onFinalize(() => { pinchActiveRef.current = false; }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  const gesture = useMemo(
    () => Gesture.Race(tapGesture, Gesture.Simultaneous(panGesture, pinchGesture)),
    [tapGesture, panGesture, pinchGesture],
  );

  if (!points.length) {
    return (
      <View style={styles.empty}>
        <Text style={[text.editorialS, { color: colors.inkSoft }]}>No plottable data</Text>
      </View>
    );
  }

  const inView = (p: DotData) =>
    p.x >= activeView.xMin && p.x <= activeView.xMax &&
    p.y >= activeView.yMin && p.y <= activeView.yMax;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <Text style={[text.bodyS, { color: colors.inkSoft, marginHorizontal: space.lg, marginTop: space.md, marginBottom: space.xs }]}>
        {state === 'mn' ? 'CPUE vs. avg weight'
          : state === 'sd' ? 'CPUE vs. est. mean length'
          : 'CPUE vs. avg length'} · color = stocked/100ac · tap a dot
      </Text>

      <GestureDetector gesture={gesture}>
        <View style={[styles.chartWrap, { width: svgW, height: svgH }]}>
          <Svg width={svgW} height={svgH}>
          <Rect x={PAD_L} y={PAD_T} width={plotW} height={plotH}
            fill={colors.paper2} stroke={colors.ink} strokeWidth={0.8} />

          {xTicks.map(t => {
            const { px } = toPixel(t, 0);
            if (px < PAD_L || px > PAD_L+plotW) return null;
            return <Line key={`xg${t}`} x1={px} y1={PAD_T} x2={px} y2={PAD_T+plotH}
              stroke={colors.paper3} strokeWidth={0.5} strokeDasharray="2 3" />;
          })}
          {yTicks.map(t => {
            const { py } = toPixel(0, t);
            if (py < PAD_T || py > PAD_T+plotH) return null;
            return <Line key={`yg${t}`} x1={PAD_L} y1={py} x2={PAD_L+plotW} y2={py}
              stroke={colors.paper3} strokeWidth={0.5} strokeDasharray="2 3" />;
          })}

          {xTicks.map(t => {
            const { px } = toPixel(t, 0);
            if (px < PAD_L-2 || px > PAD_L+plotW+2) return null;
            return <SvgText key={`xt${t}`} x={px} y={PAD_T+plotH+14}
              fontFamily={fonts.mono} fontSize={9}
              textAnchor="middle" fill={colors.inkSoft}>{t%1===0?t:t.toFixed(1)}</SvgText>;
          })}
          {yTicks.map(t => {
            const { py } = toPixel(0, t);
            if (py < PAD_T-2 || py > PAD_T+plotH+2) return null;
            return <SvgText key={`yt${t}`} x={PAD_L-4} y={py+3.5}
              fontFamily={fonts.mono} fontSize={9}
              textAnchor="end" fill={colors.inkSoft}>{t%1===0?t:t.toFixed(1)}</SvgText>;
          })}

          <SvgText x={PAD_L+plotW/2} y={svgH-4}
            fontFamily={fonts.mono} fontSize={10}
            textAnchor="middle" fill={colors.inkSoft}>{xLabel}</SvgText>
          <SvgText x={10} y={PAD_T+plotH/2}
            fontFamily={fonts.mono} fontSize={10}
            textAnchor="middle" fill={colors.inkSoft}
            rotation="-90" originX={10} originY={PAD_T+plotH/2}>{yLabel}</SvgText>

          {points.filter(inView).map((p, i) => {
            const { px, py } = toPixel(p.x, p.y);
            const isSel = selectedDot?.lake_id===p.lake_id && selectedDot?.year===p.year;
            // No-stocking dots get rendered hollow with a dark outline so they
            // pop against the paper2 chart fill — the previous paper3 fill on
            // a paper2 background was nearly invisible.
            const noData = p.stocked == null;
            return (
              <Circle key={i} cx={px} cy={py} r={isSel?7:5}
                fill={noData ? 'none' : stockedColor(p.stocked, minStocked, maxStocked)}
                fillOpacity={noData ? 1 : 0.85}
                stroke={isSel ? colors.ink : noData ? colors.inkSoft : colors.paper}
                strokeWidth={isSel ? 1.5 : noData ? 1.2 : 0.5} />
            );
          })}
          </Svg>
        </View>
      </GestureDetector>

      {view && (
        <Pressable style={styles.resetZoom} onPress={() => { viewRef.current=null; setView(null); }}>
          <Text style={[text.labelM, { color: colors.ink }]}>Reset zoom</Text>
        </Pressable>
      )}

      <View style={styles.legend}>
        <View style={[styles.legendDot, styles.legendDotEmpty]} />
        <Text style={[text.labelS, { color: colors.inkSoft }]}>no data</Text>
        <Text style={[text.labelS, { color: colors.paper3 }]}>·</Text>
        <Text style={[text.labelS, { color: colors.inkSoft }]}>low</Text>
        <GradientBar width={90} height={10} />
        <Text style={[text.labelS, { color: colors.inkSoft }]}>high stocked/100ac</Text>
      </View>

      {selectedDot && (
        <Pressable style={styles.dotCard}
          onPress={() => { onLakePress(selectedDot.lake_id, selectedDot.name); setSelectedDot(null); }}
        >
          <Text style={[text.displayM, { color: colors.ink }]}>{selectedDot.name}</Text>
          <Text style={[text.dataS, { color: colors.inkSoft, marginTop: 2, marginBottom: 8 }]}>
            {selectedDot.species} · {selectedDot.survey_date ?? selectedDot.year}
          </Text>
          <View style={styles.dotStats}>
            <Stat label="CPUE" value={selectedDot.y.toFixed(2)} />
            {selectedDot.estLength!=null && <Stat label="Est. length" value={`${selectedDot.estLength.toFixed(1)} in`} />}
            {selectedDot.average_weight!=null && selectedDot.average_weight>0 && <Stat label="Avg weight" value={`${selectedDot.average_weight.toFixed(2)} lb`} />}
            {selectedDot.total_catch!=null && <Stat label="Total catch" value={String(selectedDot.total_catch)} />}
            {selectedDot.stocked!=null && <Stat label="Stocked/100ac" value={selectedDot.stocked.toFixed(1)} />}
          </View>
          <Text style={[text.labelM, { color: colors.walleye2, marginTop: 4 }]}>Tap for lake history →</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function GradientBar({ width = 90, height = 10 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="sg" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0"    stopColor={colors.lake3} />
          <Stop offset="0.25" stopColor={colors.moss} />
          <Stop offset="0.5"  stopColor={colors.walleye} />
          <Stop offset="0.75" stopColor={colors.flash} />
          <Stop offset="1"    stopColor={colors.rust} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#sg)" />
    </Svg>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[text.dataM, { color: colors.ink }]}>{value}</Text>
      <Text style={[text.labelS, { color: colors.walleye2, marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: { alignSelf: 'center' },
  empty: { height: 200, alignItems: 'center', justifyContent: 'center' },
  resetZoom: {
    alignSelf: 'flex-end',
    marginRight: space.xl,
    marginTop: space.xs,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: hairline,
    borderColor: colors.ink,
    backgroundColor: colors.paper2,
  },
  dotCard: {
    margin: space.lg,
    padding: space.lg,
    backgroundColor: colors.paper2,
    borderWidth: hairline,
    borderColor: colors.ink,
  },
  dotStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  statItem: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: hairline,
    borderColor: colors.paper3,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginHorizontal: space.lg,
    marginTop: space.xs,
    marginBottom: space.md,
  },
  legendDot: { width: 10, height: 10 },
  legendDotEmpty: {
    borderRadius: 5,
    borderWidth: 1.2,
    borderColor: colors.inkSoft,
    backgroundColor: 'transparent',
  },
});
