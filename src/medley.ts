import type { Doc, Op } from './model';
import { readSongKey } from './songKey';

export type MedleySong = { id: string; name: string; key: string; content: Op[] };

// Store page boundaries alongside the existing JSON delta, without new database columns.
export function medleySongs(doc: Pick<Doc, 'title' | 'content'>): MedleySong[] {
  const songs: MedleySong[] = [];
  let current: MedleySong = { id: 'first', name: doc.title, key: '', content: [] };
  for (const op of doc.content) {
    const marker = typeof op.insert === 'object' && op.insert?.medleySong;
    if (
      marker &&
      typeof marker === 'object' &&
      'id' in marker &&
      'name' in marker &&
      'key' in marker &&
      typeof marker.id === 'string' &&
      typeof marker.name === 'string' &&
      typeof marker.key === 'string'
    ) {
      if (current.content.length || songs.length) songs.push(current);
      current = { id: marker.id, name: marker.name, key: marker.key, content: [] };
    } else current.content.push(op);
  }
  songs.push(current);
  return songs.map((song) => ({
    ...song,
    content: song.content.length ? song.content : [{ insert: '\n' }],
  }));
}

export function medleyContent(songs: MedleySong[]): Op[] {
  return songs.flatMap(({ id, name, key, content }) => [
    { insert: { medleySong: { id, name, key } } },
    ...(content.length ? content : [{ insert: '\n' }]),
  ]);
}

export function medleyPages(doc: Doc): Doc[] {
  if (doc.song_type !== 'medley') {
    const key = readSongKey(doc.content);
    return key
      ? [{ ...doc, artist: [`Key: ${key}`, doc.artist].filter(Boolean).join(' · ') }]
      : [doc];
  }
  return medleySongs(doc).map((song, index) => ({
    ...doc,
    id: `${doc.id}/${song.id}`,
    song_type: 'song',
    title: `${doc.title} — ${index + 1}. ${song.name || 'Untitled song'}`,
    artist: [song.key ? `Key: ${song.key}` : '', doc.artist].filter(Boolean).join(' · '),
    content: song.content,
  }));
}
