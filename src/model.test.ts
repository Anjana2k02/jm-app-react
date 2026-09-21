import { describe, it, expect } from 'vitest';
import {
  isChordLine,
  looksLikeChordSheet,
  chordDelta,
  orderedIds,
  moveItem,
  browserDelta,
  storageDelta,
} from './model';
describe('Flutter-compatible chord formatting', () => {
  it('detects chord lines without interpreting a single lyric letter as a chord', () => {
    expect(isChordLine('C     G/B    Am7    F')).toBe(true);
    expect(isChordLine('A beautiful day')).toBe(false);
    expect(isChordLine('A')).toBe(false);
    expect(looksLikeChordSheet('C  G\nA beautiful day')).toBe(true);
  });
  it('preserves whitespace and resets monospace at blank lines', () => {
    expect(chordDelta('C    G\r\nSing    along\r\n\r\nVerse two')).toEqual([
      { insert: 'C    G', attributes: { font: 'Courier New' } },
      { insert: '\n' },
      { insert: 'Sing    along', attributes: { font: 'Courier New' } },
      { insert: '\n' },
      { insert: '\n' },
      { insert: 'Verse two' },
      { insert: '\n' },
    ]);
  });
  it('roundtrips Flutter font size, font and embeds', () => {
    const ops = [
      { insert: 'Chords', attributes: { size: '24', font: 'Courier New', bold: true } },
      { insert: { image: 'https://example.com/image.png' } },
      { insert: '\n' },
    ];
    expect(storageDelta(browserDelta(ops))).toEqual(ops);
  });
});
describe('setlist and template ordering', () => {
  it('removes stale and duplicate links and appends new documents', () => {
    expect(
      orderedIds(
        ['a', 'b', 'c'],
        [
          { document_id: 'b', sort_order: 0, user_id: 'u' },
          { document_id: 'gone', sort_order: 1, user_id: 'u' },
          { document_id: 'b', sort_order: 2, user_id: 'u' },
        ],
      ),
    ).toEqual(['b', 'a', 'c']);
  });
  it('reorders without mutating and stops at list boundaries', () => {
    const ids = ['a', 'b', 'c'];
    expect(moveItem(ids, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(ids).toEqual(['a', 'b', 'c']);
    expect(moveItem(ids, 0, -1)).toEqual(ids);
    expect(moveItem(ids, 2, 3)).toEqual(ids);
  });
});
