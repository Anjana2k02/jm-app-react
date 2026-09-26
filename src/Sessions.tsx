import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowDownAZ,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Maximize,
} from 'lucide-react';
import { useWorkspace } from './workspace';
import { Empty, Modal } from './components';
import { SessionSongList } from './SessionSongList';
import { RichViewer } from './Editor';
import type { Session } from './model';
import { useLiveMode } from './useLiveMode';
export function SessionForm({
  session,
  onClose,
  onSaved,
}: {
  session?: Session;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const ws = useWorkspace(),
    [name, setName] = useState(session?.name ?? ''),
    [date, setDate] = useState(session?.session_date ?? ''),
    [notes, setNotes] = useState(session?.notes ?? '');
  return (
    <Modal title={session ? 'Edit session' : 'Create session'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) {
            const row = ws.saveSession({ name, session_date: date || null, notes }, session?.id);
            onSaved(row.id);
          }
        }}
      >
        <label>
          Session name
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friday night rehearsal"
            maxLength={200}
          />
        </label>
        <label>
          Date <span className="muted">(optional)</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Notes <span className="muted">(optional)</span>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="A few things to remember…"
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={!name.trim()}>
            {session ? 'Save changes' : 'Create session'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function SessionDetail({
  session,
  onBack,
  onCreateSong,
}: {
  session: Session;
  onBack: () => void;
  onCreateSong: (title: string) => void;
}) {
  const ws = useWorkspace(),
    [collapsed, setCollapsed] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [adding, setAdding] = useState(false),
    [query, setQuery] = useState(''),
    [sort, setSort] = useState<'alpha' | 'recent'>('alpha'),
    [checked, setChecked] = useState<string[]>([]);
  const [removed, setRemoved] = useState<{
    id: string;
    index: number;
    title: string;
    selected: boolean;
  } | null>(null);
  const ids = ws.data.session_songs
    .filter((i) => i.session_id === session.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => i.document_id)
    .filter((id) => ws.data.documents.some((d) => d.id === id));
  const selectedId = selected && ids.includes(selected) ? selected : ids[0],
    index = ids.indexOf(selectedId),
    doc = ws.data.documents.find((d) => d.id === selectedId);
  const nextSong = ws.data.documents.find((d) => d.id === ids[index + 1]);
  const matchingSongs = ws.data.documents
    .filter((d) => d.title.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) =>
      sort === 'alpha'
        ? (a.title || 'Untitled').localeCompare(b.title || 'Untitled', undefined, {
            sensitivity: 'base',
          })
        : b.updated_at.localeCompare(a.updated_at),
    );
  const { root, live, toggle, gestures } = useLiveMode(Boolean(doc));
  function select(id: string) {
    setSelected(id);
    if (window.innerWidth < 760) setCollapsed(true);
  }
  function removeSong(id: string) {
    if (!ws.canManageSessionSongs) return;
    const position = ids.indexOf(id);
    const song = ws.data.documents.find((item) => item.id === id);
    if (position < 0 || !song) return;
    setRemoved({
      id,
      index: position,
      title: song.title || 'Untitled',
      selected: id === selectedId,
    });
    if (id === selectedId) setSelected(ids[position + 1] ?? ids[position - 1] ?? null);
    ws.setOrder(
      'session',
      session.id,
      ids.filter((item) => item !== id),
    );
  }
  return (
    <div ref={root} className={`session-detail ${live ? 'live-mode' : ''}`}>
      <header className="session-header">
        <button className="button ghost" onClick={onBack}>
          <ArrowLeft size={19} /> Back
        </button>
        <h1>{session.name}</h1>
        <button
          className="button secondary live-mode-button"
          onClick={toggle}
          disabled={!doc}
          aria-pressed={live}
          title="Show only the song. Double-tap the song area to toggle Live Mode; press Escape to exit."
        >
          <Maximize size={16} /> Live Mode
        </button>
      </header>
      <div className={`session-layout ${collapsed ? 'collapsed' : ''}`}>
        {!collapsed && (
          <button
            className="drawer-scrim"
            aria-label="Close song panel"
            onClick={() => setCollapsed(true)}
          />
        )}
        <aside className="song-panel">
          {collapsed ? (
            <button
              className="icon-button expand-panel"
              onClick={() => setCollapsed(false)}
              aria-label="Expand song panel"
            >
              <PanelLeftOpen size={22} />
            </button>
          ) : (
            <>
              <div className="section-heading">
                <h2>
                  Setlist <span className="count">{ids.length}</span>
                </h2>
                <button
                  className="icon-button"
                  onClick={() => setCollapsed(true)}
                  aria-label="Collapse song panel"
                >
                  <PanelLeftClose size={22} />
                </button>
              </div>
              {ws.canManageSessionSongs && (
                <button
                  className="button"
                  onClick={() => {
                    setChecked([]);
                    setQuery('');
                    setAdding(true);
                  }}
                  aria-label="Add songs"
                >
                  <Plus size={18} />
                </button>
              )}
              {ws.canManageSessionSongs && (
                <p id="session-gesture-help" className="session-gesture-help">
                  Swipe left to remove · Hold 1 sec to move
                </p>
              )}
              {removed && ws.canManageSessionSongs && (
                <div className="session-undo" role="status">
                  <span>Removed {removed.title} from this session.</span>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        !ids.includes(removed.id) &&
                        ws.data.documents.some((song) => song.id === removed.id)
                      ) {
                        const order = [...ids];
                        order.splice(Math.min(removed.index, order.length), 0, removed.id);
                        ws.setOrder('session', session.id, order);
                        if (removed.selected) setSelected(removed.id);
                      }
                      setRemoved(null);
                    }}
                  >
                    Undo
                  </button>
                </div>
              )}
              <div className="song-cards">
                {ids.length ? (
                  <SessionSongList
                    songs={ids.map((id) => ws.data.documents.find((song) => song.id === id)!)}
                    selectedId={selectedId}
                    canEdit={ws.canManageSessionSongs}
                    onSelect={select}
                    onRemove={removeSong}
                    onReorder={(order) => {
                      setSelected(selectedId ?? null);
                      ws.setOrder('session', session.id, order);
                    }}
                  />
                ) : (
                  <Empty />
                )}
              </div>
            </>
          )}
        </aside>
        <main className="song-viewer" tabIndex={-1} aria-label="Session song viewer" {...gestures}>
          <div className="song-navigation">
            {live && (
              <div className="live-next-song" aria-live="polite">
                <span>{nextSong ? 'UP NEXT' : 'SETLIST'}</span>
                <strong>{nextSong ? nextSong.title || 'Untitled' : 'Last song'}</strong>
              </div>
            )}
            <button
              className="button secondary"
              disabled={index <= 0}
              onClick={() => setSelected(ids[index - 1])}
            >
              <ArrowLeft size={18} /> Previous
            </button>
            <span>{ids.length ? `${index + 1} / ${ids.length}` : '0 songs'}</span>
            <button
              className="button secondary"
              disabled={index < 0 || index >= ids.length - 1}
              onClick={() => setSelected(ids[index + 1])}
            >
              Next <ArrowRight size={18} />
            </button>
          </div>
          {doc ? (
            <div className="song-content" key={doc.id}>
              <h1>{doc.title || 'Untitled'}</h1>
              <RichViewer doc={doc} />
            </div>
          ) : (
            <Empty>
              {ws.canManageSessionSongs && (
                <button
                  className="button"
                  onClick={() => {
                    setChecked([]);
                    setQuery('');
                    setAdding(true);
                  }}
                  aria-label="Add songs"
                >
                  <Plus size={18} />
                </button>
              )}
            </Empty>
          )}
        </main>
      </div>
      {adding && ws.canManageSessionSongs && (
        <Modal title="Add songs" onClose={() => setAdding(false)}>
          <div className="search-field">
            <Search size={18} />
            <input
              autoFocus
              aria-label="Search songs"
              placeholder="Search your songs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className="icon-button"
              aria-label={sort === 'alpha' ? 'Sorted A to Z' : 'Sorted by newest'}
              title={
                sort === 'alpha'
                  ? 'Sorted A–Z · tap for newest first'
                  : 'Sorted by newest · tap for A–Z'
              }
              onClick={() => setSort(sort === 'alpha' ? 'recent' : 'alpha')}
            >
              {sort === 'alpha' ? <ArrowDownAZ size={18} /> : <Clock size={18} />}
            </button>
            <button
              className="icon-button"
              aria-label="Create new song"
              title="Create new song and add it to this session"
              onClick={() => {
                setAdding(false);
                onCreateSong(query.trim());
              }}
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="song-picker">
            {matchingSongs.map((d) => {
              const added = ids.includes(d.id);
              return (
                <label className={`picker-row ${added ? 'muted' : ''}`} key={d.id}>
                  <input
                    type="checkbox"
                    disabled={added}
                    checked={added || checked.includes(d.id)}
                    onChange={(e) =>
                      setChecked(
                        e.target.checked ? [...checked, d.id] : checked.filter((id) => id !== d.id),
                      )
                    }
                  />
                  <span>{d.title || 'Untitled'}</span>
                  {added && <small>Added</small>}
                </label>
              );
            })}
            {!matchingSongs.length && (
              <p className="muted">No songs found. Use + to create a new song for this session.</p>
            )}
          </div>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button
              className="button"
              disabled={!checked.length}
              onClick={() => {
                ws.setOrder('session', session.id, [...ids, ...checked]);
                if (!selectedId) setSelected(checked[0]);
                setAdding(false);
              }}
            >
              Add {checked.length || ''} {checked.length === 1 ? 'song' : 'songs'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
