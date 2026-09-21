import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  emptyData,
  orderedIds,
  type Data,
  type Doc,
  type Item,
  type Op,
  type Session,
} from './model';
import { loadData, localKey, remove, supabase, upsert, errorMessage } from './backend';
import { write, erase, replay, type Job } from './operations';
function useWorkspaceState(userId: string) {
  const [data, setData] = useState<Data>(emptyData),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [pending, setPending] = useState(0),
    [ready, setReady] = useState(false);
  const current = useRef(data),
    queue = useRef<Job[]>([]),
    running = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout>>(undefined),
    alive = useRef(true);
  const cacheKey = supabase ? `jammer-draft-${userId}` : localKey;
  const update = (next: Data) => {
    current.current = next;
    setData(next);
  };
  function persist() {
    if (supabase) {
      if (queue.current.length) localStorage.setItem(cacheKey, JSON.stringify(queue.current));
      else localStorage.removeItem(cacheKey);
    } else localStorage.setItem(localKey, JSON.stringify(current.current));
  }
  async function drain() {
    if (running.current) return false;
    if (!queue.current.length) return true;
    running.current = true;
    try {
      persist();
      while (queue.current.length) {
        const job = queue.current[0];
        for (const op of job.operations) {
          if (op.action === 'upsert') await upsert(op.table, op.rows);
          else await remove(op.table, op.column, op.id, op.documentId);
        }
        if (queue.current[0] === job) queue.current.shift();
        persist();
        if (alive.current) setPending(queue.current.length);
      }
      if (alive.current) {
        setError('');
        setPending(0);
      }
      return true;
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
      return false;
    } finally {
      running.current = false;
    }
  }
  function commit(next: Data, job: Job) {
    update(next);
    // Never replace the in-flight request; coalesce later edits to the same document.
    const start = running.current ? 1 : 0;
    const index = queue.current.findIndex((j, i) => i >= start && j.key === job.key);
    if (index >= 0) queue.current[index] = job;
    else queue.current.push(job);
    setPending(queue.current.length);
    try {
      persist();
    } catch {
      setError(
        'Browser storage is full. Keep this page open and retry saving or use smaller images.',
      );
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void drain(), 500);
  }
  async function load() {
    setLoading(true);
    setError('');
    try {
      let loaded = await loadData();
      if (supabase) {
        const saved = localStorage.getItem(cacheKey);
        if (saved) {
          const jobs: Job[] = JSON.parse(saved);
          if (!Array.isArray(jobs) || jobs.some((j) => !Array.isArray(j.operations)))
            throw new Error(
              'Unsynced changes could not be read. Back up your browser storage before continuing.',
            );
          queue.current = jobs;
          loaded = replay(
            loaded,
            jobs.flatMap((j) => j.operations),
          );
          setPending(jobs.length);
        }
      }
      update(loaded);
      setReady(true);
      if (queue.current.length) void drain();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
      void drain();
    };
  }, [userId]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (queue.current.length) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);
  const stamp = () => new Date().toISOString();
  function createDocument(title: string) {
    const doc: Doc = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: title.trim(),
      content: [{ insert: '\n' }],
      created_at: stamp(),
      updated_at: stamp(),
    };
    commit(
      { ...current.current, documents: [...current.current.documents, doc] },
      { key: `doc-${doc.id}`, operations: [write('documents', [doc])] },
    );
    return doc;
  }
  function saveDocument(id: string, changes: { title?: string; content?: Op[] }) {
    const prev = current.current.documents.find((d) => d.id === id);
    if (!prev) return;
    const doc = { ...prev, ...changes, updated_at: stamp() };
    commit(
      {
        ...current.current,
        documents: current.current.documents.map((d) => (d.id === id ? doc : d)),
      },
      { key: `doc-${id}`, operations: [write('documents', [doc])] },
    );
  }
  function deleteDocument(id: string) {
    const d = current.current;
    commit(
      {
        ...d,
        documents: d.documents.filter((x) => x.id !== id),
        template_items: d.template_items.filter((x) => x.document_id !== id),
        session_songs: d.session_songs.filter((x) => x.document_id !== id),
      },
      { key: `delete-doc-${id}`, operations: [erase('documents', 'id', id)] },
    );
  }
  function createTemplate(name: string) {
    const template = {
      id: crypto.randomUUID(),
      user_id: userId,
      name: name.trim(),
      created_at: stamp(),
    };
    const items = current.current.documents.map((d, i) => ({
      template_id: template.id,
      document_id: d.id,
      user_id: userId,
      sort_order: i,
    }));
    commit(
      {
        ...current.current,
        templates: [...current.current.templates, template],
        template_items: [...current.current.template_items, ...items],
      },
      {
        key: `template-${template.id}`,
        operations: [write('templates', [template]), write('template_items', items)],
      },
    );
    return template;
  }
  function saveTemplate(id: string, name: string) {
    const template = current.current.templates.find((t) => t.id === id);
    if (!template) return;
    const row = { ...template, name: name.trim() };
    commit(
      {
        ...current.current,
        templates: current.current.templates.map((t) => (t.id === id ? row : t)),
      },
      { key: `rename-template-${id}`, operations: [write('templates', [row])] },
    );
  }
  function deleteTemplate(id: string) {
    const d = current.current;
    commit(
      {
        ...d,
        templates: d.templates.filter((t) => t.id !== id),
        template_items: d.template_items.filter((i) => i.template_id !== id),
      },
      { key: `delete-template-${id}`, operations: [erase('templates', 'id', id)] },
    );
  }
  function saveSession(values: Pick<Session, 'name' | 'notes' | 'session_date'>, id?: string) {
    const prev = current.current.sessions.find((s) => s.id === id);
    const row: Session = {
      id: id ?? crypto.randomUUID(),
      user_id: userId,
      created_at: prev?.created_at ?? stamp(),
      updated_at: stamp(),
      ...values,
      name: values.name.trim(),
    };
    commit(
      {
        ...current.current,
        sessions: prev
          ? current.current.sessions.map((s) => (s.id === id ? row : s))
          : [...current.current.sessions, row],
      },
      { key: `session-${row.id}`, operations: [write('sessions', [row])] },
    );
    return row;
  }
  function deleteSession(id: string) {
    const d = current.current;
    commit(
      {
        ...d,
        sessions: d.sessions.filter((s) => s.id !== id),
        session_songs: d.session_songs.filter((i) => i.session_id !== id),
      },
      { key: `delete-session-${id}`, operations: [erase('sessions', 'id', id)] },
    );
  }
  function setOrder(kind: 'template' | 'session', id: string, ids: string[]) {
    const table = kind === 'template' ? 'template_items' : 'session_songs',
      column = kind === 'template' ? 'template_id' : 'session_id';
    const rows: Item[] = [...new Set(ids)].map((document_id, sort_order) => ({
      [column]: id,
      document_id,
      sort_order,
      user_id: userId,
    }));
    const removed = current.current[table].filter(
      (i) => i[column] === id && !ids.includes(i.document_id),
    );
    commit(
      {
        ...current.current,
        [table]: [...current.current[table].filter((i) => i[column] !== id), ...rows],
      },
      {
        key: `order-${kind}-${id}-${crypto.randomUUID()}`,
        operations: [
          write(table, rows),
          ...removed.map((item) => erase(table, column, id, item.document_id)),
        ],
      },
    );
  }
  function templateDocuments(id: string) {
    const d = current.current;
    return orderedIds(
      d.documents.map((x) => x.id),
      d.template_items.filter((i) => i.template_id === id),
    ).map((id) => d.documents.find((x) => x.id === id)!);
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(current.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jammer-docs-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return {
    data,
    loading,
    ready,
    error,
    pending,
    userId,
    load,
    retry: drain,
    createDocument,
    saveDocument,
    deleteDocument,
    createTemplate,
    saveTemplate,
    deleteTemplate,
    templateDocuments,
    saveSession,
    deleteSession,
    setOrder,
    exportData,
  };
}
const Context = createContext<ReturnType<typeof useWorkspaceState> | null>(null);
export function WorkspaceProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const value = useWorkspaceState(userId);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('Workspace is missing');
  return value;
}
