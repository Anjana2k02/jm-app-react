import { useTimedMessage } from './useTimedMessage';
import { useState } from 'react';
import { checkConnection, errorMessage, projectUrl } from './backend';

export function ConnectionStatus() {
  const [results, setResults] = useState<Awaited<ReturnType<typeof checkConnection>>>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useTimedMessage();
  async function check() {
    setBusy(true);
    setError('');
    setResults([]);
    try {
      const checks = await checkConnection();
      setResults(checks.filter((result) => result.ok));
      setError(
        checks
          .filter((result) => !result.ok)
          .map((result) => `${result.name}: ${result.detail}`)
          .join(' '),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-card">
      <h2>Supabase connection</h2>
      <p className="connection-url">{projectUrl}</p>
      <p>Check authentication and access to the app’s five database tables.</p>
      <button className="button secondary" disabled={busy} onClick={() => void check()}>
        {busy ? 'Checking…' : 'Check API connection'}
      </button>
      {error && <p role="alert">{error}</p>}
      {results.length > 0 && (
        <ul className="connection-results" aria-label="API connection results">
          {results.map((r) => (
            <li key={r.name}>
              <strong>
                {r.ok ? '✓' : '×'} {r.name}
              </strong>
              <p>{r.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
