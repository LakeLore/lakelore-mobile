import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet,
  Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSvgPanZoom, useCommittedMirror, assertWorklet } from '../hooks/useSvgPanZoom';
import { useWindowDimensions } from 'react-native';
import { COUNTY_MAPS } from '../data/countyPaths';
import { StateKey, GENERATED_STATES } from '../types';
import { colors, text, space, hairline, fonts } from '../lakelore-rn/theme';
import type { TextStyle } from 'react-native';
import { PaperHeader, Chip, SectionLabel } from '../lakelore-rn/components';

interface Props {
  visible: boolean;
  state: StateKey;
  selected: string[];
  /** County values from the server's /filters — the authoritative filter
   *  vocabulary. Merged into the list; the sole source for states without
   *  map geometry (RI towns, AK areas, Canadian FMZs/regions). */
  countyOptions?: string[];
  onConfirm: (selected: string[]) => void;
  onClose: () => void;
}

interface VB { x: number; y: number; w: number; h: number }

export default function CountyMapPicker({ visible, state, selected, countyOptions, onConfirm, onClose }: Props) {
  return (
    <MapCountyPicker
      visible={visible}
      state={state}
      selected={selected}
      countyOptions={countyOptions}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}

function MapCountyPicker({ visible, state, selected, countyOptions, onConfirm, onClose }: Props) {
  const [draft, setDraft] = useState<string[]>(selected);
  const { width } = useWindowDimensions();

  // Canadian provinces use FMZs/regions, not counties — adjust labels.
  const regionLabel = GENERATED_STATES[state]?.country === 'CA' ? 'Regions' : 'Counties';

  // Generated map geometry (48 US states). Absent (RI, AK, Canada) → the
  // modal renders the list-only picker below the header.
  const mapData = COUNTY_MAPS[state];
  const hasMap = mapData != null;
  const counties = mapData?.counties ?? {};
  const viewBox = mapData?.viewBox ?? '0 0 500 300';
  const [, , vbW, vbH] = viewBox.split(' ').map(Number);
  const mapW = width - 32;
  const mapH = (mapW / vbW) * vbH;

  const defaultVB = useMemo<VB>(() => ({ x: 0, y: 0, w: vbW, h: vbH }), [vbW, vbH]);
  const [mapVB, setMapVB] = useState<VB>(defaultVB);
  const mapVBRef = useRef<VB>(defaultVB);
  const isZoomed = mapVB.w < vbW * 0.99;

  // Pan/pinch run as UI-thread worklets mutating `live`; React re-renders the
  // SVG once per gesture, at finger-up (commitVB). Between updates the
  // rendered (committed) SVG is repositioned by a plain View transform.
  const commitVB = useCallback((vb: VB) => {
    mapVBRef.current = vb;   // synchronously, so a fast follow-up tap hit-tests fresh bounds
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

  useEffect(() => {
    resetView();
  }, [resetView]);

  // Refs feeding the (JS-thread) tap handler.
  const mapWRef = useRef(mapW);
  const mapHRef = useRef(mapH);
  mapWRef.current = mapW;
  mapHRef.current = mapH;

  const countiesRef = useRef(counties);
  countiesRef.current = counties;

  const tapGesture = useMemo(() => Gesture.Tap()
    .runOnJS(true)
    .maxDuration(300)
    .maxDistance(12)
    .onEnd((e, success) => {
      if (!success) return;
      const vb = mapVBRef.current;
      const mW = mapWRef.current;
      const mH = mapHRef.current;
      const vx = vb.x + (e.x / mW) * vb.w;
      const vy = vb.y + (e.y / mH) * vb.h;
      let bestName: string | null = null;
      let bestDist = Infinity;
      for (const [name, { cx, cy }] of Object.entries(countiesRef.current)) {
        const d = (vx - cx) * (vx - cx) + (vy - cy) * (vy - cy);
        if (d < bestDist) { bestDist = d; bestName = name; }
      }
      if (bestName) {
        Haptics.selectionAsync().catch(() => {});
        setDraft(prev => prev.includes(bestName!) ? prev.filter(c => c !== bestName) : [...prev, bestName!]);
      }
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  const panGesture = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .onStart(() => {
      'worklet';
      assertWorklet('CountyMapPicker pan');
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
      // event itself, NOT the pinchActive flag: on Android a pinch's end event
      // can be dropped in Race/Simultaneous configs, and a stuck flag would
      // silently kill panning for the rest of the session.
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
    // Reset in BOTH onEnd and onFinalize (the legacy code did too) — Android
    // has been seen dropping one of them; pinchActive now only coordinates
    // the end-of-gesture commit, so a duplicate reset is harmless.
    .onEnd(() => {
      'worklet';
      pinchActive.value = false;
      maybeCommit();
    })
    .onChange((e) => {
      'worklet';
      const incrementalScale = 1 / e.scaleChange;
      const vb = live.value;
      const newW = Math.max(vbW / 10, Math.min(vbW, vb.w * incrementalScale));
      const newH = Math.max(vbH / 10, Math.min(vbH, vb.h * incrementalScale));
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

  // Repositions the committed render to match `live` between commits.
  // Identity when live === committed. Uniform scale — the clamps above
  // preserve the viewBox aspect ratio.
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

  const handleShow = () => {
    setDraft(selected);
    resetView();
  };

  // Map shapes vs the full list: the list is the union of map shapes and the
  // server's county vocabulary — DB values with no census shape (multi-county
  // strings, typos, FMZs) stay selectable via the list even when they can't
  // be tapped on the map.
  const mapNames = Object.keys(counties).sort();
  const countyNames = [...new Set([...mapNames, ...(countyOptions ?? [])])].sort();
  const dynamicViewBox = `${mapVB.x} ${mapVB.y} ${mapVB.w} ${mapVB.h}`;
  const zoomFactor = vbW / mapVB.w;
  // Dense states (>70 shapes) get a smaller label so labels don't overlap.
  const baseFontSize = Object.keys(counties).length > 70 ? 5.5 : 6.5;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onShow={handleShow}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={styles.safe}>
          <PaperHeader
            modal
            title={regionLabel === 'Regions' ? 'Select Regions' : 'Select Counties'}
            onBack={onClose}
            backLabel="Cancel"
            right={
              <Pressable
                onPress={() => { onConfirm(draft); onClose(); }}
                hitSlop={12}
                style={styles.doneBtn}>
                <Text style={styles.doneText}>
                  Done{draft.length > 0 ? ` · ${draft.length}` : ''}
                </Text>
              </Pressable>
            }
          />

          {hasMap && (
            <View style={styles.hintRow}>
              <Text style={[text.labelM, { color: colors.inkSoft }]}>
                Tap to select · drag to pan · pinch to zoom
              </Text>
              {isZoomed && (
                <Pressable onPress={resetView}>
                  <Text style={[text.labelM, { color: colors.walleye2 }]}>Reset zoom</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* GestureDetector must stay on this static container — tap and
              pinch-focal coordinates are relative to the attached view, and
              the inner Animated.View moves mid-gesture. */}
          {hasMap && (
          <GestureDetector gesture={gesture}>
            <View style={[styles.mapContainer, { width: mapW, height: mapH }]}>
              <Animated.View style={[styles.mapTransform, animatedStyle]}>
              <Svg width={mapW} height={mapH} viewBox={dynamicViewBox}>
                {mapNames.map(name => {
                  const { d } = counties[name];
                  const isSelected = draft.includes(name);
                  return (
                    <Path key={name} d={d}
                      fill={isSelected ? colors.lake3 : colors.paper}
                      stroke={colors.paper3} strokeWidth={0.6} />
                  );
                })}
                {mapNames.map(name => {
                  const { cx, cy } = counties[name];
                  const isSelected = draft.includes(name);
                  if (cx < 8 || cx > vbW - 8 || cy < 8 || cy > vbH - 8) return null;
                  return (
                    <SvgText key={`label-${name}`} x={cx} y={cy}
                      // baseFontSize is in viewBox units, so dividing by zoomFactor
                      // would keep the on-screen size constant. Dividing by √zoom
                      // instead lets labels grow at ~half the zoom rate — readable
                      // when zoomed in without exploding at high zoom.
                      fontSize={baseFontSize / Math.sqrt(zoomFactor)}
                      fontFamily={fonts.mono}
                      textAnchor="middle" alignmentBaseline="middle"
                      fill={isSelected ? colors.paper : colors.ink}>
                      {name}
                    </SvgText>
                  );
                })}
              </Svg>
              </Animated.View>
            </View>
          </GestureDetector>
          )}

          {draft.length > 0 && (
            <View style={styles.chips}>
              {draft.map(c => (
                <Pressable key={c} onPress={() => setDraft(prev => prev.filter(x => x !== c))}>
                  <View style={styles.activeChip}>
                    <Text style={[text.labelM, { color: colors.ink }]}>{c} ×</Text>
                  </View>
                </Pressable>
              ))}
              <Pressable onPress={() => setDraft([])} hitSlop={6}>
                <Text style={[text.labelM, { color: colors.destructive }]}>Clear all</Text>
              </Pressable>
            </View>
          )}

          <View style={{ paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: 4 }}>
            <SectionLabel>{regionLabel === 'Regions' ? 'All Regions' : 'All Counties'}</SectionLabel>
          </View>
          <ScrollView style={{ flex: 1 }}>
            <View style={styles.list}>
              {countyNames.map(name => {
                const isSelected = draft.includes(name);
                return (
                  <Pressable key={name}
                    onPress={() => setDraft(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name])}>
                    <View style={[
                      styles.listRow,
                      { backgroundColor: isSelected ? colors.walleye : colors.paper },
                    ]}>
                      <Text style={[text.labelM, { color: colors.ink }]}>{name}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  // Larger, more prominent Done action than the default header label.
  doneBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  doneText: {
    fontFamily: fonts.monoSemi,
    fontSize: 17,
    letterSpacing: 1.7,
    color: colors.walleye2,
  } as TextStyle,
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
  },
  // top-left origin: the live-vs-committed transform math assumes it.
  mapTransform: {
    transformOrigin: 'top left',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  activeChip: {
    borderWidth: hairline,
    borderColor: colors.ink,
    backgroundColor: colors.walleye,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: space.lg,
    gap: 6,
  },
  listRow: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: hairline,
    borderColor: colors.ink,
  },
});
