// In-memory per-state chat sessions for Ask LakeLore (2026-09-14, owner
// request: leaving the chat for the data view and coming back must keep the
// conversation). Mirrors SearchScreen's sessionCache — survives navigation,
// not app restarts. Keyed by state: each state's assistant only knows its
// own manifest, so histories never cross states.
import type { StateKey } from './types';
import type { AskLake } from './api';

export interface AskTurn {
  role: 'user' | 'assistant';
  /** Plain text — what goes back to the server as history. */
  content: string;
  /** Assistant only: the answer with [[id|Name]] markers, for rendering. */
  display?: string;
  lakes?: AskLake[];
  /** Local error note (network, quota) — never sent back as history. */
  error?: boolean;
}

const sessions = new Map<StateKey, AskTurn[]>();

export function getAskSession(state: StateKey): AskTurn[] {
  return sessions.get(state) ?? [];
}

/** Write-through: called BEFORE setState so an answer landing after the
 *  screen unmounted (user switched views mid-request) is still kept. */
export function saveAskSession(state: StateKey, turns: AskTurn[]): void {
  sessions.set(state, turns);
}

export function clearAskSession(state: StateKey): void {
  sessions.delete(state);
}
