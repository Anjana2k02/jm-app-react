import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import type { Data } from './model';
import { erase, write, type Operation } from './operations';

export type LiveStatus = 'connecting' | 'live' | 'reconnecting';
export function changeOperation(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): Operation | null {
  const table = payload.table;
  if (table !== 'session_songs' && table !== 'sessions' && table !== 'documents') return null;
  if (payload.eventType !== 'DELETE') return write(table, [payload.new]);
  const row = payload.old;
  if (table === 'session_songs') {
    if (typeof row.session_id !== 'string' || typeof row.document_id !== 'string') return null;
    return erase(table, 'session_id', row.session_id, row.document_id);
  }
  return typeof row.id === 'string' ? erase(table, 'id', row.id) : null;
}

// Normal updates use the WebSocket payload directly. HTTP is only used to
// establish/recover a consistent snapshot when joining or returning to the app.
export function subscribeWorkspace(
  client: SupabaseClient,
  callbacks: {
    load: () => Promise<Data>;
    snapshot: (data: Data, buffered: Operation[]) => void;
    changes: (operations: Operation[]) => void;
    status: (status: LiveStatus) => void;
  },
) {
  let disposed = false;
  let subscribed = false;
  let syncing = false;
  let needsSnapshot = true;
  let generation = 0;
  let retryDelay = 1000;
  let buffered: Operation[] = [];
  let batch: Operation[] = [];
  let batchTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(batchTimer);
    batchTimer = undefined;
    if (batch.length) callbacks.changes(batch.splice(0));
  };
  async function refresh() {
    if (disposed || !subscribed || syncing) return;
    flush();
    clearTimeout(retryTimer);
    syncing = true;
    needsSnapshot = true;
    const version = generation;
    try {
      const snapshot = await callbacks.load();
      if (disposed || version !== generation) return;
      callbacks.snapshot(snapshot, buffered.splice(0));
      needsSnapshot = false;
      retryDelay = 1000;
      callbacks.status('live');
    } catch {
      if (disposed || version !== generation) return;
      callbacks.status('reconnecting');
      retryTimer = setTimeout(() => void refresh(), retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30000);
    } finally {
      syncing = false;
      if (!disposed && subscribed && version !== generation) void refresh();
    }
  }
  callbacks.status('connecting');
  const channel = client.channel('workspace-live', {
    config: { postgres_changes_options: { wait: true } },
  });
  for (const table of ['session_songs', 'sessions', 'documents']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      if (disposed) return;
      const operation = changeOperation(payload);
      if (!operation) {
        void refresh();
        return;
      }
      if (needsSnapshot || syncing) buffered.push(operation);
      else {
        batch.push(operation);
        // Coalesce the row events from a reorder into a single render.
        if (!batchTimer) batchTimer = setTimeout(flush, 25);
      }
    });
  }
  channel.subscribe((status) => {
    if (disposed) return;
    if (status === 'SUBSCRIBED') {
      subscribed = true;
      void refresh();
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      subscribed = false;
      needsSnapshot = true;
      generation++;
      buffered = [];
      clearTimeout(retryTimer);
      callbacks.status('reconnecting');
    }
  });
  const visible = () => {
    if (document.visibilityState === 'visible') void refresh();
  };
  const online = () => void refresh();
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('online', online);
  return () => {
    disposed = true;
    clearTimeout(batchTimer);
    clearTimeout(retryTimer);
    document.removeEventListener('visibilitychange', visible);
    window.removeEventListener('online', online);
    void client.removeChannel(channel);
  };
}
