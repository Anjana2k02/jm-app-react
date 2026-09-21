export type Op = {
  insert?: string | Record<string, unknown>;
  attributes?: Record<string, unknown>;
};
export type Doc = {
  id: string;
  user_id: string;
  title: string;
  content: Op[];
  created_at: string;
  updated_at: string;
};
export type Template = { id: string; user_id: string; name: string; created_at: string };
export type Session = {
  id: string;
  user_id: string;
  name: string;
  session_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};
export type Item = {
  user_id: string;
  document_id: string;
  sort_order: number;
  template_id?: string;
  session_id?: string;
};
export type Data = {
  documents: Doc[];
  templates: Template[];
  template_items: Item[];
  sessions: Session[];
  session_songs: Item[];
};
export const emptyData = (): Data => ({
  documents: [],
  templates: [],
  template_items: [],
  sessions: [],
  session_songs: [],
});
export function orderedIds(ids: string[], items: Item[]) {
  const existing = new Set(ids);
  return [
    ...new Set([
      ...items
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => i.document_id)
        .filter((id) => existing.has(id)),
      ...ids,
    ]),
  ];
}
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}
export const plainText = (content: Op[]) =>
  content.map((op) => (typeof op.insert === 'string' ? op.insert : '')).join('');
const chord = /^[A-G][#b]?(m|M|maj|min|aug|dim|sus|add)?[0-9]*(\/[A-G][#b]?)?$/;
export function isChordLine(line: string) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens.length >= 2 && tokens.filter((t) => chord.test(t)).length / tokens.length >= 0.5;
}
export function looksLikeChordSheet(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return lines.length > 0 && lines.filter(isChordLine).length / lines.length >= 0.15;
}
export function chordDelta(text: string): Op[] {
  let inBlock = false;
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .flatMap((line) => {
      if (!line.trim()) {
        inBlock = false;
        return [{ insert: '\n' }];
      }
      if (isChordLine(line)) inBlock = true;
      return [
        { insert: line, ...(inBlock ? { attributes: { font: 'Courier New' } } : {}) },
        { insert: '\n' },
      ];
    });
}
// Flutter uses numeric font sizes; the browser uses CSS lengths. Keep storage compatible.
export function browserDelta(ops: Op[]): Op[] {
  return ops.map((op) => {
    const a = { ...op.attributes };
    if (a.size && /^\d+(\.\d+)?$/.test(String(a.size))) a.size = `${a.size}px`;
    if (a.list === 'checked' || a.list === 'unchecked') a.list = String(a.list);
    return { ...op, ...(op.attributes ? { attributes: a } : {}) };
  });
}
export function storageDelta(ops: Op[]): Op[] {
  return ops.map((op) => {
    const a = { ...op.attributes };
    if (typeof a.size === 'string' && a.size.endsWith('px')) a.size = a.size.slice(0, -2);
    return { ...op, ...(op.attributes ? { attributes: a } : {}) };
  });
}
