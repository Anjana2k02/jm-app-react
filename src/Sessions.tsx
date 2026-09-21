import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useWorkspace } from './workspace';
import { Empty, Modal, SortableList, dateLabel } from './components';
import { RichViewer } from './Editor';
import type { Session } from './model';
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
export function SessionDetail({ session, onBack }: { session: Session; onBack: () => void }) {
  const ws = useWorkspace(),
    [collapsed, setCollapsed] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [adding, setAdding] = useState(false),
    [query, setQuery] = useState(''),
    [checked, setChecked] = useState<string[]>([]);
  const ids = ws.data.session_songs
    .filter((i) => i.session_id === session.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => i.document_id)
    .filter((id) => ws.data.documents.some((d) => d.id === id));
  const selectedId = selected && ids.includes(selected) ? selected : ids[0],
    index = ids.indexOf(selectedId),
    doc = ws.data.documents.find((d) => d.id === selectedId);
  function select(id: string) {
    setSelected(id);
    if (window.innerWidth < 760) setCollapsed(true);
  }
  return (
    <div className="session-detail">
      <header className="session-header">
        <button className="button ghost" onClick={onBack}>
          <ArrowLeft size={19} /> Back
        </button>
        <h1>{session.name}</h1>
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
                <div>
                  <h2>
                    Setlist <span className="count">{ids.length}</span>
                  </h2>
                  <p className="muted">Your songs, in your order.</p>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setCollapsed(true)}
                  aria-label="Collapse song panel"
                >
                  <PanelLeftClose size={22} />
                </button>
              </div>
              <button
                className="button"
                onClick={() => {
                  setChecked([]);
                  setQuery('');
                  setAdding(true);
                }}
              >
                <Plus size={18} /> Add songs
              </button>
              <div className="song-cards">
                {ids.length ? (
                  <SortableList
                    ids={ids}
                    onReorder={(order) => ws.setOrder('session', session.id, order)}
                  >
                    {(id, i) => {
                      const song = ws.data.documents.find((d) => d.id === id)!;
                      return (
                        <div className={`song-card ${selectedId === id ? 'active' : ''}`}>
                          <button
                            className="song-select"
                            onClick={() => select(id)}
                            aria-current={selectedId === id ? 'true' : undefined}
                          >
                            <span className="song-number">{String(i + 1).padStart(2, '0')}</span>
                            <span>
                              <strong>{song.title || 'Untitled'}</strong>
                              <small>Updated {dateLabel(song.updated_at)}</small>
                            </span>
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Remove ${song.title} from session`}
                            onClick={() =>
                              ws.setOrder(
                                'session',
                                session.id,
                                ids.filter((x) => x !== id),
                              )
                            }
                          >
                            <X size={16} />
                          </button>
                        </div>
                      );
                    }}
                  </SortableList>
                ) : (
                  <Empty
                    title="Build your setlist"
                    description="Add songs from your document library to get started."
                  />
                )}
              </div>
            </>
          )}
        </aside>
        <main className="song-viewer">
          <div className="song-navigation">
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
              <span className="eyebrow">SONG {String(index + 1).padStart(2, '0')}</span>
              <h1>{doc.title || 'Untitled'}</h1>
              <RichViewer doc={doc} />
            </div>
          ) : (
            <Empty
              title="Ready when you are"
              description="Add a song to this session to open the focused viewer."
            >
              <button
                className="button"
                onClick={() => {
                  setChecked([]);
                  setQuery('');
                  setAdding(true);
                }}
              >
                <Plus size={18} /> Add songs
              </button>
            </Empty>
          )}
        </main>
      </div>
      {adding && (
        <Modal title="Add songs" onClose={() => setAdding(false)}>
          <p>Select songs from your library for this session.</p>
          <div className="search-field">
            <Search size={18} />
            <input
              autoFocus
              aria-label="Search songs"
              placeholder="Search your songs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="song-picker">
            {ws.data.documents
              .filter((d) => d.title.toLowerCase().includes(query.toLowerCase()))
              .map((d) => {
                const added = ids.includes(d.id);
                return (
                  <label className={`picker-row ${added ? 'muted' : ''}`} key={d.id}>
                    <input
                      type="checkbox"
                      disabled={added}
                      checked={added || checked.includes(d.id)}
                      onChange={(e) =>
                        setChecked(
                          e.target.checked
                            ? [...checked, d.id]
                            : checked.filter((id) => id !== d.id),
                        )
                      }
                    />
                    <span>{d.title || 'Untitled'}</span>
                    {added && <small>Added</small>}
                  </label>
                );
              })}
            {!ws.data.documents.length && (
              <p className="muted">Create a document in your library first.</p>
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
