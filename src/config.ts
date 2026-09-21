export type Environment = Record<string, string | undefined>;

// Keep URL and key together: never combine credentials from different projects.
export function resolveSupabaseConfig(...sources: Environment[]) {
  for (const source of sources) {
    for (const prefix of ['VITE_', '']) {
      const url = (source[`${prefix}SUPABASE_URL`] ?? '').trim();
      const key = (
        source[`${prefix}SUPABASE_PUBLISHABLE_KEY`] ||
        source[`${prefix}SUPABASE_ANON_KEY`] ||
        ''
      ).trim();
      if (url || key) return { url, key };
    }
  }
  return { url: '', key: '' };
}

export function validateSupabaseConfig(url: string, key: string, mode = 'cloud') {
  if (mode === 'local') return '';
  if (mode !== 'cloud') return 'VITE_WORKSPACE_MODE must be cloud or local.';
  if (!url || !key)
    return 'Supabase is not configured. Add your project URL and public API key to the root .env or react-app/.env, then restart the development server.';
  try {
    if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error();
  } catch {
    return 'The Supabase project URL must be a valid HTTP or HTTPS URL.';
  }
  if (key.startsWith('sb_secret_'))
    return 'Use a publishable or anon key. Secret keys must never be used in a browser.';
  if (key.split('.').length === 3) {
    try {
      const encoded = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
      if (payload.role !== 'anon')
        return 'Use a public anon key, not a service-role key or user access token.';
    } catch {
      return 'The Supabase anon key is malformed. Copy the complete public key from your project settings.';
    }
  }
  return '';
}
