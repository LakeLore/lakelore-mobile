import { parseAskMarkers, stripAskMarkers } from '../askMarkers';

describe('askMarkers', () => {
  it('splits text around lake markers', () => {
    const segs = parseAskMarkers('Try [[18037900|White Sand]] first, then [[18009302|Rabbit (West Portion)]].');
    expect(segs).toEqual([
      { type: 'text', text: 'Try ' },
      { type: 'lake', id: '18037900', name: 'White Sand' },
      { type: 'text', text: ' first, then ' },
      { type: 'lake', id: '18009302', name: 'Rabbit (West Portion)' },
      { type: 'text', text: '.' },
    ]);
  });

  it('passes plain text through untouched', () => {
    expect(parseAskMarkers('No lakes matched.')).toEqual([{ type: 'text', text: 'No lakes matched.' }]);
    expect(parseAskMarkers('')).toEqual([]);
  });

  it('strips markers to names for history', () => {
    expect(stripAskMarkers('Go to [[1| Round ]] on Saturday.')).toBe('Go to Round on Saturday.');
  });

  it('is safe to call repeatedly (global regex state)', () => {
    parseAskMarkers('[[a|A]]');
    expect(parseAskMarkers('[[b|B]]')).toEqual([{ type: 'lake', id: 'b', name: 'B' }]);
  });
});
