import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StateKey } from './types';
import { STATE_KEYS, GENERATED_STATES } from './generated/states';
import { KEYS } from './storage';

// Which states this app offers.
//
// BAKED: every registry state flagged active when this bundle was generated
// (src/generated/states.ts, from lakelore-data/registry/states.json). The
// server derives its own list from the same registry.
//
// SERVED (2026-10-08): the list the server says it is serving right now
// (GET /api/client-config → states.active), cached on disk. The effective
// list is BAKED ∩ SERVED, so a state pulled server-side (licensing hold)
// disappears from the pickers of every installed 1.1.2+ app, and comes back
// if it is restored — no store release, and no permanent "Server error (400)"
// on a state the binary still lists. The server can only narrow the baked
// list: a state this bundle baked as inactive stays inactive (its copy,
// counts and store listing ship with a release). Until a served list has
// been seen, the baked list stands.
//
// To pull or add a state: flip the registry active flag, regenerate
// src/generated/states.ts, and run the serving-contract reachability check in
// SUBMIT_RUNBOOK §0.0b BEFORE deploying the server side.
const BAKED_ACTIVE: readonly StateKey[] = STATE_KEYS.filter(k => GENERATED_STATES[k].active);

let _served: ReadonlySet<string> | null = null;
let _effective: readonly StateKey[] = BAKED_ACTIVE;
const _listeners = new Set<() => void>();

function recompute(): void {
  const next = _served ? BAKED_ACTIVE.filter(k => _served!.has(k)) : BAKED_ACTIVE;
  if (next.length === _effective.length && next.every((k, i) => k === _effective[i])) return;
  _effective = next;
  _listeners.forEach(fn => fn());
}

/** Accept a served list only if it is a plausible one: an array of state
 *  codes that keeps the free tier and at least one other baked state. A
 *  malformed or empty answer must never blank the app. */
function validServed(list: unknown): string[] | null {
  if (!Array.isArray(list)) return null;
  const codes = list.filter((s): s is string => typeof s === 'string' && /^[a-z]{2}$/.test(s));
  const kept = BAKED_ACTIVE.filter(k => codes.includes(k));
  if (kept.length < 2 || !FREE_STATES.every(f => codes.includes(f))) return null;
  return codes;
}

/** Apply the list from /api/client-config and persist it for the next launch. */
export function applyServedStates(list: unknown): void {
  const codes = validServed(list);
  if (!codes) return;
  _served = new Set(codes);
  recompute();
  AsyncStorage.setItem(KEYS.servedStates, JSON.stringify({ active: codes, ts: Date.now() })).catch(() => {});
}

let _hydrating: Promise<void> | null = null;
/** Load the last served list from disk (once). Bounded so a never-settling
 *  native read can't hold up launch. */
export function hydrateServedStates(): Promise<void> {
  if (!_hydrating) {
    _hydrating = Promise.race([
      AsyncStorage.getItem(KEYS.servedStates),
      new Promise<string | null>(resolve => setTimeout(() => resolve(null), 1500)),
    ]).then(raw => {
      if (!raw || _served) return; // a live answer already landed
      const codes = validServed(JSON.parse(raw)?.active);
      if (codes) { _served = new Set(codes); recompute(); }
    }).catch(() => {});
  }
  return _hydrating;
}

export const getActiveStates = (): readonly StateKey[] => _effective;

export const isActiveState = (s: StateKey): boolean => _effective.includes(s);

const subscribe = (fn: () => void) => { _listeners.add(fn); return () => { _listeners.delete(fn); }; };

/** The effective active list; re-renders when the served list changes it. */
export function useActiveStates(): readonly StateKey[] {
  return useSyncExternalStore(subscribe, getActiveStates, getActiveStates);
}

// Free tier. Paid states are browsable by everyone in PREVIEW mode (search,
// filters, scatter, all metrics visible, lake detail included) — the server
// redacts lake identity (name, county, acres, coords, links; hashed ids)
// from both /results and /lake/:id, and the app renders redacted lake detail
// with an unlock banner; only /pdf hard-402s (2026-07-15 shape). Mirrors
// FREE_STATES in lake-fish-mobile-server/entitlement.js.
export const FREE_STATES: readonly StateKey[] = ['mn'] as const;

export const isFreeState = (s: StateKey): boolean =>
  (FREE_STATES as readonly StateKey[]).includes(s);

/** Test seam. */
export function _resetServedStatesForTests(): void {
  _served = null; _hydrating = null; recompute();
}
