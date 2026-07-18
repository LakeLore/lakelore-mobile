// src/ratings.ts — in-app ratings prompt (IMPROVEMENT_PLAN 2026-07-10 revenue
// item #4, batched with native build 21). Ratings are the #1 listing-
// conversion factor for a no-brand niche app; expo-store-review shows the
// native in-app rating sheet (no app-switch, no strings attached — Apple
// throttles actual display to ~3/year on its own).
//
// Our gates on top of the OS throttle:
//   - only fires after the MIN_VIEWS-th lake-detail view — an engaged user
//     deep in the core loop, never a first-run
//   - at most once per MIN_DAYS_BETWEEN, tracked locally
//   - the native module is probed via a pure-JS property read BEFORE any
//     require — expo-store-review ships with build 21+, and codegen-style
//     modules crash pre-21 binaries at require time (see the share-card
//     lesson in CLAUDE.md)
//   - every failure is swallowed: a ratings prompt must never break anything
import AsyncStorage from '@react-native-async-storage/async-storage';

const VIEWS_KEY = 'ratings.lakeViews.v1';
const ASKED_KEY = 'ratings.lastAsk.v1';
const MIN_VIEWS = 5;
const MIN_DAYS_BETWEEN = 90;

export async function noteLakeViewAndMaybeAsk(): Promise<void> {
  try {
    const views = Number((await AsyncStorage.getItem(VIEWS_KEY)) ?? '0') + 1;
    await AsyncStorage.setItem(VIEWS_KEY, String(views));
    if (views < MIN_VIEWS) return;
    const last = Number((await AsyncStorage.getItem(ASKED_KEY)) ?? '0');
    if (Date.now() - last < MIN_DAYS_BETWEEN * 86_400_000) return;
    const expoModules = (globalThis as unknown as { expo?: { modules?: Record<string, unknown> } }).expo?.modules;
    if (!expoModules?.ExpoStoreReview) return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const StoreReview = require('expo-store-review');
    if (!(await StoreReview.isAvailableAsync())) return;
    await AsyncStorage.setItem(ASKED_KEY, String(Date.now()));
    await StoreReview.requestReview();
  } catch { /* never let the ratings prompt surface an error */ }
}
