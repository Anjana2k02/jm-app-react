import { useEffect, useRef, useState } from 'react';
import Quill, { Delta } from 'quill';
import { ClipboardPaste, ImagePlus, Undo2, Redo2, Save, Trash2, ArrowLeft } from 'lucide-react';
import 'quill/dist/quill.snow.css';
import {
  browserDelta,
  storageDelta,
  chordDelta,
  looksLikeChordSheet,
  plainText,
  type Doc,
  type Op,
} from './model';
import { uploadImage, errorMessage } from './backend';
import { useWorkspace } from './workspace';
import { Modal } from './components';
const Font = Quill.import('attributors/style/font') as { whitelist: string[] };
Font.whitelist = ['Arial', 'Inter', 'Georgia', 'Times New Roman', 'Courier New', 'monospace'];
Quill.register('formats/font', Font, true);
const Size = Quill.import('attributors/style/size') as { whitelist: string[] };
Size.whitelist = ['8', '10', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48'].map(
  (s) => `${s}px`,
);
Quill.register('formats/size', Size, true);

export function RichViewer({ doc }: { doc: Doc }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const el = document.createElement('div');
    host.current.append(el);
    const q = new Quill(el, { readOnly: true, modules: { toolbar: false }, theme: 'snow' });
    q.setContents(
      new Delta(browserDelta(doc.content.length ? doc.content : [{ insert: '\n' }]) as never),
    );
    return () => {
      host.current?.replaceChildren();
    };
  }, [doc.id, doc.content]);
  return <div className="rich-viewer" ref={host} />;
}
export function Editor({
  doc,
  onBack,
  onDelete,
}: {
  doc: Doc;
  onBack: () => void;
  onDelete: () => void;
}) {
  const ws = useWorkspace(),
    host = useRef<HTMLDivElement>(null),
    toolbar = useRef<HTMLDivElement>(null),
    quill = useRef<Quill | null>(null),
    file = useRef<HTMLInputElement>(null);
  const onChange = useRef(ws.saveDocument);
  onChange.current = ws.saveDocument;
  const [paste, setPaste] = useState(false),
    [pasteText, setPasteText] = useState(''),
    [error, setError] = useState(''),
    [uploading, setUploading] = useState(false),
    [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const element = document.createElement('div');
    host.current!.append(element);
    const q = new Quill(element, {
      theme: 'snow',
      placeholder: 'Start writing your song, or paste a chord sheet…',
      modules: { toolbar: toolbar.current, history: { delay: 500, maxStack: 100, userOnly: true } },
    });
    quill.current = q;
    q.setContents(
      new Delta(browserDelta(doc.content.length ? doc.content : [{ insert: '\n' }]) as never),
    );
    q.history.clear();
    q.root.setAttribute('aria-label', 'Document content');
    q.root.setAttribute('role', 'textbox');
    q.root.setAttribute('aria-multiline', 'true');
    const change = () =>
      onChange.current(doc.id, { content: storageDelta(q.getContents().ops as Op[]) });
    q.on('text-change', change);
    const smart = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain');
      if (text && looksLikeChordSheet(text)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        insertText(q, text);
      }
    };
    q.root.addEventListener('paste', smart, true);
    toolbar.current?.querySelectorAll('button,select').forEach((el) => {
      const format = [...el.classList].find((c) => c.startsWith('ql-'))?.slice(3) ?? 'format';
      const value = (el as HTMLButtonElement).value;
      el.setAttribute('aria-label', `${format}${value ? ` ${value}` : ''}`);
      el.setAttribute('title', `${format}${value ? ` ${value}` : ''}`);
    });
    return () => {
      q.off('text-change', change);
      q.root.removeEventListener('paste', smart, true);
      quill.current = null;
      host.current?.replaceChildren();
    };
  }, [doc.id]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void ws.retry();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ws.retry]);
  function insertText(q: Quill, text: string) {
    const range = q.getSelection(true) ?? { index: q.getLength() - 1, length: 0 };
    const delta = new Delta()
      .retain(range.index)
      .delete(range.length)
      .concat(new Delta(chordDelta(text) as never));
    q.updateContents(delta, 'user');
    q.setSelection(range.index + new Delta(chordDelta(text) as never).length(), 0, 'silent');
  }
  async function image(file: File) {
    const q = quill.current;
    if (!q) return;
    const index = q.getSelection()?.index ?? q.getLength() - 1;
    setUploading(true);
    setError('');
    try {
      const url = await uploadImage(file, ws.userId);
      if (quill.current === q) {
        q.insertEmbed(index, 'image', url, 'user');
        q.setSelection(index + 1, 0);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }
  return (
    <section className="editor-page">
      <div className="editor-actions">
        <button className="icon-button mobile-only" onClick={onBack} aria-label="Back to documents">
          <ArrowLeft size={20} />
        </button>
        <span className="breadcrumb">
          Documents <span>/</span> {doc.title}
        </span>
        <span className="save-state" role="status">
          {ws.error ? 'Save failed' : ws.pending ? 'Saving…' : '✓ Saved'}
        </span>
        <button
          className="button secondary"
          disabled={uploading}
          onClick={() => file.current?.click()}
        >
          <ImagePlus size={17} />
          <span>{uploading ? 'Uploading…' : 'Image'}</span>
        </button>
        <button className="button secondary" onClick={() => setPaste(true)}>
          <ClipboardPaste size={17} />
          <span>Smart Paste</span>
        </button>
        <button className="icon-button" onClick={() => void ws.retry()} aria-label="Save document">
          <Save size={19} />
        </button>
        <button
          className="icon-button"
          onClick={() => setDeleting(true)}
          aria-label="Delete document"
        >
          <Trash2 size={18} />
        </button>
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void image(f);
            e.target.value = '';
          }}
        />
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError('')}>Dismiss</button>
        </div>
      )}
      <div className="toolbar-wrap">
        <div className="history-tools">
          <button
            className="icon-button"
            aria-label="Undo"
            onClick={() => quill.current?.history.undo()}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo"
            onClick={() => quill.current?.history.redo()}
          >
            <Redo2 size={17} />
          </button>
        </div>
        <div ref={toolbar} className="editor-toolbar">
          <span className="ql-formats">
            <select className="ql-font" defaultValue="">
              <option value="">Default font</option>
              {Font.whitelist.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <select className="ql-size" defaultValue="">
              <option value="">14</option>
              {Size.whitelist.map((s) => (
                <option value={s} key={s}>
                  {s.replace('px', '')}
                </option>
              ))}
            </select>
          </span>
          <span className="ql-formats">
            <button className="ql-bold" />
            <button className="ql-italic" />
            <button className="ql-underline" />
            <button className="ql-strike" />
            <select className="ql-color" />
          </span>
          <span className="ql-formats">
            <select className="ql-header" defaultValue="">
              <option value="">Normal</option>
              <option value="1">Heading 1</option>
              <option value="2">Heading 2</option>
              <option value="3">Heading 3</option>
            </select>
            <select className="ql-align" />
          </span>
          <span className="ql-formats">
            <button className="ql-list" value="ordered" />
            <button className="ql-list" value="bullet" />
            <button className="ql-list" value="check" />
            <button className="ql-indent" value="-1" />
            <button className="ql-indent" value="+1" />
            <button className="ql-link" />
            <button className="ql-clean" />
          </span>
        </div>
      </div>
      <div className="paper-scroll">
        <div className="paper">
          <input
            className="document-title"
            aria-label="Document title"
            value={doc.title}
            onChange={(e) => ws.saveDocument(doc.id, { title: e.target.value })}
            onBlur={() => {
              if (!doc.title.trim()) ws.saveDocument(doc.id, { title: 'Untitled' });
            }}
          />
          <div ref={host} className="quill-host" />
        </div>
      </div>
      <footer className="editor-footer">
        <span>{plainText(doc.content).trim().split(/\s+/).filter(Boolean).length} words</span>
        <span>Chord-aware paste · Changes save automatically</span>
      </footer>
      {paste && (
        <Modal title="Smart Paste" onClose={() => setPaste(false)}>
          <p>
            Paste your lyrics and chords. Chord lines and the lyrics beneath them use a monospace
            font to keep their alignment.
          </p>
          <textarea
            autoFocus
            rows={10}
            aria-label="Chord sheet to paste"
            placeholder={'C       G       Am       F\nYour lyrics go here'}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setPaste(false)}>
              Cancel
            </button>
            <button
              className="button"
              disabled={!pasteText.trim()}
              onClick={() => {
                if (quill.current) insertText(quill.current, pasteText);
                setPaste(false);
                setPasteText('');
              }}
            >
              Insert content
            </button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal title="Delete document?" onClose={() => setDeleting(false)}>
          <p>
            “{doc.title}” will also be removed from templates and sessions. This cannot be undone.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setDeleting(false)}>
              Cancel
            </button>
            <button className="button danger" onClick={onDelete}>
              Delete document
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
