import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import { changeOperation, subscribeWorkspace } from './realtime';
import { emptyData } from './model';
import { replay } from './operations';

const event = (type: 'UPDATE' | 'DELETE', row: Record<string, unknown>) =>
  ({
    schema: 'public',
    table: 'session_songs',
    eventType: type,
    new: type === 'DELETE' ? {} : row,
    old: type === 'DELETE' ? row : {},
    commit_timestamp: '',
    errors: [],
  }) as RealtimePostgresChangesPayload<Record<string, unknown>>;

function fixture() {
  vi.useFakeTimers();
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  vi.stubGlobal('window', new EventTarget());
  let change: (payload: ReturnType<typeof event>) => void = () => {};
  let status: (value: string) => void = () => {};
  const channel = {
    on: vi.fn((_type, filter, handler) => {
      if (filter.table === 'session_songs') change = handler;
      return channel;
    }),
    subscribe: vi.fn((handler) => {
      status = handler;
      return channel;
    }),
  };
  const client = { channel: () => channel, removeChannel: vi.fn() };
  const callbacks = {
    load: vi.fn().mockResolvedValue(emptyData()),
    snapshot: vi.fn(),
    changes: vi.fn(),
    status: vi.fn(),
  };
  const cleanup = subscribeWorkspace(client as unknown as SupabaseClient, callbacks);
  return {
    callbacks,
    client,
    cleanup,
    change: (e: ReturnType<typeof event>) => change(e),
    status: (s: string) => status(s),
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('live session updates', () => {
  it('applies reorder payloads without refetching and preserves unrelated content', async () => {
    const f = fixture();
    f.status('SUBSCRIBED');
    await vi.advanceTimersByTimeAsync(0);
    f.change(event('UPDATE', { session_id: 's', document_id: 'b', sort_order: 0 }));
    f.change(event('UPDATE', { session_id: 's', document_id: 'a', sort_order: 1 }));
    await vi.advanceTimersByTimeAsync(25);
    expect(f.callbacks.changes).toHaveBeenCalledTimes(1);
    expect(f.callbacks.load).toHaveBeenCalledTimes(1);
    const data = emptyData();
    const next = replay(data, f.callbacks.changes.mock.calls[0][0]);
    expect(next.documents).toBe(data.documents);
    expect(next.session_songs.map((row) => row.document_id)).toEqual(['b', 'a']);
    f.cleanup();
  });
  it('removes only the matching song from the matching session', () => {
    const data = emptyData();
    data.session_songs = ['s', 'other'].map((session_id) => ({
      session_id,
      document_id: 'a',
      user_id: 'u',
      sort_order: 0,
    }));
    const op = changeOperation(event('DELETE', { session_id: 's', document_id: 'a' }))!;
    expect(replay(data, [op]).session_songs.map((r) => r.session_id)).toEqual(['other']);
    expect(changeOperation(event('DELETE', {}))).toBeNull();
  });
  it('buffers events during reconnect snapshots and cleans up pending timers', async () => {
    const f = fixture();
    let resolve!: (data: ReturnType<typeof emptyData>) => void;
    f.callbacks.load.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    f.status('SUBSCRIBED');
    const row = { session_id: 's', document_id: 'a', sort_order: 1 };
    f.change(event('UPDATE', row));
    resolve(emptyData());
    await vi.advanceTimersByTimeAsync(0);
    expect(f.callbacks.snapshot.mock.calls[0][1]).toEqual([changeOperation(event('UPDATE', row))]);
    f.status('CHANNEL_ERROR');
    expect(f.callbacks.status).toHaveBeenLastCalledWith('reconnecting');
    f.status('SUBSCRIBED');
    expect(f.callbacks.load).toHaveBeenCalledTimes(2);
    f.cleanup();
    resolve(emptyData());
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.callbacks.snapshot).toHaveBeenCalledTimes(1);
    expect(f.client.removeChannel).toHaveBeenCalledTimes(1);
  });
  it('retries failed recovery instead of claiming to be live', async () => {
    const f = fixture();
    f.callbacks.load.mockRejectedValueOnce(new Error('offline'));
    f.status('SUBSCRIBED');
    await vi.advanceTimersByTimeAsync(0);
    expect(f.callbacks.status).toHaveBeenLastCalledWith('reconnecting');
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.callbacks.status).toHaveBeenLastCalledWith('live');
    f.cleanup();
  });
});
