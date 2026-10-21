import type { Op } from './model';

export function readSongKey(content: Op[]): string {
  const value = content.find((op) => typeof op.attributes?.songKey === 'string')?.attributes
    ?.songKey;
  return typeof value === 'string' ? value : '';
}

// Keep metadata in the existing JSON content column, so cloud saves need no schema change.
export function withSongKey(content: Op[], key: string): Op[] {
  const ops = content.map((op) => {
    if (!op.attributes || !('songKey' in op.attributes)) return op;
    const { songKey: _, ...attributes } = op.attributes;
    return { ...op, attributes };
  });
  if (!key) return ops;
  if (
    !ops.length ||
    typeof ops.at(-1)?.insert !== 'string' ||
    !(ops.at(-1)!.insert as string).endsWith('\n')
  )
    ops.push({ insert: '\n' });
  const last = ops.length - 1;
  ops[last] = { ...ops[last], attributes: { ...ops[last].attributes, songKey: key } };
  return ops;
}
