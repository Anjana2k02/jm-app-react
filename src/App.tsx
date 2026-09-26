import { useEffect, useState, type FormEvent } from 'react';
import {
  Home,
  ListMusic,
  CalendarDays,
  Layers,
  Search,
  Settings,
  Music2,
  Plus,
  ArrowUpRight,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Pencil,
  Trash2,
  Download,
  Sun,
  Moon,
  Monitor,
  Eye,
  EyeOff,
  Crown,
  MoreVertical,
  FileDown,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase, configError, localMode, errorMessage, fetchUserRole } from './backend';
import { exportSessionPdf } from './pdf';
import { WorkspaceProvider, useWorkspace } from './workspace';
import {
  Empty,
  Modal,
  SortableList,
  dateLabel,
  SONG_TYPES,
  songTypeMeta,
  TypeIcon,
  Snackbar,
} from './components';
import { Editor } from './Editor';
import { SessionDetail, SessionForm } from './Sessions';
import { plainText, type Doc, type Session, type SongType } from './model';
import { ConnectionStatus } from './ConnectionStatus';
import { InstallApp, useAppInstallation } from './InstallApp';
type Route = { page: string; id?: string };
function readRoute(): Route {
  const [page, id] = location.hash.slice(1).split('/');
  return { page: page || 'home', id };
}
function navigate(page: string, id?: string) {
  location.hash = `${page}${id ? `/${id}` : ''}`;
}
export default function App() {
  const installation = useAppInstallation();
  const [user, setUser] = useState<User | null>(null),
    [role, setRole] = useState<string | null>(null),
    [loading, setLoading] = useState(Boolean(supabase)),
    [authError, setAuthError] = useState('');
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active) {
          setUser(data.session?.user ?? null);
          setAuthError(error?.message ?? '');
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setAuthError(String(e));
          setLoading(false);
        }
      });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!user) {
      setRole(null);
      return;
    }
    let active = true;
    void fetchUserRole(user.id).then((r) => {
      if (active) setRole(r);
    });
    return () => {
      active = false;
    };
  }, [user?.id]);
  useEffect(() => {
    if (user)
      console.log(
        '[auth] signed in:',
        user.email,
        '| user_profiles role:',
        role ?? '(none)',
        '| app_metadata role:',
        user.app_metadata?.role ?? '(none)',
      );
  }, [user, role]);
  const isAdmin = role === 'admin' || user?.app_metadata?.role === 'admin';
  if (configError)
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Logo />
          <h1>Connect your workspace</h1>
          <p role="alert">{configError}</p>
          <p>
            Use the same Supabase project as your Flutter app. React reads SUPABASE_URL and
            SUPABASE_ANON_KEY from the root .env, or VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
            from react-app/.env. A public publishable key is also supported.
          </p>
          <p>
            Your existing local documents remain on this device. Cloud sync starts after
            configuration and sign-in.
          </p>
          <button className="button" onClick={() => location.reload()}>
            Reload configuration
          </button>
        </div>
      </div>
    );
  if (loading) return <div className="loading">Opening your workspace…</div>;
  if (supabase && !user) return <Auth initialError={authError} />;
  return (
    <WorkspaceProvider
      key={user?.id ?? 'local'}
      userId={user?.id ?? 'local'}
      canManageSessionSongs={localMode || isAdmin}
    >
      <Workspace
        email={user?.email ?? 'Local workspace'}
        installation={installation}
        isAdmin={isAdmin}
      />
    </WorkspaceProvider>
  );
}
function Logo() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <img src={`${import.meta.env.BASE_URL}icons/logo.svg`} width="34" height="34" alt="" />
      </span>
      <span>
        Jammer<span className="brand-light"> Docs</span>
      </span>
    </div>
  );
}
function Auth({ initialError }: { initialError: string }) {
  const [signup, setSignup] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(initialError),
    [message, setMessage] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data, error } = await (signup
        ? supabase!.auth.signUp({ email, password })
        : supabase!.auth.signInWithPassword({ email, password }));
      if (error) throw error;
      if (signup && !data.session)
        setMessage('Check your email to confirm your account, then sign in.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Logo />
        <span className="eyebrow">YOUR MUSIC. ALL TOGETHER.</span>
        <h1>{signup ? 'Make room for your next idea.' : 'Welcome back.'}</h1>
        <p>Lyrics, chords, and setlists. One space to keep your music flowing.</p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <p role="status" className="success">
            {message}
          </p>
        )}
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <div className="password-field">
              <input
                type={visible ? 'text' : 'password'}
                minLength={6}
                required
                autoComplete={signup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={visible ? 'Hide password' : 'Show password'}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <button className="button full" disabled={busy}>
            {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <button
          className="text-button full"
          onClick={() => {
            setSignup(!signup);
            setError('');
            setMessage('');
          }}
        >
          {signup ? 'Already have an account? Sign in' : 'New to Jammer? Create an account'}
        </button>
      </div>
    </div>
  );
}
function ProfileAvatar({
  initial,
  isAdmin,
  small = false,
}: {
  initial: string;
  isAdmin: boolean;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar profile-avatar ${small ? 'small' : ''}`}
      role="img"
      aria-label={isAdmin ? 'Admin profile' : 'User profile'}
      title={isAdmin ? 'Admin' : undefined}
    >
      {isAdmin && <Crown className="admin-crown" size={18} aria-hidden="true" />}
      {initial}
    </span>
  );
}
function Workspace({
  email,
  installation,
  isAdmin,
}: {
  email: string;
  installation: ReturnType<typeof useAppInstallation>;
  isAdmin: boolean;
}) {
  const ws = useWorkspace(),
    [route, setRoute] = useState(readRoute),
    [mobileNav, setMobileNav] = useState(false),
    [templateId, setTemplateId] = useState(''),
    [query, setQuery] = useState(''),
    [docQuery, setDocQuery] = useState('');
  const [modal, setModal] = useState<'document' | 'template' | null>(null),
    [newSongSessionId, setNewSongSessionId] = useState<string | null>(null),
    [name, setName] = useState(''),
    [songType, setSongType] = useState<SongType>('song'),
    [artistName, setArtistName] = useState(''),
    [menuFor, setMenuFor] = useState<Session | null>(null),
    [exporting, setExporting] = useState<string | null>(null),
    [sessionForm, setSessionForm] = useState<Session | 'new' | null>(null),
    [deleteSession, setDeleteSession] = useState<Session | null>(null),
    [editTemplate, setEditTemplate] = useState<string | null>(null),
    [deleteTemplate, setDeleteTemplate] = useState<string | null>(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('jammer-theme') ?? 'system'),
    [notice, setNotice] = useState('');
  useEffect(() => {
    const handler = () => {
      setRoute(readRoute());
      setMobileNav(false);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('jammer-theme', theme);
  }, [theme]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        navigate('search');
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function exportPdf(s: Session) {
    setExporting(s.id);
    try {
      const songs = ws.data.session_songs
        .filter((i) => i.session_id === s.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ws.data.documents.find((d) => d.id === i.document_id))
        .filter((d): d is Doc => Boolean(d));
      await exportSessionPdf(s, songs);
      setMenuFor(null);
    } catch (e) {
      setNotice(`PDF export failed: ${errorMessage(e)}`);
    } finally {
      setExporting(null);
    }
  }
  const docs = ws
      .templateDocuments(templateId)
      .filter((d) => d.title.toLowerCase().includes(docQuery.toLowerCase())),
    selected = ws.data.documents.find((d) => d.id === route.id),
    session = ws.data.sessions.find((s) => s.id === route.id);
  const now = new Date(),
    today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const sessions = [...ws.data.sessions].sort((a, b) => {
    if (!a.session_date || !b.session_date)
      return Number(!a.session_date) - Number(!b.session_date);
    const aUpcoming = a.session_date >= today,
      bUpcoming = b.session_date >= today;
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    return aUpcoming
      ? a.session_date.localeCompare(b.session_date)
      : b.session_date.localeCompare(a.session_date);
  });
  const daysUntil = (date: string) =>
    Math.round((Date.parse(`${date}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86400000);
  const upcoming = sessions.filter((s) => s.session_date && s.session_date >= today),
    recent = [...ws.data.documents]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 5);
  const nav = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'documents', label: 'Songs', icon: ListMusic },
    { id: 'sessions', label: 'Sessions', icon: CalendarDays },
    { id: 'templates', label: 'Templates', icon: Layers },
    { id: 'search', label: 'Search', icon: Search },
  ];
  function openCreate(type: 'document' | 'template') {
    setNewSongSessionId(null);
    setName('');
    setSongType('song');
    setArtistName('');
    setModal(type);
  }
  function openTemplate(id: string) {
    setTemplateId(id);
    navigate('documents');
  }
  async function signOut() {
    if (ws.pending && !(await ws.retry())) {
      setNotice('Your changes have not synced. Retry saving before signing out.');
      return;
    }
    const { error } = await supabase!.auth.signOut();
    if (error) setNotice(error.message);
    else navigate('home');
  }
  const documentRows = (items: typeof recent) =>
    items.map((d) => (
      <button className="document-row" key={d.id} onClick={() => navigate('documents', d.id)}>
        <span className={`document-icon ${songTypeMeta(d.song_type).color}`}>
          <TypeIcon type={d.song_type} size={20} />
        </span>
        <span className="row-copy">
          <strong>{d.title || 'Untitled'}</strong>
          <small>{d.artist || `Updated ${dateLabel(d.updated_at)}`}</small>
        </span>
        <ChevronRight size={17} />
      </button>
    ));
  if (ws.loading) return <div className="loading">Loading your library…</div>;
  if (!ws.ready)
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Logo />
          <h1>Could not load your workspace</h1>
          <p role="alert">{ws.error}</p>
          <button className="button" onClick={() => void ws.load()}>
            Retry loading
          </button>
        </div>
      </div>
    );
  return (
    <>
      {route.page === 'session' && session ? (
        <>
          <Messages notice={notice} onDismissNotice={() => setNotice('')} />
          <SessionDetail
            key={session.id}
            session={session}
            onBack={() => navigate('sessions')}
            onCreateSong={(title) => {
              openCreate('document');
              setNewSongSessionId(session.id);
              setName(title.slice(0, 200));
            }}
          />
        </>
      ) : (
        <div
          className={`app-shell ${route.page === 'documents' ? 'documents-layout' : ''} ${route.page === 'documents' && selected ? 'document-open' : ''}`}
        >
          {mobileNav && (
            <button
              className="nav-scrim"
              aria-label="Close navigation"
              onClick={() => setMobileNav(false)}
            />
          )}
          <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
            <div className="sidebar-brand">
              <Logo />
              <button
                className="icon-button mobile-only"
                onClick={() => setMobileNav(false)}
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
            </div>
            <div className="workspace-label">
              <ProfileAvatar initial={supabase ? email[0].toUpperCase() : 'J'} isAdmin={isAdmin} />
              <span>
                <strong>
                  My Workspace
                  {isAdmin && <span className="admin-tag">Admin</span>}
                </strong>
                <small>{email}</small>
              </span>
            </div>
            <span className="nav-label">WORKSPACE</span>
            <nav>
              {nav.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={`nav-item ${route.page === id ? 'active' : ''}`}
                  onClick={() => navigate(id)}
                >
                  <Icon size={19} />
                  <span>{label}</span>
                  {id === 'documents' && (
                    <span className="nav-count">{ws.data.documents.length}</span>
                  )}
                  {id === 'search' && <kbd>⌘ K</kbd>}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="sidebar-note">
                <Music2 size={20} />
                <strong>Make space for music.</strong>
                <p>
                  A little practice. A new idea.
                  <br />
                  Your next great session.
                </p>
              </div>
              <button
                className={`nav-item ${route.page === 'settings' ? 'active' : ''}`}
                onClick={() => navigate('settings')}
              >
                <Settings size={18} /> Settings
              </button>
              <div className="connection">
                <span />
                {supabase ? 'Cloud workspace' : 'Saved on this device'}
              </div>
            </div>
          </aside>
          <div className="main-shell">
            <header className="topbar">
              <button
                className="icon-button mobile-only"
                onClick={() => setMobileNav(true)}
                aria-label="Open navigation"
              >
                <Menu size={22} />
              </button>
              <span>{nav.find((n) => n.id === route.page)?.label ?? 'Settings'}</span>
              <div className="topbar-right">
                <button
                  className="icon-button"
                  onClick={() => navigate('search')}
                  aria-label="Search workspace"
                >
                  <Search size={20} />
                </button>
                <span className="topbar-divider" />
                <ProfileAvatar
                  initial={supabase ? email[0].toUpperCase() : 'J'}
                  isAdmin={isAdmin}
                  small
                />
              </div>
            </header>
            <Messages notice={notice} onDismissNotice={() => setNotice('')} />
            {route.page === 'home' && (
              <main className="page home-page">
                <div className="page-heading home-actions">
                  <button className="button" onClick={() => openCreate('document')}>
                    <Plus size={18} /> New song
                  </button>
                </div>
                <div className="stats">
                  {[
                    {
                      title: 'Songs',
                      page: 'documents',
                      count: ws.data.documents.length,
                      icon: Music2,
                      color: 'indigo',
                      detail: 'Songs & ideas',
                    },
                    {
                      title: 'Sessions',
                      page: 'sessions',
                      count: ws.data.sessions.length,
                      icon: CalendarDays,
                      color: 'violet',
                      detail: 'Time to play',
                    },
                    {
                      title: 'Templates',
                      page: 'templates',
                      count: ws.data.templates.length,
                      icon: Layers,
                      color: 'teal',
                      detail: 'Your favorite views',
                    },
                  ].map(({ title, page, count, icon: Icon, color, detail }) => (
                    <button className="stat" key={title} onClick={() => navigate(page)}>
                      <span className={`stat-icon ${color}`}>
                        <Icon size={23} />
                      </span>
                      <div>
                        <span>{title}</span>
                        <strong>{count.toString().padStart(2, '0')}</strong>
                        <small>{detail}</small>
                      </div>
                      <ArrowUpRight size={17} />
                    </button>
                  ))}
                </div>
                <div className="home-columns">
                  <div>
                    <div className="section-heading">
                      <h2>Your creative toolkit</h2>
                      <span className="muted small-text">EVERYTHING IN ONE PLACE</span>
                    </div>
                    <div className="feature-grid">
                      {[
                        {
                          title: 'Songs',
                          page: 'documents',
                          text: 'Bring your lyrics and chords together.',
                          icon: Music2,
                          color: 'indigo',
                        },
                        {
                          title: 'Sessions',
                          page: 'sessions',
                          text: 'A setlist for every time you play.',
                          icon: CalendarDays,
                          color: 'violet',
                        },
                        {
                          title: 'Templates',
                          page: 'templates',
                          text: 'The right order for every occasion.',
                          icon: Layers,
                          color: 'teal',
                        },
                        {
                          title: 'Search',
                          page: 'search',
                          text: 'Find that song you had in mind.',
                          icon: Search,
                          color: 'amber',
                        },
                      ].map(({ title, page, text, icon: Icon, color }) => (
                        <button
                          className={`feature ${color}`}
                          key={title}
                          onClick={() => navigate(page)}
                        >
                          <div>
                            <span className="feature-icon">
                              <Icon size={24} />
                            </span>
                            <ArrowUpRight size={17} />
                          </div>
                          <h3>{title}</h3>
                          <p>{text}</p>
                        </button>
                      ))}
                    </div>
                    <div className="section-heading spaced">
                      <h2>Recent songs</h2>
                      <button className="text-button" onClick={() => navigate('documents')}>
                        View all <ArrowUpRight size={15} />
                      </button>
                    </div>
                    <div className="list-card">
                      {recent.length ? (
                        documentRows(recent)
                      ) : (
                        <Empty
                          title="Your first song starts here"
                          description="Keep lyrics, chords, and inspiration together."
                        >
                          <button
                            className="button secondary"
                            onClick={() => openCreate('document')}
                          >
                            <Plus size={17} /> Create a song
                          </button>
                        </Empty>
                      )}
                    </div>
                  </div>
                  <div className="upcoming-column">
                    <div className="section-heading">
                      <h2>Upcoming sessions</h2>
                      <button
                        className="icon-button"
                        aria-label="Create session"
                        onClick={() => setSessionForm('new')}
                      >
                        <Plus size={19} />
                      </button>
                    </div>
                    <div className="list-card upcoming-card">
                      {upcoming.length ? (
                        upcoming.slice(0, 4).map((s) => (
                          <button
                            className="session-row"
                            key={s.id}
                            onClick={() => navigate('session', s.id)}
                          >
                            <span className="date-tile">
                              <small>
                                {new Date(`${s.session_date}T12:00:00`).toLocaleString(undefined, {
                                  month: 'short',
                                })}
                              </small>
                              <strong>{s.session_date?.slice(-2)}</strong>
                            </span>
                            <span className="row-copy">
                              <strong>{s.name}</strong>
                              <small>
                                {ws.data.session_songs.filter((i) => i.session_id === s.id).length}{' '}
                                songs
                              </small>
                            </span>
                            <ChevronRight size={17} />
                          </button>
                        ))
                      ) : (
                        <div className="upcoming-empty">
                          <CalendarDays size={32} />
                          <h3>Your next session awaits</h3>
                          <p>
                            Give your practice a place
                            <br />
                            on the calendar.
                          </p>
                          <button className="text-button" onClick={() => setSessionForm('new')}>
                            Plan a session <Plus size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="tip-card">
                      <span className="eyebrow">MADE FOR MUSICIANS</span>
                      <div className="music-decoration" aria-hidden="true">
                        ♫
                      </div>
                      <h2>
                        Less searching.
                        <br />
                        More playing.
                      </h2>
                      <p>
                        Use Smart Paste to bring in a chord sheet. Your chords stay right where they
                        belong.
                      </p>
                      <button className="text-button" onClick={() => navigate('documents')}>
                        Open your library <ArrowRightIcon />
                      </button>
                    </div>
                  </div>
                </div>
              </main>
            )}
            {route.page === 'documents' && (
              <div className="documents-workspace">
                <aside className="document-panel">
                  <div className="section-heading">
                    <h2>
                      Songs <span className="count">{ws.data.documents.length}</span>
                    </h2>
                    <button
                      className="icon-button"
                      onClick={() => openCreate('document')}
                      aria-label="New song"
                    >
                      <Plus size={21} />
                    </button>
                  </div>
                  <label className="view-select">
                    VIEW
                    <select
                      aria-label="Template view"
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                    >
                      <option value="">All songs</option>
                      {ws.data.templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="search-field">
                    <Search size={16} />
                    <input
                      aria-label="Filter songs"
                      placeholder="Search…"
                      value={docQuery}
                      onChange={(e) => setDocQuery(e.target.value)}
                    />
                  </div>
                  <div className="document-list">
                    {templateId && !docQuery ? (
                      <SortableList
                        ids={docs.map((d) => d.id)}
                        onReorder={(ids) => ws.setOrder('template', templateId, ids)}
                      >
                        {(id) => {
                          const d = docs.find((d) => d.id === id)!;
                          return (
                            <button
                              className={`doc-nav ${route.id === id ? 'selected' : ''}`}
                              onClick={() => navigate('documents', id)}
                            >
                              <TypeIcon type={d.song_type} />
                              <span>{d.title || 'Untitled'}</span>
                            </button>
                          );
                        }}
                      </SortableList>
                    ) : (
                      docs.map((d) => (
                        <button
                          key={d.id}
                          className={`doc-nav ${route.id === d.id ? 'selected' : ''}`}
                          onClick={() => navigate('documents', d.id)}
                        >
                          <TypeIcon type={d.song_type} />
                          <span>{d.title || 'Untitled'}</span>
                        </button>
                      ))
                    )}
                    {!docs.length && docQuery && <p className="muted panel-hint">No matches.</p>}
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => openCreate('template')}
                    aria-label="New template"
                    title="New template"
                  >
                    <Layers size={17} /> <Plus size={15} />
                  </button>
                </aside>
                {selected ? (
                  <Editor
                    key={selected.id}
                    doc={selected}
                    onBack={() => navigate('documents')}
                    onDelete={() => {
                      ws.deleteDocument(selected.id);
                      navigate('documents');
                    }}
                  />
                ) : (
                  <div className="editor-placeholder">
                    <Empty>
                      <button
                        className="button"
                        onClick={() => openCreate('document')}
                        aria-label="New song"
                      >
                        <Plus size={18} />
                      </button>
                    </Empty>
                  </div>
                )}
              </div>
            )}
            {route.page === 'sessions' && (
              <main className="page">
                <div className="page-heading">
                  <h1>Sessions</h1>
                  <button
                    className="button"
                    onClick={() => setSessionForm('new')}
                    aria-label="New session"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {sessions.length ? (
                  <div className="collection-grid">
                    {sessions.map((s) => (
                      <article className="collection-card" key={s.id}>
                        <span className="stat-icon violet">
                          <CalendarDays size={24} />
                        </span>
                        <div className="card-tools">
                          <button
                            className="icon-button"
                            aria-label={`Options for ${s.name}`}
                            aria-haspopup="dialog"
                            onClick={() => setMenuFor(s)}
                          >
                            <MoreVertical size={17} />
                          </button>
                        </div>
                        <button className="card-title" onClick={() => navigate('session', s.id)}>
                          <h2>{s.name}</h2>
                          <ArrowUpRight size={20} />
                        </button>
                        {s.notes && <p>{s.notes}</p>}
                        <div className="card-meta">
                          <span>
                            {dateLabel(s.session_date)}
                            {s.session_date &&
                              (s.session_date >= today ? (
                                <span className="session-badge upcoming">
                                  {daysUntil(s.session_date) === 0
                                    ? 'Today'
                                    : `${daysUntil(s.session_date)} ${daysUntil(s.session_date) === 1 ? 'day' : 'days'} left`}
                                </span>
                              ) : (
                                <span className="session-badge completed">Completed</span>
                              ))}
                          </span>
                          <span>
                            {ws.data.session_songs.filter((i) => i.session_id === s.id).length}{' '}
                            songs
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty>
                    <button
                      className="button"
                      onClick={() => setSessionForm('new')}
                      aria-label="New session"
                    >
                      <Plus size={18} />
                    </button>
                  </Empty>
                )}
              </main>
            )}
            {route.page === 'templates' && (
              <main className="page">
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">A DIFFERENT WAY TO SEE YOUR SONGS</span>
                    <h1>Templates</h1>
                    <p>Save custom document orders for the way you like to play.</p>
                  </div>
                  <button className="button" onClick={() => openCreate('template')}>
                    <Plus size={18} /> New template
                  </button>
                </div>
                {ws.data.templates.length ? (
                  <div className="collection-grid">
                    {ws.data.templates.map((t) => (
                      <article className="collection-card" key={t.id}>
                        <span className="stat-icon teal">
                          <Layers size={24} />
                        </span>
                        <div className="card-tools">
                          <button
                            className="icon-button"
                            aria-label={`Rename ${t.name}`}
                            onClick={() => {
                              setName(t.name);
                              setEditTemplate(t.id);
                            }}
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Delete ${t.name}`}
                            onClick={() => setDeleteTemplate(t.id)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                        <button className="card-title" onClick={() => openTemplate(t.id)}>
                          <h2>{t.name}</h2>
                          <ArrowUpRight size={20} />
                        </button>
                        <p>All your documents, in your own order.</p>
                        <div className="card-meta">
                          <span>{dateLabel(t.created_at)}</span>
                          <span>{ws.data.documents.length} documents</span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="Find your flow"
                    description="Create a template, then drag your documents into the perfect order."
                  >
                    <button className="button" onClick={() => openCreate('template')}>
                      Create a template
                    </button>
                  </Empty>
                )}
              </main>
            )}
            {route.page === 'search' && (
              <main className="page search-page">
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">RIGHT WHERE YOU LEFT IT</span>
                    <h1>Find your next song.</h1>
                    <p>Search documents, lyrics, sessions, and templates.</p>
                  </div>
                </div>
                <div className="search-field large">
                  <Search size={22} />
                  <input
                    autoFocus
                    aria-label="Search workspace"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="What are you looking for?"
                  />
                  {query && (
                    <button
                      className="icon-button"
                      aria-label="Clear search"
                      onClick={() => setQuery('')}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                {query.trim() ? (
                  <SearchResults query={query} openTemplate={openTemplate} />
                ) : (
                  <Empty
                    title="Everything, a little closer"
                    description="Type a title, a lyric, or a session name to get started."
                  />
                )}
              </main>
            )}
            {route.page === 'settings' && (
              <main className="page settings-page">
                <div className="page-heading">
                  <div>
                    <h1>Settings</h1>
                    <p>Make yourself at home.</p>
                  </div>
                </div>
                <section className="settings-card">
                  <h2>Workspace</h2>
                  <p>{email}</p>
                  <p className="muted">
                    {supabase
                      ? 'Your workspace syncs to Supabase.'
                      : 'Your workspace is stored in this browser on this device. Configure Supabase in .env to use a cloud account.'}
                  </p>
                  <button className="button secondary" onClick={ws.exportData}>
                    <Download size={18} /> Export workspace backup
                  </button>
                </section>
                {supabase && <ConnectionStatus />}
                <InstallApp installation={installation} />
                <section className="settings-card">
                  <h2>Appearance</h2>
                  <div className="theme-options">
                    {[
                      { id: 'light', icon: Sun },
                      { id: 'dark', icon: Moon },
                      { id: 'system', icon: Monitor },
                    ].map(({ id, icon: Icon }) => (
                      <button
                        className={`button ${theme === id ? '' : 'secondary'}`}
                        key={id}
                        onClick={() => setTheme(id)}
                        aria-pressed={theme === id}
                      >
                        <Icon size={17} />
                        {id[0].toUpperCase() + id.slice(1)}
                      </button>
                    ))}
                  </div>
                </section>
                {supabase && (
                  <button className="button secondary" onClick={() => void signOut()}>
                    <LogOut size={18} /> Sign out
                  </button>
                )}
              </main>
            )}
            {!['home', 'documents', 'sessions', 'templates', 'search', 'settings'].includes(
              route.page,
            ) && (
              <Empty title="Page not found" description="Head back to your workspace.">
                <button className="button" onClick={() => navigate('home')}>
                  Home
                </button>
              </Empty>
            )}
          </div>
          <nav className="mobile-bottom">
            {nav.slice(0, 4).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={route.page === id ? 'active' : ''}
                onClick={() => navigate(id)}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}
      {(modal || editTemplate) && (
        <Modal
          title={
            editTemplate
              ? 'Rename template'
              : modal === 'document'
                ? newSongSessionId
                  ? 'Create new song'
                  : 'New song'
                : 'New template'
          }
          onClose={() => {
            setModal(null);
            setNewSongSessionId(null);
            setEditTemplate(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              if (editTemplate) {
                ws.saveTemplate(editTemplate, name);
                setEditTemplate(null);
              } else if (modal === 'document') {
                if (songType === 'artist' && !artistName.trim()) return;
                if (newSongSessionId && !ws.canManageSessionSongs) return;
                const doc = ws.createDocument(name, songType, artistName);
                if (newSongSessionId) {
                  const ids = ws.data.session_songs
                    .filter((song) => song.session_id === newSongSessionId)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((song) => song.document_id);
                  ws.setOrder('session', newSongSessionId, [...ids, doc.id]);
                }
                navigate('documents', doc.id);
              } else {
                const t = ws.createTemplate(name);
                openTemplate(t.id);
              }
              setModal(null);
              setNewSongSessionId(null);
            }}
          >
            {modal === 'document' && !editTemplate && (
              <div className="type-picker" role="radiogroup" aria-label="Song type">
                {SONG_TYPES.map(({ value, label, icon: Icon, color }) => (
                  <label
                    key={value}
                    className={`type-option ${color} ${songType === value ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="song-type"
                      value={value}
                      checked={songType === value}
                      onChange={() => setSongType(value)}
                    />
                    <Icon size={19} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            )}
            <label>
              {modal === 'document' ? 'Name' : 'Template name'}
              <input
                autoFocus
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={modal === 'document' ? 'Give your song a name' : 'Acoustic favorites'}
              />
            </label>
            {modal === 'document' && !editTemplate && songType === 'artist' && (
              <label>
                Artist name
                <input
                  required
                  maxLength={200}
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder="Who plays it?"
                />
              </label>
            )}
            {modal === 'template' && (
              <p className="muted">
                Templates include all your documents. Drag songs into your preferred order in the
                document sidebar.
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setModal(null);
                  setNewSongSessionId(null);
                  setEditTemplate(null);
                }}
              >
                Cancel
              </button>
              <button
                className="button"
                disabled={
                  !name.trim() ||
                  (modal === 'document' &&
                    !editTemplate &&
                    songType === 'artist' &&
                    !artistName.trim())
                }
              >
                {editTemplate ? 'Save name' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {menuFor && (
        <Modal title={menuFor.name} onClose={() => setMenuFor(null)}>
          <div className="option-list">
            <button disabled={Boolean(exporting)} onClick={() => void exportPdf(menuFor)}>
              <FileDown size={18} /> {exporting ? 'Exporting…' : 'Export'}
            </button>
            <button
              onClick={() => {
                const s = menuFor;
                setMenuFor(null);
                setSessionForm(s);
              }}
            >
              <Pencil size={18} /> Edit
            </button>
            <button
              className="danger"
              onClick={() => {
                const s = menuFor;
                setMenuFor(null);
                setDeleteSession(s);
              }}
            >
              <Trash2 size={18} /> Delete
            </button>
          </div>
        </Modal>
      )}
      {sessionForm && (
        <SessionForm
          session={sessionForm === 'new' ? undefined : sessionForm}
          onClose={() => setSessionForm(null)}
          onSaved={(id) => {
            setSessionForm(null);
            navigate('session', id);
          }}
        />
      )}
      {(deleteSession || deleteTemplate) && (
        <Modal
          title={deleteSession ? `Delete "${deleteSession.name}"?` : 'Delete template?'}
          onClose={() => {
            setDeleteSession(null);
            setDeleteTemplate(null);
          }}
        >
          <p>
            Are you sure you want to delete this {deleteSession ? 'session' : 'template'}? This
            cannot be undone.{' '}
            {deleteSession
              ? 'The session and its setlist are removed'
              : 'The template order is removed'}
            , but your songs stay in your library.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => {
                setDeleteSession(null);
                setDeleteTemplate(null);
              }}
            >
              Cancel
            </button>
            <button
              className="button danger"
              onClick={() => {
                if (deleteSession) ws.deleteSession(deleteSession.id);
                if (deleteTemplate) {
                  ws.deleteTemplate(deleteTemplate);
                  if (templateId === deleteTemplate) setTemplateId('');
                }
                setDeleteSession(null);
                setDeleteTemplate(null);
              }}
            >
              Yes, delete
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function ArrowRightIcon() {
  return <ChevronRight size={17} />;
}
function Messages({ notice, onDismissNotice }: { notice: string; onDismissNotice: () => void }) {
  const ws = useWorkspace();
  if (!ws.error && !notice) return null;
  return (
    <div className="snackbar-region">
      {ws.error && (
        <Snackbar
          message={`${ws.pending ? 'Changes have not synced. ' : ''}${ws.error}`}
          actionLabel="Retry"
          onAction={() => void (ws.pending ? ws.retry() : ws.load())}
        />
      )}
      {notice && <Snackbar message={notice} onDismiss={onDismissNotice} />}
    </div>
  );
}
function SearchResults({
  query,
  openTemplate,
}: {
  query: string;
  openTemplate: (id: string) => void;
}) {
  const { data } = useWorkspace(),
    q = query.trim().toLowerCase();
  const results = [
    ...data.documents
      .filter((d) => `${d.title} ${plainText(d.content)}`.toLowerCase().includes(q))
      .map((d) => ({
        id: d.id,
        title: d.title,
        type: 'Document',
        song_type: d.song_type,
        open: () => navigate('documents', d.id),
      })),
    ...data.sessions
      .filter((s) => `${s.name} ${s.notes}`.toLowerCase().includes(q))
      .map((s) => ({
        id: s.id,
        title: s.name,
        type: 'Session',
        song_type: null,
        open: () => navigate('session', s.id),
      })),
    ...data.templates
      .filter((t) => t.name.toLowerCase().includes(q))
      .map((t) => ({
        id: t.id,
        title: t.name,
        type: 'Template',
        song_type: null,
        open: () => openTemplate(t.id),
      })),
  ];
  return results.length ? (
    <>
      <p className="muted">
        {results.length} {results.length === 1 ? 'result' : 'results'}
      </p>
      <div className="list-card">
        {results.map((r) => (
          <button className="document-row" key={`${r.type}-${r.id}`} onClick={r.open}>
            <span
              className={`document-icon ${r.type === 'Document' ? songTypeMeta(r.song_type).color : ''}`}
            >
              {r.type === 'Document' ? (
                <TypeIcon type={r.song_type} size={20} />
              ) : r.type === 'Session' ? (
                <CalendarDays size={20} />
              ) : (
                <Layers size={20} />
              )}
            </span>
            <span className="row-copy">
              <strong>{r.title || 'Untitled'}</strong>
              <small>{r.type}</small>
            </span>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
    </>
  ) : (
    <Empty title="No matches yet" description="Try a different title, lyric, or session name." />
  );
}
