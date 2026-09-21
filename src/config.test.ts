import { describe, it, expect } from 'vitest';
import { resolveSupabaseConfig, validateSupabaseConfig } from './config';
describe('Supabase configuration', () => {
  it('uses the original Flutter environment without renaming its variables', () => {
    expect(
      resolveSupabaseConfig(
        {},
        { SUPABASE_URL: 'https://shared.supabase.co', SUPABASE_ANON_KEY: 'public-key' },
      ),
    ).toEqual({ url: 'https://shared.supabase.co', key: 'public-key' });
  });
  it('prefers a React-specific pair and supports publishable keys', () => {
    expect(
      resolveSupabaseConfig(
        {
          VITE_SUPABASE_URL: 'https://react.supabase.co',
          VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
        },
        { SUPABASE_URL: 'https://shared.supabase.co', SUPABASE_ANON_KEY: 'old-key' },
      ),
    ).toEqual({ url: 'https://react.supabase.co', key: 'sb_publishable_test' });
  });
  it('does not mix partial credentials from different projects', () => {
    const pair = resolveSupabaseConfig(
      { VITE_SUPABASE_URL: 'https://react.supabase.co' },
      { SUPABASE_URL: 'https://other.supabase.co', SUPABASE_ANON_KEY: 'other-key' },
    );
    expect(pair.key).toBe('');
    expect(validateSupabaseConfig(pair.url, pair.key)).toContain('not configured');
  });
  it('requires cloud configuration unless local mode was explicitly requested', () => {
    expect(validateSupabaseConfig('', '')).toContain('not configured');
    expect(validateSupabaseConfig('', '', 'local')).toBe('');
    expect(validateSupabaseConfig('not-a-url', 'key')).toContain('valid HTTP');
  });
  it('rejects server secrets without including them in error messages', () => {
    expect(validateSupabaseConfig('https://app.supabase.co', 'sb_secret_example')).toContain(
      'Secret keys',
    );
    const secret = `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`;
    expect(validateSupabaseConfig('https://app.supabase.co', secret)).toContain('service-role');
    expect(validateSupabaseConfig('https://app.supabase.co', secret)).not.toContain(secret);
    const anon = `header.${btoa(JSON.stringify({ role: 'anon' }))}.signature`;
    expect(validateSupabaseConfig('https://app.supabase.co', anon)).toBe('');
  });
});
