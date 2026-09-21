import type { Data } from './model';
export type Operation =
  | { action: 'upsert'; table: keyof Data; rows: Record<string, unknown>[] }
  | { action: 'remove'; table: keyof Data; column: string; id: string; documentId?: string };
export type Job = { key: string; operations: Operation[] };
export const write = (table: keyof Data, rows: Record<string, unknown>[]): Operation => ({
  action: 'upsert',
  table,
  rows,
});
export const erase = (
  table: keyof Data,
  column: string,
  id: string,
  documentId?: string,
): Operation => ({ action: 'remove', table, column, id, documentId });
export function replay(data: Data, operations: Operation[]): Data {
  let next = structuredClone(data);
  for (const op of operations) {
    const rows = next[op.table] as unknown as Record<string, unknown>[];
    if (op.action === 'upsert') {
      const key = (row: Record<string, unknown>) =>
        String(row.id ?? `${row.template_id ?? row.session_id}:${row.document_id}`);
      const map = new Map(rows.map((row) => [key(row), row]));
      op.rows.forEach((row) => map.set(key(row), row));
      next = { ...next, [op.table]: [...map.values()] };
    } else {
      next = {
        ...next,
        [op.table]: rows.filter(
          (row) =>
            !(row[op.column] === op.id && (!op.documentId || row.document_id === op.documentId)),
        ),
      };
      if (op.table === 'documents') {
        next.template_items = next.template_items.filter((i) => i.document_id !== op.id);
        next.session_songs = next.session_songs.filter((i) => i.document_id !== op.id);
      }
      if (op.table === 'sessions')
        next.session_songs = next.session_songs.filter((i) => i.session_id !== op.id);
      if (op.table === 'templates')
        next.template_items = next.template_items.filter((i) => i.template_id !== op.id);
    }
  }
  return next;
}
