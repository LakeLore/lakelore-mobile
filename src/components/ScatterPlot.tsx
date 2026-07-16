import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Line, Text as SvgText, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSvgPanZoom, useCommittedMirror, assertWorklet } from '../hooks/useSvgPanZoom';
import BlurredLakeName from './BlurredLakeName';
import { Result, StateKey, STATE_CONFIGS } from '../types';
import { SPECIES_NAMES_BY_STATE } from '../generated/species';
import { colors, text, space, hairline, fonts } from '../lakelore-rn/theme';

// Rank-based color mapping. Maps `stocked` to its quantile within `sorted`
// (a precomputed ascending list of all non-null stocked values across the
// current result set) and interpolates between gradient stops. This avoids the
// outlier-collapse failure mode of linear normalization on highly-skewed
// per-100-acre stocking distributions, where one tiny lake compresses everyone
// else to the bottom of the scale. Ties share a rank.
function stockedColor(stocked: number|null|undefined, sorted: number[]): string {
  if (stocked == null) return colors.paper3;
  const n = sorted.length;
  if (n <= 1) return colors.lake3;
  let lo = 0, hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < stocked) lo = mid + 1;
    else hi = mid;
  }
  let last = lo;
  while (last + 1 < n && sorted[last + 1] === stocked) last++;
  const rank = (lo + last) / 2;
  const t = rank / (n - 1);
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
  // Absolute estimated stocked adults — shown in the popup when the lake has
  // no acreage (stocked density null there).
  stockedEst?: number|null;
  // name is null when the server redacted it (paid-state preview) — the
  // popup card renders a blurred placeholder instead.
  name: string|null; county: string; species: string; year: number;
  lake_id: number|string;
  survey_date?: string;
  area_acres?: number|null;
  max_depth_feet?: number|null;
  average_length?: number|null;
  average_weight?: number|null;
  total_catch?: number|null;
  estLength?: number;
  // Rating mode (GA/MO/IL): y is the rating ordinal; this is the agency's
  // display wording for the popup.
  ratingText?: string|null;
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

  // Refs feeding the (JS-thread) tap handler — pan/pinch state lives in
  // shared values via useSvgPanZoom instead.
  const viewRef = useRef<ViewBounds|null>(null);
  const dataBoundsRef = useRef<ViewBounds>({ xMin: 0, xMax: 1, yMin: 0, yMax: 1 });
  const plotWRef = useRef(plotW);
  const plotHRef = useRef(plotH);
  plotWRef.current = plotW;
  plotHRef.current = plotH;
  const pointsRef = useRef<DotData[]>([]);
  const selectedDotRef = useRef<DotData|null>(null);

  const { points, sortedStocked, dataBounds, xLabel, yLabel, ratingMode } = useMemo(() => {
    const pts: DotData[] = [];
    const namesMap = SPECIES_NAMES_BY_STATE[state] ?? ({} as Record<string, string>);
    // Set by the generic (new-fleet) branch: whether this result set carries
    // measured lengths (drives the x-axis choice + label).
    let genericHasLength = false;
    // Ratings-tier fallback (no CPUE anywhere): y becomes the agency forecast
    // rating ordinal, x average size.
    let ratingMode = false;

    // Lake-level fields shared across every state branch. Kept separate from
    // the per-state population so the popup can render acres/depth/county
    // consistently with the list view's location row.
    const lakeMeta = (r: Result) => ({
      name: r.lake_name, county: r.county ?? '',
      lake_id: r.lake_id,
      area_acres: r.area_acres ?? null,
      max_depth_feet: r.max_depth_feet ?? null,
      stockedEst: r.stocked_adults_est ?? null,
    });

    if (state==='mn') {
      for (const r of results) {
        if (r.cpue==null) continue;
        pts.push({
          x: r.average_weight??0, y: r.cpue,
          stocked: r.stocked_per_100ac,
          ...lakeMeta(r),
          species: namesMap[r.species]??r.species,
          year: r.survey_year,
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
          ...lakeMeta(r),
          species: namesMap[r.species]??r.species,
          year: r.survey_year,
          average_length: r.average_length,
        });
      }
    } else if (state==='ia') {
      for (const r of results) {
        if (r.survey_date == null || r.cpue == null || r.average_length == null) continue;
        pts.push({
          x: r.average_length, y: r.cpue,
          stocked: r.stocked_per_100ac,
          ...lakeMeta(r),
          species: r.species,
          year: r.survey_year,
          survey_date: r.survey_date ?? undefined,
          average_length: r.average_length,
          total_catch: r.total_catch,
        });
      }
    } else if (state === 'ne') {
      for (const r of results) {
        if (r.cpue == null || r.average_length == null) continue;
        pts.push({
          x: r.average_length, y: r.cpue,
          stocked: r.stocked_per_100ac,
          ...lakeMeta(r),
          species: r.species,
          year: r.survey_year,
          average_length: r.average_length,
        });
      }
    } else if (state === 'mi') {
      for (const r of results) {
        if (r.cpue == null || r.average_length == null) continue;
        pts.push({
          x: r.average_length, y: r.cpue,
          stocked: r.stocked_per_100ac,
          ...lakeMeta(r),
          species: r.species,
          year: r.survey_year,
          average_length: r.average_length,
          total_catch: r.total_catch,
        });
      }
    } else if (state === 'wi') {
      for (const r of results) {
        if (r.cpue == null || r.average_length == null) continue;
        pts.push({
          x: r.average_length, y: r.cpue,
          stocked: r.stocked_per_100ac,
          ...lakeMeta(r),
          species: r.species,
          year: r.survey_year,
          average_length: r.average_length,
        });
      }
    } else if (state === 'sd') {
      // SD: server already returns the PSD-derived avg length as average_length.
      for (const r of results) {
        if (r.cpue==null || r.average_length==null) continue;
        pts.push({
          x: r.average_length, y: r.cpue,
          stocked: r.stocked_per_100ac,
          ...lakeMeta(r),
          species: namesMap[r.species]??r.species,
          year: r.survey_year,
          estLength: r.average_length,
        });
      }
    } else if (results.some(r => r.cpue != null)) {
      // Generic branch (2026-07 all-states fleet): length-vs-CPUE when the
      // result set carries measured lengths; otherwise survey-year-vs-CPUE so
      // CPUE-only states still get a usable scatter (year is also never
      // redacted in paid-state preview, unlike acres).
      genericHasLength = results.some(r => r.cpue != null && r.average_length != null);
      for (const r of results) {
        if (r.cpue == null) continue;
        const x = genericHasLength ? r.average_length : r.survey_year;
        if (x == null) continue;
        pts.push({
          x, y: r.cpue,
          stocked: r.stocked_per_100ac,
          ...lakeMeta(r),
          species: namesMap[r.species]??r.species,
          year: r.survey_year,
          average_length: r.average_length ?? undefined,
          total_catch: r.total_catch,
        });
      }
    } else {
      // Ratings-tier states with no CPUE at all (GA/MO/IL): pair the agency
      // FORECAST RATING (y, state-local ordinal) with average size (x) on
      // rows that carry both.
      for (const r of results) {
        if (r.rating_ordinal == null || r.average_length == null) continue;
        ratingMode = true;
        pts.push({
          x: r.average_length, y: r.rating_ordinal,
          stocked: r.stocked_per_100ac,
          ...lakeMeta(r),
          species: namesMap[r.species]??r.species,
          year: r.survey_year,
          average_length: r.average_length,
          ratingText: r.rating ?? null,
        });
      }
    }

    // Dot-color gradient is DENSITY ONLY (adults per 100 acres) by design —
    // absolute adults_est values aren't comparable to densities, so
    // acreage-less stocked lakes render as "no data" dots; their estimate
    // shows in the tap popup instead.
    const sortedStocked = results
      .map(r => r.stocked_per_100ac)
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);

    const xs = pts.map(p=>p.x);
    const ys = pts.map(p=>p.y);
    const dataBounds: ViewBounds = {
      xMin: xs.length ? Math.min(...xs) : 0,
      xMax: xs.length ? Math.max(...xs)*1.05 : 1,
      yMin: 0,
      yMax: ys.length ? Math.max(...ys)*1.1 : 1,
    };
    const LEGACY_STATES = new Set(['mn', 'sd', 'nd', 'ia', 'ne', 'wi', 'mi']);
    const xLabel = state==='mn' ? 'Avg Weight (lb)'
      : (LEGACY_STATES.has(state) || genericHasLength || ratingMode) ? 'Avg Length (in)'
      : 'Survey Year';
    // desc shown in render — keep in sync with xLabel
    const yLabel = ratingMode ? 'Forecast Rating' : 'Catch Rate';
    return { points: pts, sortedStocked, dataBounds, xLabel, yLabel, ratingMode };
  }, [results, state]);

  // Keep refs in sync with latest render values
  pointsRef.current = points;
  selectedDotRef.current = selectedDot;
  dataBoundsRef.current = dataBounds;

  const activeView = view ?? dataBounds;

  // Pan/pinch run as UI-thread worklets mutating `live`; React re-renders the
  // dots once per gesture, at finger-up (commitView). Between updates the
  // rendered (committed) dots layer is repositioned by a plain View transform.
  const commitView = useCallback((v: ViewBounds) => {
    viewRef.current = v;   // synchronously, so a fast follow-up tap hit-tests fresh bounds
    setView(v);
  }, []);
  const { live, committed, panActive, pinchActive, dirty, maybeCommit, syncTo } =
    useSvgPanZoom<ViewBounds>(dataBounds, commitView);
  useCommittedMirror(committed, activeView);

  // Reset zoom on new results or state switch (after the mirror effect
  // above, so the committed shared value ends the effect pass at dataBounds).
  useEffect(() => {
    viewRef.current = null;
    setView(null);
    syncTo(dataBoundsRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, state]);

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
    .minDistance(0)
    .activeOffsetX([-2, 2])
    .activeOffsetY([-2, 2])
    .onStart(() => {
      'worklet';
      assertWorklet('ScatterPlot pan');
      panActive.value = true;
    })
    .onEnd(() => {
      'worklet';
      panActive.value = false;
      maybeCommit();
    })
    .onChange((e) => {
      'worklet';
      // Two or more fingers down = the pinch owns the motion. Decided from the
      // event itself, NOT the pinchActive flag — a dropped pinch end-event on
      // Android would latch the flag and silently kill panning (see
      // CountyMapPicker for the same fix).
      if (e.numberOfPointers > 1) return;
      const cur = live.value;
      const dDataX = -(e.changeX / plotW) * (cur.xMax - cur.xMin);
      const dDataY = (e.changeY / plotH) * (cur.yMax - cur.yMin);
      live.value = {
        xMin: cur.xMin + dDataX, xMax: cur.xMax + dDataX,
        yMin: Math.max(0, cur.yMin + dDataY), yMax: cur.yMax + dDataY,
      };
      dirty.value = true;
    })
    .onFinalize(() => {
      'worklet';
      panActive.value = false;
      maybeCommit();
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [plotW, plotH]);

  const pinchGesture = useMemo(() => Gesture.Pinch()
    .onStart(() => {
      'worklet';
      pinchActive.value = true;
    })
    .onEnd(() => {
      'worklet';
      pinchActive.value = false;
      maybeCommit();
    })
    .onChange((e) => {
      'worklet';
      const incrementalScale = 1 / e.scaleChange;
      const cur = live.value;
      const cx = (cur.xMin + cur.xMax) / 2;
      const cy = (cur.yMin + cur.yMax) / 2;
      const hw = (cur.xMax - cur.xMin) / 2 * incrementalScale;
      const hh = (cur.yMax - cur.yMin) / 2 * incrementalScale;
      live.value = { xMin: cx-hw, xMax: cx+hw, yMin: Math.max(0, cy-hh), yMax: cy+hh };
      dirty.value = true;
    })
    .onFinalize(() => {
      'worklet';
      pinchActive.value = false;
      maybeCommit();
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  // Repositions the committed dots layer to match `live` between commits.
  // Identity when live === committed. scaleX/scaleY are separate because the
  // yMin >= 0 clamp lets the y-range change independently of x.
  const dotsStyle = useAnimatedStyle(() => {
    const c = committed.value;
    const l = live.value;
    const lW = l.xMax - l.xMin, lH = l.yMax - l.yMin;
    const cW = c.xMax - c.xMin, cH = c.yMax - c.yMin;
    return {
      transform: [
        { translateX: ((c.xMin - l.xMin) / lW) * plotW },
        { translateY: plotH * (1 - (c.yMin - l.yMin) / lH - cH / lH) },
        { scaleX: cW / lW },
        { scaleY: cH / lH },
      ],
    };
  });

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

  // Dot positions in plot-local pixels (origin at the plot area's top-left)
  // so the dots layer can be transformed as a unit during gestures. The dots
  // canvas is oversized by one full window on each side (an Svg clips at its
  // own bounds, so an exactly-fitting canvas would slide blank edges into
  // view mid-pan) — dots up to a window away are pre-rendered and slide in;
  // anything further pops in at the gesture-end commit. The window filter
  // also caps the native node count when zoomed into a dense result set.
  const xRange = activeView.xMax - activeView.xMin;
  const yRange = activeView.yMax - activeView.yMin;
  const inDrawWindow = (p: DotData) =>
    p.x >= activeView.xMin - xRange && p.x <= activeView.xMax + xRange &&
    p.y >= activeView.yMin - yRange && p.y <= activeView.yMax + yRange;
  const toPlotPixel = (dx: number, dy: number) => ({
    px: ((dx - activeView.xMin) / xRange) * plotW,
    py: (1 - (dy - activeView.yMin) / yRange) * plotH,
  });

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <Text style={[text.bodyS, { color: colors.inkSoft, marginHorizontal: space.lg, marginTop: space.md, marginBottom: space.xs }]}>
        {state === 'mn' ? 'Catch rate vs. avg weight'
          : state === 'sd' ? 'Catch rate vs. est. mean length'
          : 'Catch rate vs. avg length'} · color = Stck Adults / 100AC · tap a dot
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

          </Svg>

          {/* Dots layer: clipped to the plot area, repositioned by dotsStyle
              during gestures while the frame/ticks above stay frozen. */}
          <View style={[styles.plotClip, { left: PAD_L, top: PAD_T, width: plotW, height: plotH }]}>
            <Animated.View style={[styles.plotTransform, { width: plotW, height: plotH }, dotsStyle]}>
              <Svg width={plotW * 3} height={plotH * 3}
                style={{ position: 'absolute', left: -plotW, top: -plotH }}>
                {points.map((p, i) => {
                  if (!inDrawWindow(p)) return null;
                  // +plotW/+plotH shifts plot-local coords into the oversized
                  // canvas, whose origin sits one window up-and-left.
                  const { px, py } = toPlotPixel(p.x, p.y);
                  const isSel = selectedDot?.lake_id===p.lake_id && selectedDot?.year===p.year;
                  // No-stocking dots get rendered hollow with a dark outline so they
                  // pop against the paper2 chart fill — the previous paper3 fill on
                  // a paper2 background was nearly invisible.
                  const noData = p.stocked == null;
                  return (
                    <Circle key={i} cx={px + plotW} cy={py + plotH} r={isSel?7:5}
                      fill={noData ? 'none' : stockedColor(p.stocked, sortedStocked)}
                      fillOpacity={noData ? 1 : 0.85}
                      stroke={isSel ? colors.ink : noData ? colors.inkSoft : colors.paper}
                      strokeWidth={isSel ? 1.5 : noData ? 1.2 : 0.5} />
                  );
                })}
              </Svg>
            </Animated.View>
          </View>
        </View>
      </GestureDetector>

      {view && (
        <Pressable style={styles.resetZoom} onPress={() => { viewRef.current=null; setView(null); syncTo(dataBounds); }}>
          <Text style={[text.labelM, { color: colors.ink }]}>Reset zoom</Text>
        </Pressable>
      )}

      <View style={styles.legend}>
        <View style={[styles.legendDot, styles.legendDotEmpty]} />
        <Text style={[text.labelS, { color: colors.inkSoft }]}>no data</Text>
        <Text style={[text.labelS, { color: colors.paper3 }]}>·</Text>
        <Text style={[text.labelS, { color: colors.inkSoft }]}>low</Text>
        <GradientBar width={90} height={10} />
        <Text style={[text.labelS, { color: colors.inkSoft }]}>high Stck Adults / 100AC</Text>
      </View>

      {selectedDot && (
        <Pressable style={styles.dotCard}
          onPress={() => { onLakePress(selectedDot.lake_id, selectedDot.name ?? ''); setSelectedDot(null); }}
        >
          {selectedDot.name != null ? (
            <Text style={[text.displayM, { color: colors.ink }]}>{selectedDot.name}</Text>
          ) : (
            <BlurredLakeName seed={selectedDot.lake_id} style={text.displayM} />
          )}
          {/* Single-line meta row — County, State, acres, depth, year all
              together. Mirrors the list-row info; wraps only if the screen
              can't fit it on one line. Species stays on its own line below. */}
          <Text style={[text.dataS, { color: colors.inkSoft, marginTop: 2 }]}>
            {[
              selectedDot.county ? `${selectedDot.county} Co · ${state.toUpperCase()}` : state.toUpperCase(),
              selectedDot.area_acres != null ? `${Math.round(selectedDot.area_acres).toLocaleString()} ac` : null,
              selectedDot.max_depth_feet != null ? `${Math.round(selectedDot.max_depth_feet)} ft` : null,
              selectedDot.survey_date ?? selectedDot.year,
            ].filter(Boolean).join(' · ')}
          </Text>
          <Text style={[text.dataS, { color: colors.inkSoft, marginTop: 2, marginBottom: 8 }]}>
            {selectedDot.species}
          </Text>
          <View style={styles.dotStats}>
            {/* Field set mirrors STATE_CONFIGS[state].sortOptions so the popup
                shows the same metrics the user can sort/filter on. */}
            {ratingMode ? (
              <Stat label="Forecast"
                    value={(selectedDot.ratingText ?? String(selectedDot.y)).replace(/\b\w/g, ch => ch.toUpperCase())} />
            ) : (
              <Stat label={STATE_CONFIGS[state].sortOptions.find(o => o.value === 'cpue')?.label ?? 'Catch / Net'}
                    value={selectedDot.y.toFixed(2)} />
            )}
            {selectedDot.average_length!=null && <Stat label="Avg length" value={`${selectedDot.average_length.toFixed(1)} in`} />}
            {selectedDot.estLength!=null && <Stat label="Est. length" value={`${selectedDot.estLength.toFixed(1)} in`} />}
            {selectedDot.average_weight!=null && selectedDot.average_weight>0 && <Stat label="Avg weight" value={`${selectedDot.average_weight.toFixed(2)} lb`} />}
            {selectedDot.total_catch!=null && <Stat label="Total catch" value={String(selectedDot.total_catch)} />}
            {selectedDot.stocked!=null && <Stat label="Stck Adults / 100AC" value={selectedDot.stocked.toFixed(1)} />}
            {selectedDot.stocked==null && selectedDot.stockedEst!=null &&
              <Stat label="Stck Adults (est)" value={Math.round(selectedDot.stockedEst).toLocaleString()} />}
          </View>
          <Text style={[text.labelM, { color: colors.walleye2, marginTop: 4 }]}>
            {/* Preview users can open the (identity-redacted) history too. */}
            {'Tap for lake history →'}
          </Text>
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
  plotClip: { position: 'absolute', overflow: 'hidden' },
  // top-left origin: the live-vs-committed transform math assumes it.
  plotTransform: { transformOrigin: 'top left' },
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
