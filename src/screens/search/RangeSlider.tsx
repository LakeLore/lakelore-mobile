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
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
  const grabLoRef = useRef(0);
  const grabHiRef = useRef(0);
  const onDraggingRef = useRef(onDragging); onDraggingRef.current = onDragging;

  const usable = () => Math.max(widthRef.current - THUMB, 1);
  const toX = (v: number) => ((v - min) / (max - min)) * usable();
  const fromX = (x: number) => min + (x / usable()) * (max - min);
  const snap = (v: number) => clamp(Math.round(v / step) * step, min, max);

  // PanResponder proved unwinnable here (2026-09-14 round 2): JS responders
  // can refuse JS-side termination requests, but the ScrollView's NATIVE pan
  // recognizer cancels them unilaterally on iOS — drags kept dying partway.
  // react-native-gesture-handler (already in the binary) resolves the contest
  // at the native layer: a thumb pan ACTIVATES on ~any horizontal movement
  // and, once active, natively blocks the scroll; a clearly vertical drag
  // fails the pan so the sheet still scrolls when that's the intent.
  const panLo = Gesture.Pan()
    .activeOffsetX([-2, 2])
    .failOffsetY([-16, 16])
    .runOnJS(true)
    .onStart(() => { grabLoRef.current = loRef.current; onDraggingRef.current?.(true); })
    .onUpdate(e => {
      const v = snap(clamp(fromX(toX(grabLoRef.current) + e.translationX), min, Math.max(min, hiRef.current - step)));
      onMinChange(v <= min ? '' : fmtNum(v));
    })
    .onFinalize(() => { onDraggingRef.current?.(false); });

  const panHi = Gesture.Pan()
    .activeOffsetX([-2, 2])
    .failOffsetY([-16, 16])
    .runOnJS(true)
    .onStart(() => { grabHiRef.current = hiRef.current; onDraggingRef.current?.(true); })
    .onUpdate(e => {
      const v = snap(clamp(fromX(toX(grabHiRef.current) + e.translationX), Math.min(max, loRef.current + step), max));
      onMaxChange(v >= max ? '' : fmtNum(v));
    })
    .onFinalize(() => { onDraggingRef.current?.(false); });

  // VoiceOver path (2026-09-15): the pan gesture is not operable under a
  // screen reader, and the old text inputs are gone — each thumb is an
  // 'adjustable' element whose increment/decrement swipe moves it one step,
  // with the same clamps and the same ''-at-the-end contract as dragging.
  const bump = (which: 'lo' | 'hi', dir: 1 | -1) => {
    if (which === 'lo') {
      const v = clamp(loRef.current + dir * step, min, Math.max(min, hiRef.current - step));
      onMinChange(v <= min ? '' : fmtNum(v));
    } else {
      const v = clamp(hiRef.current + dir * step, Math.min(max, loRef.current + step), max);
      onMaxChange(v >= max ? '' : fmtNum(v));
    }
  };
  const a11yThumb = (which: 'lo' | 'hi', valueText: string) => ({
    accessible: true,
    accessibilityRole: 'adjustable' as const,
    accessibilityLabel: `${label} ${which === 'lo' ? 'minimum' : 'maximum'}`,
    accessibilityValue: { text: valueText },
    accessibilityActions: [{ name: 'increment' as const }, { name: 'decrement' as const }],
    onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) =>
      bump(which, e.nativeEvent.actionName === 'increment' ? 1 : -1),
  });

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
        onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        <View style={styles.track} />
        {width > 0 && (
          <>
            <View style={[styles.trackActive, { left: xLo + THUMB / 2, width: Math.max(xHi - xLo, 0) }]} />
            <GestureDetector gesture={panLo}>
              <View {...a11yThumb('lo', loLabel)} style={[styles.hit, { left: xLo - (HIT - THUMB) / 2 }]}>
                <View style={styles.thumb} />
              </View>
            </GestureDetector>
            <GestureDetector gesture={panHi}>
              <View {...a11yThumb('hi', hiLabel)} style={[styles.hit, { left: xHi - (HIT - THUMB) / 2 }]}>
                <View style={styles.thumb} />
              </View>
            </GestureDetector>
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
