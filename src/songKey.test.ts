import { describe, expect, it } from 'vitest';
import { readSongKey, withSongKey } from './songKey';
import { browserDelta, plainText } from './model';

describe('song key storage', () => {
  it('keeps the key through lyric edits without changing lyrics or formatting', () => {
    const content = [{ insert: 'Lyrics\n', attributes: { bold: true } }];
    const saved = withSongKey(content, 'F#m');
    expect(readSongKey(saved)).toBe('F#m');
    expect(plainText(saved)).toBe('Lyrics\n');
    expect(browserDelta(saved)).toEqual(content);
    const edited = withSongKey([{ insert: 'Edited lyrics\n' }], readSongKey(saved));
    expect(readSongKey(edited)).toBe('F#m');
    expect(readSongKey(withSongKey(edited, ''))).toBe('');
    expect(content).toEqual([{ insert: 'Lyrics\n', attributes: { bold: true } }]);
  });
});
