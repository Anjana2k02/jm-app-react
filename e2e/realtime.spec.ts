import { test, expect, type Page } from '@playwright/test';

test('admin reorder pushes to every viewer without refetching or changing their current song', async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const now = new Date().toISOString();
  const docs = ['Alpha', 'Bravo', 'Charlie'].map((title, index) => ({
    id: `doc-${index}`,
    user_id: 'admin',
    title,
    content: [{ insert: `${title} lyrics\n` }],
    created_at: now,
    updated_at: now,
  }));
  let rows = docs.map((doc, sort_order) => ({
    session_id: 'practice',
    document_id: doc.id,
    user_id: 'admin',
    sort_order,
  }));
  const listeners: ((record: (typeof rows)[number]) => void)[] = [];
  const readCounts = [0, 0, 0];
  let rejectWrites = false;
  async function connect(page: Page, index: number) {
    const user = {
      id: index === 0 ? 'admin' : `viewer-${index}`,
      email: `user${index}@example.test`,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { role: index === 0 ? 'admin' : 'user' },
      user_metadata: {},
      created_at: now,
    };
    await page.route('http://127.0.0.1:54321/**', async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      const reply = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (path === '/auth/v1/token')
        return reply({
          access_token: 'test-access-token',
          refresh_token: 'refresh',
          token_type: 'bearer',
          expires_in: 3600,
          user,
        });
      if (path === '/auth/v1/user') return reply(user);
      if (path === '/rest/v1/user_profiles') return reply({ role: user.app_metadata.role });
      if (req.method() === 'GET') {
        readCounts[index]++;
        if (path.endsWith('/documents')) return reply(docs);
        if (path.endsWith('/session_songs')) return reply(rows);
        if (path.endsWith('/sessions'))
          return reply([
            {
              id: 'practice',
              user_id: 'admin',
              name: 'Practice',
              notes: '',
              session_date: null,
              created_at: now,
              updated_at: now,
            },
          ]);
        return reply([]);
      }
      if (path.endsWith('/session_songs') && req.method() === 'POST') {
        if (index !== 0 || rejectWrites)
          return reply({ message: 'Permission denied', code: '42501' }, 403);
        rows = req.postDataJSON();
        await route.fulfill({ status: 201, body: '' });
        rows.forEach((row) => listeners.forEach((send) => send(row)));
        return;
      }
      return reply({ message: 'Unexpected request' }, 400);
    });
    await page.routeWebSocket('ws://127.0.0.1:54321/realtime/v1/**', (socket) => {
      socket.onMessage((raw) => {
        const [joinRef, ref, topic, event, payload] = JSON.parse(String(raw));
        if (event === 'phx_join') {
          const filters = payload.config.postgres_changes.map(
            (filter: Record<string, unknown>, i: number) => ({ ...filter, id: i + 1 }),
          );
          socket.send(
            JSON.stringify([
              joinRef,
              ref,
              topic,
              'phx_reply',
              { status: 'ok', response: { postgres_changes: filters } },
            ]),
          );
          const id = filters.find(
            (filter: { table: string }) => filter.table === 'session_songs',
          ).id;
          listeners.push((record) =>
            socket.send(
              JSON.stringify([
                joinRef,
                null,
                topic,
                'postgres_changes',
                {
                  ids: [id],
                  data: {
                    schema: 'public',
                    table: 'session_songs',
                    type: 'UPDATE',
                    commit_timestamp: new Date().toISOString(),
                    record,
                    old_record: {},
                    errors: [],
                    columns: Object.keys(record).map((name) => ({
                      name,
                      type: name === 'sort_order' ? 'int4' : 'text',
                    })),
                  },
                },
              ]),
            ),
          );
        } else if (event === 'heartbeat' || event === 'phx_leave') {
          socket.send(
            JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]),
          );
        }
      });
    });
    await page.goto('http://127.0.0.1:5184/#session/practice');
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Practice', exact: true })).toBeVisible();
    await expect(page.getByText('Connecting to live updates…', { exact: true })).toBeHidden();
  }
  try {
    for (const [index, page] of pages.entries()) await connect(page, index);
    const [admin, viewer, otherViewer] = pages;
    await viewer.getByRole('button', { name: 'Live Mode', exact: true }).click();
    const before = [...readCounts];
    await admin.locator('.song-select').first().focus();
    await admin.keyboard.press('Control+ArrowDown');
    for (const page of [viewer, otherViewer]) {
      await expect(page.getByText('Session updated', { exact: true })).toBeVisible({
        timeout: 1500,
      });
      await expect(page.locator('.song-select').first()).toContainText('Bravo');
      await expect(page.locator('.song-content h1')).toHaveText('Alpha');
    }
    expect(readCounts).toEqual(before);
    await expect(viewer.locator('.session-detail')).toHaveClass(/live-mode/);
    await expect(viewer.getByText('Session updated', { exact: true })).toBeHidden({
      timeout: 4000,
    });
    // A rejected admin write must not be broadcast as a successful update.
    rejectWrites = true;
    await admin.locator('.song-select').first().focus();
    await admin.keyboard.press('Control+ArrowDown');
    await expect(admin.getByRole('alert').filter({ hasText: 'Permission denied' })).toBeVisible();
    await expect(otherViewer.locator('.song-select').first()).toContainText('Bravo');
    await expect(otherViewer.getByText('Session updated', { exact: true })).toBeHidden();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
