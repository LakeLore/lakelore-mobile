import { useLayoutEffect } from 'react';
import { useSharedValue, runOnJS, type SharedValue } from 'react-native-reanimated';

/**
 * Shared plumbing for the "worklet transform during gesture, one setState
 * commit on gesture end" pan/zoom pattern used by CountyMapPicker and
 * ScatterPlot.
 *
 * The hook owns the UI-thread state only: a `live` rect that gesture worklets
 * mutate every frame, a `committed` mirror of the React-rendered rect (the
 * animated transform is derived from live vs committed), active flags for the
 * pan/pinch pair, and the commit protocol (commit fires once, when the last
 * of the two gestures finalizes and something actually changed).
 *
 * Domain math (clamps, focal-point pivots, y-inversion) stays in each
 * component's gesture worklets — the two screens' math is different enough
 * that sharing it would obscure it.
 */
export interface SvgPanZoom<T extends object> {
  live: SharedValue<T>;
  committed: SharedValue<T>;
  panActive: SharedValue<boolean>;
  pinchActive: SharedValue<boolean>;
  dirty: SharedValue<boolean>;
  /** Worklet. Call from pan/pinch onFinalize after clearing the active flag. */
  maybeCommit: () => void;
  /** JS. Snap live + committed to a rect without going through a gesture. */
  syncTo: (v: T) => void;
}

export function useSvgPanZoom<T extends object>(
  initial: T,
  onCommit: (v: T) => void,
): SvgPanZoom<T> {
  const live = useSharedValue<T>(initial);
  const committed = useSharedValue<T>(initial);
  const panActive = useSharedValue(false);
  const pinchActive = useSharedValue(false);
  const dirty = useSharedValue(false);

  const maybeCommit = () => {
    'worklet';
    if (panActive.value || pinchActive.value || !dirty.value) return;
    dirty.value = false;
    runOnJS(onCommit)(live.value);
  };

  const syncTo = (v: T) => {
    live.value = v;
    committed.value = v;
    dirty.value = false;
  };

  return { live, committed, panActive, pinchActive, dirty, maybeCommit, syncTo };
}

/**
 * Dev-only guard against silent workletization failure: if the babel worklets
 * plugin isn't active, RNGH runs gesture callbacks on the JS thread with only
 * a console warning — the exact per-frame-setState problem this pattern
 * exists to fix would come back invisibly. Call from a gesture onStart.
 */
export function assertWorklet(where: string) {
  'worklet';
  if (__DEV__ && !(global as { _WORKLET?: boolean })._WORKLET) {
    console.warn(
      `[useSvgPanZoom] ${where}: gesture callback is NOT running as a worklet — ` +
      'check that react-native-worklets babel wiring is active.',
    );
  }
}

/**
 * Keep the committed mirror in sync with the React-rendered rect.
 * useLayoutEffect (not useEffect) so the transform-reset shared-value write
 * is queued as close as possible to the commit that re-renders the SVG at
 * the new rect — minimizes the one-frame window where fresh content shows
 * under the stale gesture transform.
 */
export function useCommittedMirror<T extends object>(sv: SharedValue<T>, value: T) {
  useLayoutEffect(() => {
    sv.value = value;
  }, [sv, value]);
}
