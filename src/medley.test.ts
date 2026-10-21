import { describe, expect, it } from 'vitest';
import { medleyContent, medleyPages, medleySongs } from './medley';
import type { Doc } from './model';

const original: Doc = {
  id: 'medley',
  user_id: 'local',
  title: 'Sunday medley',
  song_type: 'medley',
  created_at: '',
  updated_at: '',
  content: [{ insert: 'Original lyrics', attributes: { bold: true } }, { insert: '\n' }],
};
describe('medley song pages', () => {
  it('preserves legacy content and formatting as the first song', () => {
    const songs = medleySongs(original);
    expect(songs).toHaveLength(1);
    expect(songs[0].content).toEqual(original.content);
    expect(medleySongs({ ...original, content: medleyContent(songs) })).toEqual(songs);
  });
  it('preserves separate names, keys, images and blank pages through storage', () => {
    const songs = [
      { id: 'one', name: 'First', key: 'C', content: original.content },
      {
        id: 'two',
        name: 'Second',
        key: 'Am',
        content: [{ insert: { image: 'data:image/png;base64,test' } }, { insert: '\n' }],
      },
      { id: 'three', name: '', key: '', content: [{ insert: '\n' }] },
    ];
    const doc = { ...original, content: medleyContent(songs) };
    expect(medleySongs(doc)).toEqual(songs);
    const pages = medleyPages(doc);
    expect(pages).toHaveLength(3);
    expect(pages[1].title).toContain('Second');
    expect(pages[1].artist).toBe('Key: Am');
    expect(pages[0].content).toEqual(original.content);
    expect(pages[1].content).toEqual(songs[1].content);
  });
  it('leaves ordinary songs unchanged for export', () => {
    const song = { ...original, song_type: 'song' as const };
    expect(medleyPages(song)).toEqual([song]);
  });
});
