import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// Keep this hook mounted at the app root, including while signing in, so the
// browser's one-time prompt is available when the user opens Settings later.
export function useAppInstallation() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      setMessage('');
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      setMessage('');
    };
    const onDisplayMode = () => setInstalled(isStandalone());
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    displayMode.addEventListener('change', onDisplayMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      displayMode.removeEventListener('change', onDisplayMode);
    };
  }, []);

  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      setMessage(
        outcome === 'accepted'
          ? 'Installation requested. Follow your browser to finish, then open Jammer Docs from your home screen.'
          : 'Installation dismissed. You can still add the app using your browser menu.',
      );
    } catch {
      setMessage('Use your browser menu to add Jammer Docs to your home screen.');
    } finally {
      // A deferred prompt can only be used once, even after dismissal.
      setPrompt(null);
      setBusy(false);
    }
  }

  return { available: Boolean(prompt), installed, busy, message, install };
}

export function InstallApp({
  installation,
}: {
  installation: ReturnType<typeof useAppInstallation>;
}) {
  const { available, installed, busy, message, install } = installation;
  return (
    <section className="settings-card" aria-labelledby="install-app-title">
      <div className="install-app-heading">
        <img src={`${import.meta.env.BASE_URL}icons/logo.svg`} width="56" height="56" alt="" />
        <div>
          <h2 id="install-app-title">Jammer Docs on your phone</h2>
          <span className="muted small-text">Your music, one tap away.</span>
        </div>
      </div>
      {installed ? (
        <p role="status">You’re using the installed app.</p>
      ) : (
        <>
          <p>Add Jammer Docs to your home screen to open it in its own app window.</p>
          {available && (
            <button className="button" disabled={busy} onClick={() => void install()}>
              <Download size={18} /> {busy ? 'Opening install…' : 'Install Jammer Docs'}
            </button>
          )}
          <div className="install-instructions">
            <p>
              <strong>Android</strong>
              <br />
              Open this website in Chrome. Tap the menu (⋮), then{' '}
              <strong>Add to Home screen</strong> or <strong>Install app</strong>.
            </p>
            <p>
              <strong>iPhone / iPad</strong>
              <br />
              Open this website in Safari. Tap <strong>Share</strong>, then{' '}
              <strong>Add to Home Screen</strong>. Keep <strong>Open as Web App</strong> on if
              shown, then tap <strong>Add</strong>.
            </p>
          </div>
          {!window.isSecureContext && (
            <p className="muted">
              Open the published HTTPS website to install the app on your phone.
            </p>
          )}
          {message && <p role="status">{message}</p>}
        </>
      )}
      <p className="muted small-text">
        An internet connection is needed to open the app and sync your cloud workspace.
      </p>
    </section>
  );
}
