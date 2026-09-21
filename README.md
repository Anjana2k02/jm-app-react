# Jammer Docs — React

React + TypeScript port of the Flutter app in the parent directory. Uses Vite, Quill 2, Supabase, and dnd-kit. The Flutter source is unchanged.

## Run

Requires Node.js 22.12+ within the 22.x release line and npm, matching the Vercel build configuration.

```sh
cd react-app
npm install
npm run dev
```

Open the localhost URL printed by Vite. The default is a Supabase workspace. Missing or invalid configuration displays a setup screen; the app does not silently save to local storage. To deliberately use the local-only workspace, set `WORKSPACE_MODE=local` in `react-app/.env`. Existing local data is preserved and remains separate from cloud accounts.

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
WORKSPACE_MODE=cloud
```

`SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` are supported as alternatives to the anon key. Process environment takes precedence, then `react-app/.env` (including mode-specific files), then the Flutter root `.env`. URL/key pairs are kept together: an incomplete higher-priority configuration produces an error rather than borrowing a key from another project. Vite passes only the validated public pair into the browser. Server secret/service-role keys are rejected.

Restart Vite after changing environment variables; rebuild production assets after changing deployment variables. Configure the same project as Flutter to access the same accounts/data. In Settings, **Check API connection** verifies authentication and access to each of the five database tables. Load/save errors identify the failing table. All data calls go directly to Supabase Auth, PostgREST, and Storage APIs; no separate custom API server is required.

For a new project, run the parent repository's [base schema](../docs/supabase_schema.sql), followed by [sessions schema](../docs/supabase_sessions_schema.sql). These migrations are not automatically executed. Keep row-level security enabled. Create the public `doc-images` storage bucket described in the [existing setup notes](../docs/supabase_schema.md). Authenticated uploads need an INSERT policy on `storage.objects` limited to `bucket_id = 'doc-images'` and `(storage.foldername(name))[1] = auth.uid()::text`. Do not run the repository's scripts that disable RLS.

Sign-up uses the project's email-confirmation policy. Where confirmation is enabled, confirm the email before signing in. Image uploads accept PNG, JPEG, GIF, and WebP up to 5 MB.

The [storage setup script](supabase/storage.sql) creates a missing `doc-images` bucket and owner-scoped insert/select policies. Run it in your project's SQL editor if uploads fail because the bucket or policies are missing. It does not change an existing bucket's settings. A public bucket is required for the image URLs used by both clients.

## Deploy to Vercel

The repository's `vercel.json` selects the Vite framework, installs the locked dependencies with `npm ci`, runs `npm run build`, and publishes `dist`. `package.json` selects Node.js 22.x for Vercel, matching the local `.nvmrc`. See [Vercel's Vite guide](https://vercel.com/docs/frameworks/frontend/vite) and [Node.js version configuration](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

1. In Vercel, create a new project and import this Git repository.
2. Keep **Root Directory** at the repository root (the directory containing `package.json` and `vercel.json`). The framework is **Vite**, the build command is **npm run build**, and the output directory is **dist**.
3. Add the following environment variables for **Production** and, if needed, **Preview**:

   ```dotenv
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
   WORKSPACE_MODE=cloud
   ```

   `SUPABASE_ANON_KEY` can replace `SUPABASE_PUBLISHABLE_KEY` for projects using an anon key. This app's Vite configuration explicitly reads these `SUPABASE_*` variables; they do not need a `VITE_` prefix. These are public browser credentials included in the build. Never use a server secret or service-role key.

4. Deploy and open the production HTTPS address. Environment-variable changes require a new deployment.

The app uses hash routes such as `/#settings`, so no catch-all rewrite is needed. Vercel serves the manifest and app icons directly from the build output. After changing hosting domains, update the Supabase Auth Site URL to the new production address so confirmation emails return to this app. Re-add the home-screen app from the new address; a shortcut installed from the previous domain keeps opening that domain. Local-only data stays with its original browser origin; export a backup before moving if needed. Cloud users can sign in with the same account.

## Add to your phone's home screen

Deploy the latest build to your HTTPS Vercel address, then open that address on your phone. The app includes a web app manifest, a purple music-note logo, Android icons (including a maskable icon), and an Apple touch icon. Home-screen launches open in a standalone app window.

- **Android / Chrome:** open **Settings** in Jammer Docs and tap **Install Jammer Docs** when offered. Alternatively, use Chrome's menu → **Add to Home screen** / **Install app**.
- **iPhone / iPad:** open the site in Safari, tap **Share** → **Add to Home Screen**, leave **Open as Web App** enabled if shown, then tap **Add**.

The Settings page also includes these instructions. The install button appears only when the browser offers an installation prompt. Installation requires HTTPS (localhost works for development; a plain HTTP LAN address does not satisfy the install requirement). Opening the app and cloud sync still require an internet connection; no offline caching is added. Sign in with the same cloud account to access your existing workspace; local-only browser data does not transfer between devices.

The editable logo is `public/icons/logo.svg`. After changing it, run `node scripts/generate-icons.mjs` with Google Chrome installed to regenerate the committed PNG icons. See [MDN's installation guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) and [Apple's home-screen instructions](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).

## Session gestures and admin permissions

Session song cards have no delete button or drag handle. Admins can swipe a card left to remove it **from that session only**, with an **Undo** action, or hold the card for one second before dragging it to a new position. Short swipes and normal vertical scrolling do not remove songs. Keyboard users can focus a card and press Ctrl+Up/Down to reorder or Delete to remove it. Regular cloud users can select songs, navigate the session, and use Live Mode; adding, removing, and reordering session songs are admin-only.

Cloud admin access uses the protected Supabase `app_metadata.role` field with the exact value `admin`. Missing roles and all other values are regular users. User-editable `user_metadata` is never used for authorization. The explicitly selected local-only workspace has no accounts or roles; its single device owner retains editing access. Use `WORKSPACE_MODE=cloud` for shared deployments with role enforcement.

Before deploying this feature, run [supabase/session-admin.sql](supabase/session-admin.sql) in your Supabase SQL editor. It adds restrictive write policies alongside existing read policies and checks protected account metadata on every database request. A trigger also prevents regular users from bypassing permissions through cascading deletion of a parent document or session. Trusted SQL-editor and service-role maintenance remains possible. The frontend additionally checks permissions before setlist mutations and rechecks the current user before submitting queued setlist writes. The SQL migration is required for security against direct API requests; deploying the frontend alone does not install database policies.

Assign the role to each intended administrator through a trusted Supabase admin workflow. For example, replace the UUID below and run this in the SQL editor (never in browser code):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where id = 'REPLACE-WITH-ADMIN-USER-UUID'::uuid;
```

Sign out and sign back in after assigning a role so the app receives the updated metadata. The migration does not automatically promote any account. See [Supabase's authorization guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

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
- **Live Mode** beside the session name fills the screen with the song, Previous/Next controls, and the next song title at the top right. Double-tap (or double-click) the song area to exit or enter again; Escape also exits. The selected song, scroll position, and setlist panel state are preserved when toggling. Browsers without native fullscreen support use a full-window view; installed home-screen apps already run in their own window. See [Fullscreen API support](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen).
- Admin-only session song gestures: swipe left to remove with Undo, hold one second to reorder, or use Ctrl+Up/Down and Delete on a focused song card. Reordering preserves the selected song. Template lists retain their existing drag grips and keyboard controls.
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
