import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolveSupabaseConfig, validateSupabaseConfig } from './src/config';

export default defineConfig(({ mode }) => {
  const appDir = fileURLToPath(new URL('.', import.meta.url));
  const rootDir = fileURLToPath(new URL('..', import.meta.url));
  const appEnv = loadEnv(mode, appDir, ['VITE_', 'SUPABASE_']);
  const rootEnv = loadEnv(mode, rootDir, ['SUPABASE_']);
  const workspaceMode = appEnv.VITE_WORKSPACE_MODE || 'cloud';
  const config = resolveSupabaseConfig(process.env, appEnv, rootEnv);
  const error = validateSupabaseConfig(config.url, config.key, workspaceMode);
  return {
    plugins: [react()],
    // Expose only the validated public pair, never the contents of the root .env.
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        error || workspaceMode === 'local' ? '' : config.url,
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        error || workspaceMode === 'local' ? '' : config.key,
      ),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(''),
      'import.meta.env.VITE_SUPABASE_CONFIG_ERROR': JSON.stringify(error),
      'import.meta.env.VITE_WORKSPACE_MODE': JSON.stringify(workspaceMode),
    },
    build: { rollupOptions: { output: { manualChunks: { editor: ['quill'] } } } },
  };
});
