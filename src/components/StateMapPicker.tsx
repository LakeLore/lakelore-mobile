// StateMapPicker — pan/zoom SVG map of the US + Canada for choosing a state
// or province, plus a grouped A-Z list below (the accessible path — the SVG
// map is not usefully readable by screen readers). Used by StateSelectScreen
// (inline) and the in-search StatePickerModal (inside its modal).
//
// Interaction mirrors CountyMapPicker: drag to pan, pinch to zoom, tap to
// pick (nearest selectable centroid — small east-coast states are reachable
// by zooming in first). Selection is single-tap-and-go: no draft/Done step.
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSvgPanZoom, useCommittedMirror, assertWorklet } from '../hooks/useSvgPanZoom';
import { STATE_PATHS, STATES_VIEWBOX } from '../data/statePaths';
import { StateKey, GENERATED_STATES } from '../types';
import { isFreeState } from '../activeStates';
import { colors, text, space, hairline, fonts } from '../lakelore-rn/theme';
import { LockIcon, SectionLabel } from '../lakelore-rn/components';
import { useToast } from '../Toast';

interface Props {
  /** Currently-selected state (highlighted on the map), if any. */
  selected?: StateKey | null;
  /** Entitlement for the PREVIEW chips in the list. */
  hasAllStates: boolean;
  /** While true, no FREE/PREVIEW chips render (avoids the locked flash). */
  entitlementLoading?: boolean;
  onSelect: (s: StateKey) => void;
}

interface VB { x: number; y: number; w: number; h: number }

// Selectable = in the registry AND active (states with no stocking and no
// CPUE data are registry-inactive — drawn muted like the no-data provinces).
const SELECTABLE = STATE_PATHS.filter(p => p.key != null && GENERATED_STATES[p.key].active);
const isSelectableKey = (k: StateKey | null): k is StateKey =>
  k != null && GENERATED_STATES[k].active;

export default function StateMapPicker({ selected, hasAllStates, entitlementLoading, onSelect }: Props) {
  const { width } = useWindowDimensions();
  const [, , vbW, vbH] = STATES_VIEWBOX.split(' ').map(Number);
  const mapW = width - 32;
  const mapH = (mapW / vbW) * vbH;

  const defaultVB = useMemo<VB>(() => ({ x: 0, y: 0, w: vbW, h: vbH }), [vbW, vbH]);
  const [mapVB, setMapVB] = useState<VB>(defaultVB);
  const mapVBRef = useRef<VB>(defaultVB);
  const isZoomed = mapVB.w < vbW * 0.99;

  const commitVB = useCallback((vb: VB) => {
    mapVBRef.current = vb;
    setMapVB(vb);
  }, []);
  const { live, committed, panActive, pinchActive, dirty, maybeCommit, syncTo } =
    useSvgPanZoom<VB>(defaultVB, commitVB);
  useCommittedMirror(committed, mapVB);

  const resetView = useCallback(() => {
    syncTo(defaultVB);
    mapVBRef.current = defaultVB;
    setMapVB(defaultVB);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultVB]);

  useEffect(() => { resetView(); }, [resetView]);

  const mapWRef = useRef(mapW);
  const mapHRef = useRef(mapH);
  mapWRef.current = mapW;
  mapHRef.current = mapH;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const tapGesture = useMemo(() => Gesture.Tap()
    .runOnJS(true)
    .maxDuration(300)
    .maxDistance(12)
    .onEnd((e, success) => {
      if (!success) return;
      const vb = mapVBRef.current;
      const vx = vb.x + (e.x / mapWRef.current) * vb.w;
      const vy = vb.y + (e.y / mapHRef.current) * vb.h;
      // Nearest centroid over ALL drawn states first (not just selectable):
      // a tap on a muted no-data state must EXPLAIN itself, not silently
      // select whichever active neighbor is closest (D4). The hit distance
      // is capped (~90pt on screen, scaled to the current zoom) so taps in
      // open water/whitespace do nothing rather than picking a random state.
      const capVB = (90 / mapWRef.current) * vb.w;
      const capSq = capVB * capVB;
      let nearest: (typeof STATE_PATHS)[number] | null = null;
      let nearestDist = Infinity;
      for (const p of STATE_PATHS) {
        if (p.key == null) continue;
        const d = (vx - p.cx) * (vx - p.cx) + (vy - p.cy) * (vy - p.cy);
        if (d < nearestDist) { nearestDist = d; nearest = p; }
      }
      if (!nearest || nearestDist > capSq) return;
      const key = nearest.key as StateKey;
      if (!GENERATED_STATES[key].active) {
        // Neutral copy on purpose: inactive covers BOTH data-thin states and
        // legally-held ones (2026-08-04) — "no survey data yet" was a false
        // statement for states users had previously browsed (MI/ON).
        toastRef.current?.(`${GENERATED_STATES[key].name} isn't currently available in LakeLore.`);
        return;
      }
      Haptics.selectionAsync().catch(() => {});
      onSelectRef.current(key);
    }),
  []);

  const panGesture = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .onStart(() => {
      'worklet';
      assertWorklet('StateMapPicker pan');
      panActive.value = true;
    })
    .onEnd(() => {
      'worklet';
      panActive.value = false;
      maybeCommit();
    })
    .onChange((e) => {
      'worklet';
      if (e.numberOfPointers > 1) return;
      const vb = live.value;
      let newX = vb.x - (e.changeX / mapW) * vb.w;
      let newY = vb.y - (e.changeY / mapH) * vb.h;
      newX = Math.max(-(vb.w * 0.1), Math.min(vbW - vb.w * 0.9, newX));
      newY = Math.max(-(vb.h * 0.1), Math.min(vbH - vb.h * 0.9, newY));
      live.value = { x: newX, y: newY, w: vb.w, h: vb.h };
      dirty.value = true;
    })
    .onFinalize(() => {
      'worklet';
      panActive.value = false;
      maybeCommit();
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [mapW, mapH, vbW, vbH]);

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
      const vb = live.value;
      const newW = Math.max(vbW / 12, Math.min(vbW, vb.w * incrementalScale));
      const newH = Math.max(vbH / 12, Math.min(vbH, vb.h * incrementalScale));
      const pivotVBx = vb.x + (e.focalX / mapW) * vb.w;
      const pivotVBy = vb.y + (e.focalY / mapH) * vb.h;
      let newX = pivotVBx - (e.focalX / mapW) * newW;
      let newY = pivotVBy - (e.focalY / mapH) * newH;
      newX = Math.max(-(newW * 0.1), Math.min(vbW - newW * 0.9, newX));
      newY = Math.max(-(newH * 0.1), Math.min(vbH - newH * 0.9, newY));
      live.value = { x: newX, y: newY, w: newW, h: newH };
      dirty.value = true;
    })
    .onFinalize(() => {
      'worklet';
      pinchActive.value = false;
      maybeCommit();
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [mapW, mapH, vbW, vbH]);

  const animatedStyle = useAnimatedStyle(() => {
    const c = committed.value;
    const l = live.value;
    return {
      transform: [
        { translateX: ((c.x - l.x) / l.w) * mapW },
        { translateY: ((c.y - l.y) / l.h) * mapH },
        { scale: c.w / l.w },
      ],
    };
  });

  const gesture = useMemo(
    () => Gesture.Race(tapGesture, Gesture.Simultaneous(panGesture, pinchGesture)),
    [tapGesture, panGesture, pinchGesture],
  );

  const dynamicViewBox = `${mapVB.x} ${mapVB.y} ${mapVB.w} ${mapVB.h}`;
  const zoomFactor = vbW / mapVB.w;
  const labelSize = 7 / Math.sqrt(zoomFactor);

  const usRows = SELECTABLE.filter(p => p.country === 'US')
    .sort((a, b) => a.name.localeCompare(b.name));
  const caRows = SELECTABLE.filter(p => p.country === 'CA')
    .sort((a, b) => a.name.localeCompare(b.name));

  const listRow = (p: (typeof SELECTABLE)[number]) => {
    const key = p.key as StateKey;
    const cfg = GENERATED_STATES[key];
    const showFree = !entitlementLoading && isFreeState(key);
    const locked = !entitlementLoading && !isFreeState(key) && !hasAllStates;
    return (
      <Pressable
        key={key}
        onPress={() => { Haptics.selectionAsync().catch(() => {}); onSelect(key); }}
        accessibilityRole="button"
        accessibilityLabel={locked
          ? `${p.name}, ${cfg.agency}, preview — lake names require the All-States subscription`
          : showFree ? `${p.name}, ${cfg.agency}, free` : `${p.name}, ${cfg.agency}`}
        style={({ pressed }) => [
          styles.listRow,
          { backgroundColor: pressed ? colors.paper2 : (selected === key ? colors.paper2 : colors.paper) },
        ]}>
        <View style={[styles.stripe, { backgroundColor: cfg.stripe }]} />
        <View style={styles.listBody}>
          <Text style={[text.bodyL, { color: colors.ink, flex: 1 }]} numberOfLines={1}>
            {p.name}
          </Text>
          {showFree ? (
            <Text style={[text.labelS, { color: colors.moss }]}>FREE</Text>
          ) : locked ? (
            <View style={styles.lockRow}>
              <LockIcon size={9} />
              <Text style={[text.labelS, { color: colors.walleye2 }]}>PREVIEW</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <View style={styles.hintRow}>
          <Text style={[text.labelM, { color: colors.inkSoft }]}>
            Tap a state · drag to pan · pinch to zoom
          </Text>
          {isZoomed && (
            <Pressable onPress={resetView}>
              <Text style={[text.labelM, { color: colors.walleye2 }]}>Reset zoom</Text>
            </Pressable>
          )}
        </View>

        {/* GestureDetector must stay on this static container — tap and
            pinch-focal coordinates are relative to the attached view, and
            the inner Animated.View moves mid-gesture. */}
        <GestureDetector gesture={gesture}>
          <View style={[styles.mapContainer, { width: mapW, height: mapH }]}>
            <Animated.View style={[styles.mapTransform, animatedStyle]}>
              <Svg width={mapW} height={mapH} viewBox={dynamicViewBox}>
                {STATE_PATHS.map(p => {
                  const selectable = isSelectableKey(p.key);
                  const isSelected = selectable && p.key === selected;
                  const fill = !selectable
                    ? colors.paper2                       // no data — muted
                    : isSelected ? colors.lake3
                    : isFreeState(p.key as StateKey) ? colors.walleye // MN — free tier
                    : colors.paper;
                  return (
                    <Path key={`${p.country}-${p.postal}`} d={p.d}
                      fill={fill}
                      stroke={colors.paper3} strokeWidth={0.5} />
                  );
                })}
                {SELECTABLE.map(p => (
                  <SvgText key={`label-${p.country}-${p.postal}`} x={p.cx} y={p.cy}
                    fontSize={labelSize}
                    fontFamily={fonts.mono}
                    textAnchor="middle" alignmentBaseline="middle"
                    fill={p.key === selected ? colors.paper : colors.ink}>
                    {p.postal}
                  </SvgText>
                ))}
              </Svg>
            </Animated.View>
          </View>
        </GestureDetector>

        <View style={styles.legendRow}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.walleye }]} />
          <Text style={[text.labelS, { color: colors.inkSoft }]}>FREE</Text>
          <View style={[styles.legendSwatch, { backgroundColor: colors.paper, borderWidth: hairline, borderColor: colors.paper3 }]} />
          <Text style={[text.labelS, { color: colors.inkSoft }]}>ALL-STATES PASS</Text>
          <View style={[styles.legendSwatch, { backgroundColor: colors.paper2 }]} />
          <Text style={[text.labelS, { color: colors.inkSoft }]}>NO DATA YET</Text>
        </View>
        {/* The map is the primary surface, and it previously said nothing
            about free-with-redaction browsing (D5) — the pass gates lake
            IDENTITY, not entry. */}
        <Text style={[text.labelS, { color: colors.inkSoft, textAlign: 'center', marginTop: 4, paddingHorizontal: space.xl }]}>
          Pass states open free in preview — every metric shown, lake names &amp; locations hidden
        </Text>

        <View style={styles.sectionHead}>
          <SectionLabel>United States</SectionLabel>
        </View>
        {usRows.map(listRow)}
        <View style={styles.sectionHead}>
          <SectionLabel>Canada</SectionLabel>
        </View>
        {caRows.map(listRow)}
        <View style={{ height: 48 }} />
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: space.xl,
    marginTop: space.md,
    marginBottom: space.xs,
  },
  mapContainer: {
    alignSelf: 'center',
    marginHorizontal: space.xl,
    marginVertical: space.md,
    borderWidth: hairline,
    borderColor: colors.ink,
    overflow: 'hidden',
    backgroundColor: colors.paper,
  },
  // top-left origin: the live-vs-committed transform math assumes it.
  mapTransform: {
    transformOrigin: 'top left',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: space.xl,
    marginBottom: space.sm,
  },
  legendSwatch: { width: 10, height: 10, marginLeft: 8 },
  sectionHead: {
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: 4,
  },
  listRow: {
    flexDirection: 'row',
    borderBottomWidth: hairline,
    borderBottomColor: colors.paper3,
  },
  stripe: { width: 6 },
  listBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: 12,
  },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
