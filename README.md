# Jammer Docs — React

React + TypeScript port of the Flutter app in the parent directory. Uses Vite, Quill 2, Supabase, and dnd-kit. The Flutter source is unchanged.

## Run

Requires Node.js 22.12+ (or a compatible newer LTS) and npm.

```sh
cd react-app
npm install
npm run dev
```

Open the localhost URL printed by Vite. The default is a Supabase workspace. Missing or invalid configuration displays a setup screen; the app does not silently save to local storage. To deliberately use the local-only workspace, set `VITE_WORKSPACE_MODE=local` in `react-app/.env`. Existing local data is preserved and remains separate from cloud accounts.

## Connect the existing Supabase backend

React now reads the Flutter app's root `.env` directly. Reuse the original project configuration:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
```

Alternatively, copy `react-app/.env.example` to `react-app/.env` and set:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
VITE_WORKSPACE_MODE=cloud
```

`SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` are supported as alternatives to the anon key. Process environment takes precedence, then `react-app/.env` (including mode-specific files), then the Flutter root `.env`. URL/key pairs are kept together: an incomplete higher-priority configuration produces an error rather than borrowing a key from another project. Vite passes only the validated public pair into the browser. Server secret/service-role keys are rejected.

Restart Vite after changing environment variables; rebuild production assets after changing deployment variables. Configure the same project as Flutter to access the same accounts/data. In Settings, **Check API connection** verifies authentication and access to each of the five database tables. Load/save errors identify the failing table. All data calls go directly to Supabase Auth, PostgREST, and Storage APIs; no separate custom API server is required.

For a new project, run the parent repository's [base schema](../docs/supabase_schema.sql), followed by [sessions schema](../docs/supabase_sessions_schema.sql). These migrations are not automatically executed. Keep row-level security enabled. Create the public `doc-images` storage bucket described in the [existing setup notes](../docs/supabase_schema.md). Authenticated uploads need an INSERT policy on `storage.objects` limited to `bucket_id = 'doc-images'` and `(storage.foldername(name))[1] = auth.uid()::text`. Do not run the repository's scripts that disable RLS.

Sign-up uses the project's email-confirmation policy. Where confirmation is enabled, confirm the email before signing in. Image uploads accept PNG, JPEG, GIF, and WebP up to 5 MB.

The [storage setup script](supabase/storage.sql) creates a missing `doc-images` bucket and owner-scoped insert/select policies. Run it in your project's SQL editor if uploads fail because the bucket or policies are missing. It does not change an existing bucket's settings. A public bucket is required for the image URLs used by both clients.

## Deploy to Netlify

The repository's `.nvmrc` and `netlify.toml` select Node.js 22, run `npm run build`, and publish `dist`. Keep the base directory at the repository root. Node.js 18 is not supported by the installed Vite and Supabase dependencies.

In Netlify's environment variables, set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`) to the project's public browser configuration. Set `VITE_WORKSPACE_MODE=cloud`. These values are intentionally included in the browser bundle; leave **Contains secret values** unchecked when creating them. Never use a server secret or service-role key.

If these public settings were already marked as secrets, recreate them without the secret flag, or set `SECRETS_SCAN_OMIT_KEYS` to only the public variable names reported by the scan. Keep secret scanning enabled for other values. Environment changes require a new deployment.

After pushing configuration changes, trigger a new production deployment. If it fails, inspect the complete deploy log: a secret-scanning failure is separate from a dependency installation or compilation error.

## Features

- Responsive dashboard, library, recent documents, counts, and upcoming sessions.
- Email/password sign-up, sign-in, password visibility, persistent auth, and sign-out in cloud mode.
- Create, rename, delete, and automatically save documents. Explicit save and Ctrl/Cmd+S are also supported.
- Rich text: fonts, sizes, headings, bold, italic, underline, strike-through, color, links, alignment, ordered/bullet/check lists, indentation, clear formatting, undo, redo, and image insertion.
- Smart Paste detects chord sheets on normal paste; the Smart Paste dialog handles manually supplied text. Monospace chord and lyric blocks preserve spaces and alignment.
- Quill Delta storage compatible with Flutter; numeric Flutter font sizes convert to browser CSS lengths and back.
- Templates store an independent document order. New documents remain visible in every template. Templates can be created, renamed, deleted, and reordered.
- Search titles, document text, session names/notes, and templates. Ctrl/Cmd+K opens search.
- Create/edit/delete dated sessions with notes; searchable multi-select song picker prevents duplicates; remove songs and persist setlist ordering.
- Focused read-only session viewer with Previous/Next boundaries, song count, independently scrolling content, a 60% desktop song panel, collapsed rail, and mobile drawer.
- Mouse, touch, and keyboard reordering. Drag the grip; on touch, hold the grip briefly. Keyboard: Space then arrows and Space to drop, or Ctrl+Up/Down on the grip. Reordering preserves the selected song.
- Light/dark/system appearance, native modal focus management and Escape dismissal, reduced-motion styling.
- Queued cloud writes, visible failure/retry state, durable unsynced operations recovered on reload, and unload protection while saves are pending. Initial load failures block edits instead of displaying a misleading empty workspace.

Cloud saves use the original tables and RLS policies. They are not a collaborative live editor: simultaneous edits of the same document use last-write-wins behavior. Local storage is limited by browser quota; large local images may require smaller files or cloud storage. No offline service worker is included.

## Checks

```sh
npm run build
npm test
npm run test:e2e
npm run format:check
```

Browser tests use installed Google Chrome, ports 5183/5184, isolated local storage, and a mocked Supabase API for cloud authentication/save recovery, writes to all five tables, image upload paths, and API diagnostics. They do not write to a real Supabase project. The cloud test server uses the original Flutter `SUPABASE_*` variable names. Change `channel: 'chrome'` in `playwright.config.ts` if you prefer a Playwright-installed browser.

Unit tests cover chord recognition, formatting compatibility, ordering, and replay of persisted mutations. Browser tests cover document/template/session/search flows, persistence, deletion, mobile layout, authentication, and failed-save recovery. Live credentials, email delivery, database policies, and bucket permissions must be verified in your Supabase environment.

## Dependency note

Quill 2.0.3 has an outstanding [HTML-export advisory](https://github.com/advisories/GHSA-v3m3-f69x-jf25). This app stores Delta JSON and renders through Quill; it does not expose HTML export or inject exported HTML. Reassess the advisory before adding HTML export or rendering exported HTML elsewhere.

## Implementation references

- [Quill toolbar](https://quilljs.com/docs/modules/toolbar) and [clipboard](https://quilljs.com/docs/modules/clipboard).
- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords).
- [Vite guide](https://vite.dev/guide/).
