import { createClient } from '@supabase/supabase-js';
import type { Data } from './model';
import { emptyData } from './model';
import { validateSupabaseConfig } from './config';
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const localMode = import.meta.env.WORKSPACE_MODE === 'local';
export const projectUrl = url || '';
export function errorMessage(error: unknown) {
  return error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : String(error);
}
export const configError =
  import.meta.env.VITE_SUPABASE_CONFIG_ERROR ||
  validateSupabaseConfig(url, key, import.meta.env.WORKSPACE_MODE || 'cloud');
export const supabase = !localMode && url && key && !configError ? createClient(url, key) : null;
function requireBackend() {
  if (!supabase && !localMode) throw new Error(configError || 'Supabase is not connected.');
}
export const localKey = 'jammer-docs-local-v1';
// The workspace is shared: every signed-in user sees all rows.
export async function loadData(): Promise<Data> {
  requireBackend();
  if (!supabase) {
    const raw = localStorage.getItem(localKey);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    for (const key of Object.keys(emptyData()))
      if (!Array.isArray(parsed[key]))
        throw new Error(
          'The local workspace could not be read. Export your browser data before resetting it.',
        );
    return parsed;
  }
  const tables = Object.keys(emptyData()) as (keyof Data)[];
  const results = await Promise.all(tables.map((t) => supabase!.from(t).select('*')));
  const failedIndex = results.findIndex((r) => r.error);
  if (failedIndex >= 0)
    throw new Error(
      `Could not load ${tables[failedIndex]}: ${errorMessage(results[failedIndex].error)}. Check that the Supabase schema and RLS policies are installed.`,
    );
  return Object.fromEntries(tables.map((t, i) => [t, results[i].data])) as Data;
}
export async function upsert(table: keyof Data, rows: unknown[]) {
  requireBackend();
  if (!supabase || !rows.length) return;
  if (table === 'session_songs') await requireSessionAdmin();
  const { error } = await supabase.from(table).upsert(rows);
  if (error) throw new Error(`Could not save ${table}: ${errorMessage(error)}`);
}
export async function remove(table: keyof Data, column: string, id: string, documentId?: string) {
  requireBackend();
  if (!supabase) return;
  if (table === 'session_songs') await requireSessionAdmin();
  let query = supabase.from(table).delete().eq(column, id);
  if (documentId) query = query.eq('document_id', documentId);
  const { error } = await query;
  if (error) throw new Error(`Could not delete from ${table}: ${errorMessage(error)}`);
}
// Roles live in the user_profiles table (user_id, role); app_metadata.role also counts.
export async function fetchUserRole(userId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[auth] could not read user_profiles role:', error.message);
    return null;
  }
  return (data as { role?: string } | null)?.role ?? null;
}
async function requireSessionAdmin() {
  const { data, error } = await supabase!.auth.getUser();
  if (error) throw error;
  if (data.user?.app_metadata?.role === 'admin') return;
  const role = data.user ? await fetchUserRole(data.user.id) : null;
  if (role !== 'admin') throw new Error('Only admins can change the songs in a session.');
}
export async function uploadImage(file: File, userId: string) {
  requireBackend();
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type))
    throw new Error('Choose a PNG, JPEG, GIF, or WebP image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Images must be smaller than 5 MB.');
  if (!supabase)
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('Could not read image.'));
      r.readAsDataURL(file);
    });
  const path = `${userId}/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
  const { error } = await supabase.storage.from('doc-images').upload(path, file);
  if (error)
    throw new Error(
      `Image upload failed: ${errorMessage(error)}. Check the doc-images bucket and upload policy.`,
    );
  return supabase.storage.from('doc-images').getPublicUrl(path).data.publicUrl;
}

export async function checkConnection() {
  requireBackend();
  if (!supabase)
    return [{ name: 'Local workspace', ok: true, detail: 'Cloud sync is explicitly disabled.' }];
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user)
    throw new Error(`Authentication failed: ${errorMessage(error || 'Sign in again.')}`);
  const tables = Object.keys(emptyData()) as (keyof Data)[];
  return Promise.all(
    tables.map(async (table) => {
      const { error } = await supabase!.from(table).select('user_id', { head: true });
      return {
        name: table,
        ok: !error,
        detail: error ? errorMessage(error) : 'API reachable with your signed-in account.',
      };
    }),
  );
}
