// Lake markers in assistant answers (POST /api/:state/ask, 2026-09-10).
//
// The server instructs the model to write every lake it names as
// [[lake_id|Lake Name]] and returns, alongside the answer, the `lakes` rows
// those ids refer to (only ids a tool actually returned survive). The screen
// renders a marker as a tappable lake name when the id is in that list, and
// as plain text otherwise — so a marker the server dropped still reads fine.

export type AskSegment =
  | { type: 'text'; text: string }
  | { type: 'lake'; id: string; name: string };

const MARKER_RE = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

export function parseAskMarkers(answer: string): AskSegment[] {
  const out: AskSegment[] = [];
  let last = 0;
  MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKER_RE.exec(answer))) {
    if (m.index > last) out.push({ type: 'text', text: answer.slice(last, m.index) });
    out.push({ type: 'lake', id: m[1].trim(), name: m[2].trim() });
    last = m.index + m[0].length;
  }
  if (last < answer.length) out.push({ type: 'text', text: answer.slice(last) });
  return out;
}

/** Markers replaced by their lake name — what we send back as conversation history. */
export function stripAskMarkers(answer: string): string {
  return answer.replace(MARKER_RE, (_, _id: string, name: string) => name.trim());
}
