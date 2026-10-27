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

/** What to send the server as history (2026-10-27, ASK-01). A failed ask
 *  leaves its question on screen with an error note under it; neither is
 *  history — sending the question kept two user turns in a row, which the
 *  server rejected until New chat. Drop every error note and the question it
 *  answered, then keep the newest turns within the server's limits (20
 *  messages incl. the new question, 12,000 characters, 2,000 per earlier
 *  turn — the server repairs anything else, but sending less is cheaper). */
export const ASK_HISTORY_MAX_MESSAGES = 18;
export const ASK_HISTORY_MAX_CHARS = 10_000;
export function askHistory(turns: AskTurn[]): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.error) continue;
    const next = turns[i + 1];
    if (t.role === 'user' && (!next || next.error || next.role === 'user')) continue; // unanswered question
    const content = t.content.trim();
    if (!content) continue;
    out.push({ role: t.role, content: content.length > 2000 ? `${content.slice(0, 1999)}…` : content });
  }
  // Pairs (user, assistant) from the front until within limits.
  let total = out.reduce((n, m) => n + m.content.length, 0);
  while (out.length > 0 && (out.length > ASK_HISTORY_MAX_MESSAGES || total > ASK_HISTORY_MAX_CHARS)) {
    const removed = out.splice(0, out[0].role === 'user' && out.length > 1 ? 2 : 1);
    total -= removed.reduce((n, m) => n + m.content.length, 0);
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

export function clearAskSession(state: StateKey): void {
  sessions.delete(state);
}
