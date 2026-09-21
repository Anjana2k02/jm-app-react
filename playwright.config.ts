import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://127.0.0.1:5183',
    browserName: 'chromium',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev -- --port 5183 --strictPort',
      url: 'http://127.0.0.1:5183',
      env: { WORKSPACE_MODE: 'local', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    },
    {
      command: 'npm run dev -- --port 5184 --strictPort',
      url: 'http://127.0.0.1:5184',
      env: {
        WORKSPACE_MODE: 'cloud',
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_ANON_KEY: 'test-public-key',
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_ANON_KEY: '',
      },
    },
  ],
  reporter: 'list',
});
