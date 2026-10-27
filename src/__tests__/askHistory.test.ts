// Ask LakeLore history sent to the server (2026-10-27, ASK-01): a failed ask
// must not leave its question in the history (the server used to reject two
// user turns in a row until New chat), and long chats stay within limits.
import { askHistory, AskTurn, ASK_HISTORY_MAX_MESSAGES, ASK_HISTORY_MAX_CHARS } from '../askSession';

const u = (content: string): AskTurn => ({ role: 'user', content });
const a = (content: string): AskTurn => ({ role: 'assistant', content });
const err = (content: string): AskTurn => ({ role: 'assistant', content, error: true });

describe('askHistory', () => {
  it('drops a failed question together with its error note', () => {
    const h = askHistory([u('walleye?'), a('Try Mille Lacs.'), u('bass?'), err('The assistant took too long')]);
    expect(h).toEqual([{ role: 'user', content: 'walleye?' }, { role: 'assistant', content: 'Try Mille Lacs.' }]);
  });

  it('never sends two user turns in a row', () => {
    const h = askHistory([u('a'), err('x'), u('b'), err('y'), u('c'), a('answer c')]);
    expect(h).toEqual([{ role: 'user', content: 'c' }, { role: 'assistant', content: 'answer c' }]);
    for (let i = 1; i < h.length; i++) expect(h[i].role).not.toBe(h[i - 1].role);
  });

  it('starts with a user turn and alternates', () => {
    const h = askHistory([err('offline'), u('q1'), a('a1'), u('q2'), a('a2')]);
    expect(h.map(m => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
  });

  it('keeps the newest turns within the message limit', () => {
    const turns: AskTurn[] = [];
    for (let i = 0; i < 15; i++) turns.push(u(`q${i}`), a(`a${i}`));
    const h = askHistory(turns);
    expect(h.length).toBeLessThanOrEqual(ASK_HISTORY_MAX_MESSAGES);
    expect(h[0]).toEqual({ role: 'user', content: `q${15 - h.length / 2}` });
    expect(h[h.length - 1]).toEqual({ role: 'assistant', content: 'a14' });
  });

  it('shortens long answers and keeps the total within the character limit', () => {
    const turns: AskTurn[] = [];
    for (let i = 0; i < 8; i++) turns.push(u(`q${i}`), a('x'.repeat(2600)));
    const h = askHistory(turns);
    expect(h.every(m => m.content.length <= 2000)).toBe(true);
    expect(h.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(ASK_HISTORY_MAX_CHARS);
    expect(h[0].role).toBe('user');
    expect(h[h.length - 1].role).toBe('assistant');
  });

  it('treats an empty answer like a failed one', () => {
    expect(askHistory([u('q1'), a(''), u('q2'), a('a2')])).toEqual([{ role: 'user', content: 'q2' }, { role: 'assistant', content: 'a2' }]);
    expect(askHistory([u('q1'), a('  ')])).toEqual([]);
  });

  it('never cuts an emoji in half when shortening', () => {
    const h = askHistory([u('q'), a('x'.repeat(1998) + '🎣' + 'y'.repeat(50))]);
    const last = h[1].content;
    expect(last.length).toBeLessThanOrEqual(2000);
    const code = last.charCodeAt(last.length - 2);
    expect(code >= 0xd800 && code <= 0xdbff).toBe(false); // char before the ellipsis is not a lone high surrogate
  });

  it('is empty for a brand-new chat', () => {
    expect(askHistory([])).toEqual([]);
  });
});
