import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, SafeAreaView,
  Modal, ScrollView,
} from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { useWindowDimensions } from 'react-native';
import { SD_COUNTIES, SD_VIEWBOX } from '../data/sdCountyPaths';
import { MN_COUNTIES, MN_VIEWBOX } from '../data/mnCountyPaths';
import { ND_COUNTIES, ND_VIEWBOX } from '../data/ndCountyPaths';
import { IA_COUNTIES, IA_VIEWBOX } from '../data/iaCountyPaths';
import { NE_COUNTIES, NE_VIEWBOX } from '../data/neCountyPaths';
import { WI_COUNTIES, WI_VIEWBOX } from '../data/wiCountyPaths';
import { MI_COUNTIES, MI_VIEWBOX } from '../data/miCountyPaths';
import { StateKey } from '../types';
import { colors, text, space, hairline, fonts } from '../lakelore-rn/theme';
import type { TextStyle } from 'react-native';
import { PaperHeader, Chip, SectionLabel } from '../lakelore-rn/components';

interface Props {
  visible: boolean;
  state: StateKey;
  selected: string[];
  onConfirm: (selected: string[]) => void;
  onClose: () => void;
}

interface VB { x: number; y: number; w: number; h: number }

export default function CountyMapPicker({ visible, state, selected, onConfirm, onClose }: Props) {
  return (
    <MapCountyPicker
      visible={visible}
      state={state}
      selected={selected}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}

function MapCountyPicker({ visible, state, selected, onConfirm, onClose }: Props) {
  const [draft, setDraft] = useState<string[]>(selected);
  const { width } = useWindowDimensions();

  const counties = state === 'mn' ? MN_COUNTIES : state === 'nd' ? ND_COUNTIES : state === 'ia' ? IA_COUNTIES : state === 'ne' ? NE_COUNTIES : state === 'wi' ? WI_COUNTIES : state === 'mi' ? MI_COUNTIES : SD_COUNTIES;
  const viewBox  = state === 'mn' ? MN_VIEWBOX  : state === 'nd' ? ND_VIEWBOX  : state === 'ia' ? IA_VIEWBOX  : state === 'ne' ? NE_VIEWBOX  : state === 'wi' ? WI_VIEWBOX  : state === 'mi' ? MI_VIEWBOX  : SD_VIEWBOX;
  const [, , vbW, vbH] = viewBox.split(' ').map(Number);
  const mapW = width - 32;
  const mapH = (mapW / vbW) * vbH;

  const defaultVB = useMemo<VB>(() => ({ x: 0, y: 0, w: vbW, h: vbH }), [vbW, vbH]);
  const [mapVB, setMapVB] = useState<VB>(defaultVB);
  const mapVBRef = useRef<VB>(defaultVB);
  const isZoomed = mapVB.w < vbW * 0.99;

  useEffect(() => {
    mapVBRef.current = defaultVB;
    setMapVB(defaultVB);
  }, [defaultVB]);

  const mapWRef = useRef(mapW);
  const mapHRef = useRef(mapH);
  const vbWRef = useRef(vbW);
  const vbHRef = useRef(vbH);
  mapWRef.current = mapW;
  mapHRef.current = mapH;
  vbWRef.current = vbW;
  vbHRef.current = vbH;

  const countiesRef = useRef(counties);
  countiesRef.current = counties;

  const pinchActiveRef = useRef(false);
  const prevTransXRef = useRef(0);
  const prevTransYRef = useRef(0);
  const prevScaleRef = useRef(1);

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
        setDraft(prev => prev.includes(bestName!) ? prev.filter(c => c !== bestName) : [...prev, bestName!]);
      }
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  const panGesture = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
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
      const vb = mapVBRef.current;
      const mW = mapWRef.current;
      const mH = mapHRef.current;
      const vW = vbWRef.current;
      const vH = vbHRef.current;
      let newX = vb.x - (pdx / mW) * vb.w;
      let newY = vb.y - (pdy / mH) * vb.h;
      newX = Math.max(-(vb.w * 0.1), Math.min(vW - vb.w * 0.9, newX));
      newY = Math.max(-(vb.h * 0.1), Math.min(vH - vb.h * 0.9, newY));
      const newVB = { ...vb, x: newX, y: newY };
      mapVBRef.current = newVB;
      setMapVB(newVB);
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
      const vb = mapVBRef.current;
      const mW = mapWRef.current;
      const mH = mapHRef.current;
      const vW = vbWRef.current;
      const vH = vbHRef.current;
      const newW = Math.max(vW / 10, Math.min(vW, vb.w * incrementalScale));
      const newH = Math.max(vH / 10, Math.min(vH, vb.h * incrementalScale));
      const pivotVBx = vb.x + (e.focalX / mW) * vb.w;
      const pivotVBy = vb.y + (e.focalY / mH) * vb.h;
      let newX = pivotVBx - (e.focalX / mW) * newW;
      let newY = pivotVBy - (e.focalY / mH) * newH;
      newX = Math.max(-(newW * 0.1), Math.min(vW - newW * 0.9, newX));
      newY = Math.max(-(newH * 0.1), Math.min(vH - newH * 0.9, newY));
      const newVB = { x: newX, y: newY, w: newW, h: newH };
      mapVBRef.current = newVB;
      setMapVB(newVB);
    })
    .onEnd(() => { pinchActiveRef.current = false; })
    .onFinalize(() => { pinchActiveRef.current = false; }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  const gesture = useMemo(
    () => Gesture.Race(tapGesture, Gesture.Simultaneous(panGesture, pinchGesture)),
    [tapGesture, panGesture, pinchGesture],
  );

  const handleShow = () => {
    setDraft(selected);
    mapVBRef.current = defaultVB;
    setMapVB(defaultVB);
  };

  const countyNames = Object.keys(counties).sort();
  const dynamicViewBox = `${mapVB.x} ${mapVB.y} ${mapVB.w} ${mapVB.h}`;
  const zoomFactor = vbW / mapVB.w;
  // Dense-county states (>70 counties) get a smaller label so labels don't overlap.
  const baseFontSize = state === 'mn' || state === 'ia' || state === 'wi' || state === 'mi' ? 5.5 : 6.5;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onShow={handleShow}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={styles.safe}>
          <PaperHeader
            modal
            title="Select Counties"
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

          <View style={styles.hintRow}>
            <Text style={[text.labelM, { color: colors.inkSoft }]}>
              Tap to select · drag to pan · pinch to zoom
            </Text>
            {isZoomed && (
              <Pressable onPress={() => { mapVBRef.current = defaultVB; setMapVB(defaultVB); }}>
                <Text style={[text.labelM, { color: colors.walleye2 }]}>Reset zoom</Text>
              </Pressable>
            )}
          </View>

          <GestureDetector gesture={gesture}>
            <View style={[styles.mapContainer, { width: mapW, height: mapH }]}>
              <Svg width={mapW} height={mapH} viewBox={dynamicViewBox}>
                {countyNames.map(name => {
                  const { d } = counties[name];
                  const isSelected = draft.includes(name);
                  return (
                    <Path key={name} d={d}
                      fill={isSelected ? colors.lake3 : colors.paper}
                      stroke={colors.paper3} strokeWidth={0.6} />
                  );
                })}
                {countyNames.map(name => {
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
            </View>
          </GestureDetector>

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
            <SectionLabel>All Counties</SectionLabel>
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
