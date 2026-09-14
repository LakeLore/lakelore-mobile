// Dual-thumb range slider (2026-09-12, owner request: filter ranges as
// sliders — "the dots on either end slide to select a range").
//
// Pure JS on purpose: this shipped as an OTA to the staging TestFlight build,
// and an OTA cannot add a native module. PanResponder + Views only.
//
// Contract mirrors RangeField's: values are the FilterState strings ('' =
// unbounded). A thumb parked at its end of the track means "no bound" — so
// the domain caps below never silently exclude data beyond them (a lake
// bigger than the acres cap still matches when the right dot sits at the
// end). Only an interior position writes a bound.
import React, { useRef, useState } from 'react';
import { View, Text, PanResponder, StyleSheet } from 'react-native';
import { colors, text, space } from '../../lakelore-rn/theme';
import { SectionLabel } from '../../lakelore-rn/components';

type Props = {
  label: string;
  /** Domain the track spans. Values beyond `max` are reachable only as "no
   *  upper bound" (thumb at the right end). */
  min: number;
  max: number;
  step: number;
  minVal: string;
  maxVal: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  /** Optional unit suffix for the value readout ("ac", "in", "lb"). */
  unit?: string;
  /** Fires true on thumb grab, false on release — the parent ScrollView
   *  disables scrolling while a drag is live so it can't steal the gesture
   *  mid-drag (the "sticky slider" bug, owner 2026-09-14). */
  onDragging?: (active: boolean) => void;
};

const THUMB = 24;      // visible dot
const HIT = 44;        // touch target
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const fmtNum = (v: number) => (Math.abs(v % 1) < 1e-9 ? String(Math.round(v)) : String(+v.toFixed(2)));

export function RangeSlider({
  label, min, max, step, minVal, maxVal, onMinChange, onMaxChange, unit, onDragging,
}: Props) {
  const [width, setWidth] = useState(0);

  const parse = (s: string): number | null => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  };
  const lo = clamp(parse(minVal) ?? min, min, max);
  const hi = clamp(parse(maxVal) ?? max, min, max);

  // Refs so the PanResponders (created once) always see current values.
  const loRef = useRef(lo); loRef.current = lo;
  const hiRef = useRef(hi); hiRef.current = hi;
  const widthRef = useRef(0); widthRef.current = width;
  const grabRef = useRef(0);
  const onDraggingRef = useRef(onDragging); onDraggingRef.current = onDragging;

  const usable = () => Math.max(widthRef.current - THUMB, 1);
  const toX = (v: number) => ((v - min) / (max - min)) * usable();
  const fromX = (x: number) => min + (x / usable()) * (max - min);
  const snap = (v: number) => clamp(Math.round(v / step) * step, min, max);

  // Once a thumb owns the gesture it must KEEP it until the finger lifts:
  // the enclosing ScrollView asks to take over as soon as the drag wanders
  // (termination request) — the default "yes" is what made drags stop after
  // a short distance. Refuse it, block the native responder (Android), and
  // tell the parent to freeze scrolling for the duration.
  const panLo = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: () => { grabRef.current = loRef.current; onDraggingRef.current?.(true); },
    onPanResponderMove: (_e, g) => {
      const v = snap(clamp(fromX(toX(grabRef.current) + g.dx), min, hiRef.current));
      onMinChange(v <= min ? '' : fmtNum(v));
    },
    onPanResponderRelease: () => { onDraggingRef.current?.(false); },
    onPanResponderTerminate: () => { onDraggingRef.current?.(false); },
  })).current;

  const panHi = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: () => { grabRef.current = hiRef.current; onDraggingRef.current?.(true); },
    onPanResponderMove: (_e, g) => {
      const v = snap(clamp(fromX(toX(grabRef.current) + g.dx), loRef.current, max));
      onMaxChange(v >= max ? '' : fmtNum(v));
    },
    onPanResponderRelease: () => { onDraggingRef.current?.(false); },
    onPanResponderTerminate: () => { onDraggingRef.current?.(false); },
  })).current;

  const u = unit ? ` ${unit}` : '';
  const loLabel = lo <= min && !parse(minVal) ? 'Any' : `${fmtNum(lo)}${u}`;
  const hiLabel = hi >= max && !parse(maxVal) ? 'Any' : `${fmtNum(hi)}${u}`;
  const xLo = width ? toX(lo) : 0;
  const xHi = width ? toX(hi) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <SectionLabel>{label}</SectionLabel>
        <Text style={[text.dataS, { color: colors.inkSoft }]}>{loLabel} – {hiLabel}</Text>
      </View>
      <View
        style={styles.trackArea}
        onLayout={e => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityLabel={`${label} range, ${loLabel} to ${hiLabel}`}>
        <View style={styles.track} />
        {width > 0 && (
          <>
            <View style={[styles.trackActive, { left: xLo + THUMB / 2, width: Math.max(xHi - xLo, 0) }]} />
            <View {...panLo.panHandlers} style={[styles.hit, { left: xLo - (HIT - THUMB) / 2 }]}>
              <View style={styles.thumb} />
            </View>
            <View {...panHi.panHandlers} style={[styles.hit, { left: xHi - (HIT - THUMB) / 2 }]}>
              <View style={styles.thumb} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.xxl },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trackArea: { height: HIT, justifyContent: 'center', marginTop: space.xs },
  track: {
    height: 3, backgroundColor: colors.paper3,
    marginHorizontal: THUMB / 2,
  },
  trackActive: {
    position: 'absolute', height: 3, backgroundColor: colors.walleye,
  },
  hit: {
    position: 'absolute', width: HIT, height: HIT,
    alignItems: 'center', justifyContent: 'center',
  },
  thumb: {
    width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    backgroundColor: colors.ink,
    borderWidth: 2, borderColor: colors.paper,
  },
});
