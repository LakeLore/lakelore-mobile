import React, { useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions, PanResponder } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Result, StateKey, SD_SPECIES_NAMES, MN_SPECIES_NAMES, ND_SPECIES_NAMES, SD_SPECIES_FROM_NAME } from '../types';
import { colors, text, space, hairline, fonts } from '../lakelore-rn/theme';


// ── PSD length tables ─────────────────────────────────────────────────────────
const PSD_LENGTHS: Record<string, [number, number, number, number, number]> = {
  WAE:[250,380,510,635,760], NOP:[350,530,710,890,1070],
  LMB:[200,300,380,510,630], SMB:[180,280,350,430,510],
  BLG:[80,150,200,250,300],  YEP:[130,200,250,300,400],
  BLC:[130,200,250,300,380], WHC:[150,200,250,300,380],
  MUE:[500,750,900,1070,1200],SAU:[230,330,460,580,710],
  SAR:[230,330,460,580,710], RBT:[150,300,410,510,610],
  BNT:[150,300,410,510,610], STH:[300,400,510,610,710],
  WHB:[190,250,300,360,400], CCF:[280,380,510,610,710],
};

function estimateMeanLength(species: string, n_sq?: number|null, n_qp?: number|null, n_pm?: number|null, n_m?: number|null): number | null {
  const code = SD_SPECIES_FROM_NAME[species] ?? species;
  const L = PSD_LENGTHS[code];
  if (!L) return null;
  const [S,Q,P,M,T] = L;
  const counts = [n_sq??0, n_qp??0, n_pm??0, n_m??0];
  const mids = [(S+Q)/2,(Q+P)/2,(P+M)/2,(M+T)/2];
  const total = counts.reduce((a,b)=>a+b,0);
  if (total===0) return null;
  return Math.round((counts.reduce((acc,n,i)=>acc+n*mids[i],0)/total)/25.4*10)/10;
}

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
  const hasMoved = useRef(false);
  const prevTouchCount = useRef(0);
  const maxTouchCount = useRef(0);
  const prevPinchDist = useRef(0);
  const prevPanX = useRef(0);
  const prevPanY = useRef(0);
  const svgContainerRef = useRef<View>(null);
  const svgOffsetRef = useRef({ pageX: 0, pageY: 0 });
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
    } else {
      // SD: estimate mean length from PSD size-class counts
      for (const r of results) {
        if (r.cpue==null) continue;
        const len = estimateMeanLength(r.species, r.n_sq, r.n_qp, r.n_pm, r.n_m);
        if (len==null) continue;
        pts.push({
          x: len, y: r.cpue,
          stocked: r.stocked_per_100ac,
          name: r.lake_name, species: namesMap[r.species]??r.species,
          year: r.survey_year, lake_id: r.lake_id,
          estLength: len,
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

  // ── PanResponder for pan + pinch ─────────────────────────────────────────────
  const measureSvg = () => {
    svgContainerRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      svgOffsetRef.current = { pageX, pageY };
    });
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,

    onPanResponderGrant: (evt) => {
      measureSvg();
      const touches = evt.nativeEvent.touches;
      const tc = touches.length;
      hasMoved.current = false;
      prevTouchCount.current = tc;
      maxTouchCount.current = tc;
      prevPinchDist.current = 0;
      if (tc === 1) {
        prevPanX.current = touches[0].pageX;
        prevPanY.current = touches[0].pageY;
      } else if (tc >= 2) {
        const dx = touches[0].pageX - touches[1].pageX;
        const dy = touches[0].pageY - touches[1].pageY;
        prevPinchDist.current = Math.sqrt(dx*dx + dy*dy);
      }
    },

    onPanResponderMove: (evt) => {
      const touches = evt.nativeEvent.touches;
      const tc = touches.length;
      maxTouchCount.current = Math.max(maxTouchCount.current, tc);

      if (tc >= 2) {
        hasMoved.current = true;
        const dx = touches[0].pageX - touches[1].pageX;
        const dy = touches[0].pageY - touches[1].pageY;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (prevTouchCount.current < 2 || prevPinchDist.current === 0) {
          // First frame with 2 fingers — store baseline distance, apply next frame
          prevPinchDist.current = dist;
          prevTouchCount.current = tc;
          return;
        }
        prevTouchCount.current = tc;

        // Incremental scale: ratio of previous frame distance to current
        const scale = prevPinchDist.current / dist;
        prevPinchDist.current = dist;

        const cur = viewRef.current ?? dataBounds;
        const cx = (cur.xMin + cur.xMax) / 2;
        const cy = (cur.yMin + cur.yMax) / 2;
        const hw = (cur.xMax - cur.xMin) / 2 * scale;
        const hh = (cur.yMax - cur.yMin) / 2 * scale;
        const newView = { xMin: cx-hw, xMax: cx+hw, yMin: Math.max(0, cy-hh), yMax: cy+hh };
        viewRef.current = newView;
        setView(newView);

      } else if (tc === 1) {
        if (prevTouchCount.current >= 2) {
          // Transition 2→1 finger: anchor pan at current touch position
          prevPanX.current = touches[0].pageX;
          prevPanY.current = touches[0].pageY;
        }
        prevTouchCount.current = 1;

        const pdx = touches[0].pageX - prevPanX.current;
        const pdy = touches[0].pageY - prevPanY.current;
        if (Math.abs(pdx) > 2 || Math.abs(pdy) > 2) hasMoved.current = true;
        prevPanX.current = touches[0].pageX;
        prevPanY.current = touches[0].pageY;

        const cur = viewRef.current ?? dataBounds;
        const dDataX = -(pdx / plotW) * (cur.xMax - cur.xMin);
        const dDataY = (pdy / plotH) * (cur.yMax - cur.yMin);
        const newView = {
          xMin: cur.xMin + dDataX, xMax: cur.xMax + dDataX,
          yMin: Math.max(0, cur.yMin + dDataY), yMax: cur.yMax + dDataY,
        };
        viewRef.current = newView;
        setView(newView);
      }
    },

    onPanResponderRelease: (evt) => {
      prevPinchDist.current = 0;
      const wasMove = hasMoved.current;
      const maxTc = maxTouchCount.current;
      hasMoved.current = false;
      prevTouchCount.current = 0;
      maxTouchCount.current = 0;

      // Tap: no significant movement, only 1 finger used
      if (!wasMove && maxTc === 1) {
        const { pageX: ox, pageY: oy } = svgOffsetRef.current;
        const svgX = evt.nativeEvent.pageX - ox;
        const svgY = evt.nativeEvent.pageY - oy;
        const cur = viewRef.current ?? dataBounds;
        const xRange = cur.xMax - cur.xMin;
        const yRange = cur.yMax - cur.yMin;

        let bestDot: DotData | null = null;
        let bestDist2 = 40 * 40; // 40px tap threshold

        for (const p of pointsRef.current) {
          if (p.x < cur.xMin || p.x > cur.xMax || p.y < cur.yMin || p.y > cur.yMax) continue;
          const px = PAD_L + ((p.x - cur.xMin) / xRange) * plotW;
          const py = PAD_T + (1 - (p.y - cur.yMin) / yRange) * plotH;
          const d2 = (svgX - px) * (svgX - px) + (svgY - py) * (svgY - py);
          if (d2 < bestDist2) { bestDist2 = d2; bestDot = p; }
        }

        if (bestDot) {
          const sel = selectedDotRef.current;
          const isSel = sel?.lake_id === bestDot.lake_id && sel?.year === bestDot.year;
          setSelectedDot(isSel ? null : bestDot);
        }
      }
    },

    onPanResponderTerminate: () => {
      hasMoved.current = false;
      prevTouchCount.current = 0;
      prevPinchDist.current = 0;
      maxTouchCount.current = 0;
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [dataBounds, plotW, plotH]);

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

      <View ref={svgContainerRef} style={[styles.chartWrap, { width: svgW, height: svgH }]} onLayout={measureSvg} {...panResponder.panHandlers}>
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
            return (
              <Circle key={i} cx={px} cy={py} r={isSel?7:5}
                fill={stockedColor(p.stocked, minStocked, maxStocked)}
                fillOpacity={0.85} stroke={isSel?colors.ink:colors.paper} strokeWidth={isSel?1.5:0.5} />
            );
          })}
        </Svg>
      </View>

      {view && (
        <Pressable style={styles.resetZoom} onPress={() => { viewRef.current=null; setView(null); }}>
          <Text style={[text.labelM, { color: colors.ink }]}>Reset zoom</Text>
        </Pressable>
      )}

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

      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: colors.paper3 }]} />
        <Text style={[text.labelS, { color: colors.inkSoft }]}>no data</Text>
        <Text style={[text.labelS, { color: colors.paper3 }]}>·</Text>
        <Text style={[text.labelS, { color: colors.inkSoft }]}>low</Text>
        <GradientBar width={90} height={10} />
        <Text style={[text.labelS, { color: colors.inkSoft }]}>high stocked/100ac</Text>
      </View>
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
});
