import { test, expect, type Page } from '@playwright/test';

async function openCloudSession(page: Page, admin: boolean) {
  const now = new Date().toISOString();
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'session@example.test',
    created_at: now,
    app_metadata: { provider: 'email', role: admin ? 'admin' : 'user' },
    // A regular account claiming to be an admin in editable metadata stays regular.
    user_metadata: { role: 'admin' },
  };
  const documents = ['First Song', 'Second Song', 'Third Song'].map((title, i) => ({
    id: `song-${i}`,
    user_id: user.id,
    title,
    content: [{ insert: `${title} lyrics\n` }],
    created_at: now,
    updated_at: now,
  }));
  let items = documents.map((song, i) => ({
    session_id: 'session-1',
    document_id: song.id,
    user_id: user.id,
    sort_order: i,
  }));
  const mutations: string[] = [];
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const reply = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/auth/v1/token')
      return reply({
        access_token: 'test-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        user,
      });
    if (url.pathname === '/auth/v1/user') return reply(user);
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    const table = url.pathname.split('/').pop();
    if (req.method() === 'GET') {
      if (table === 'documents') return reply(documents);
      if (table === 'sessions')
        return reply([
          {
            id: 'session-1',
            user_id: user.id,
            name: 'Practice',
            session_date: null,
            notes: '',
            created_at: now,
            updated_at: now,
          },
        ]);
      return reply(table === 'session_songs' ? items : []);
    }
    mutations.push(`${req.method()} ${table}`);
    if (table === 'session_songs') {
      if (!admin)
        return reply({ message: 'Only admins can change session songs', code: '42501' }, 403);
      if (req.method() === 'POST') {
        for (const row of req.postDataJSON()) {
          items = items.filter((item) => item.document_id !== row.document_id);
          items.push(row);
        }
      } else if (req.method() === 'DELETE') {
        items = items.filter(
          (item) => `eq.${item.document_id}` !== url.searchParams.get('document_id'),
        );
      }
    }
    return reply(null, 201);
  });
  await page.goto('http://127.0.0.1:5184');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Cloud workspace', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    location.hash = 'session/session-1';
  });
  await expect(page.locator('.song-select')).toHaveCount(3);
  return { mutations, documents };
}

async function touchGesture(page: Page, index: number, dx: number, dy: number, hold = 0) {
  const box = (await page.locator('.song-select').nth(index).boundingBox())!;
  const x = box.x + box.width * 0.7,
    y = box.y + box.height / 2;
  const client = await page.context().newCDPSession(page);
  const point = (x: number, y: number) => [{ x, y, id: 1 }];
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(x, y) });
  if (hold) await page.waitForTimeout(hold);
  for (let step = 1; step <= 10; step++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(x + (dx * step) / 10, y + (dy * step) / 10),
    });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
}

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

test('admins swipe to remove only the session entry, undo, and hold one second to reorder', async ({
  page,
}, testInfo) => {
  const { mutations, documents } = await openCloudSession(page, true);
  await expect(page.locator('.song-panel .drag-handle')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Remove .* from session/ })).toHaveCount(0);
  await touchGesture(page, 1, -40, 0);
  await expect(page.locator('.song-select')).toHaveCount(3);
  await touchGesture(page, 1, -120, 0);
  await expect(page.locator('.song-select')).toHaveCount(2);
  await expect(page.locator('.session-undo')).toContainText('Removed Second Song');
  await expect.poll(() => mutations).toContain('DELETE session_songs');
  expect(documents).toHaveLength(3);
  await page.getByRole('button', { name: 'Undo', exact: true }).tap();
  await expect(page.locator('.song-select strong')).toHaveText([
    'First Song',
    'Second Song',
    'Third Song',
  ]);
  // Moving before the hold threshold scrolls/cancels instead of reordering.
  await touchGesture(page, 2, 0, -100, 200);
  await expect(page.locator('.song-select strong')).toHaveText([
    'First Song',
    'Second Song',
    'Third Song',
  ]);
  const first = (await page.locator('.song-select').first().boundingBox())!;
  const last = (await page.locator('.song-select').last().boundingBox())!;
  await touchGesture(page, 2, 0, first.y - last.y, 1100);
  await expect(page.locator('.song-select strong')).toHaveText([
    'Third Song',
    'First Song',
    'Second Song',
  ]);
  await expect(page.locator('.song-content h1')).toHaveText('First Song');
  await page.screenshot({
    path: testInfo.outputPath('session-gestures-admin.png'),
    fullPage: true,
  });
  await expect
    .poll(() => mutations.filter((m) => m === 'POST session_songs').length)
    .toBeGreaterThanOrEqual(3);
  await page.reload();
  await expect(page.locator('.song-select strong')).toHaveText([
    'Third Song',
    'First Song',
    'Second Song',
  ]);
});

test('regular users cannot swipe, drag, use mutation shortcuts, or submit setlist writes', async ({
  page,
}, testInfo) => {
  const { mutations } = await openCloudSession(page, false);
  await expect(page.getByRole('button', { name: 'Add songs', exact: true })).toHaveCount(0);
  await expect(page.locator('#session-gesture-help')).toHaveCount(0);
  await touchGesture(page, 1, -120, 0);
  await touchGesture(page, 2, 0, -190, 1100);
  await page.locator('.song-select').nth(1).focus();
  await page.keyboard.press('Control+ArrowUp');
  await page.keyboard.press('Delete');
  await expect(page.locator('.song-select strong')).toHaveText([
    'First Song',
    'Second Song',
    'Third Song',
  ]);
  const errors = await page.evaluate(async () => {
    const path = '/src/backend.ts';
    const backend = await import(path);
    const errors: string[] = [];
    for (const operation of [
      () =>
        backend.upsert('session_songs', [
          { session_id: 'session-1', document_id: 'song-0', sort_order: 2 },
        ]),
      () => backend.remove('session_songs', 'session_id', 'session-1', 'song-0'),
    ]) {
      try {
        await operation();
      } catch (error) {
        errors.push(String(error));
      }
    }
    return errors;
  });
  expect(errors).toHaveLength(2);
  expect(errors.every((message) => message.includes('Only admins'))).toBe(true);
  expect(mutations).toEqual([]);
  await page.locator('.song-select').nth(1).tap();
  await expect(page.locator('.song-content h1')).toHaveText('Second Song');
  await page.getByRole('button', { name: 'Next', exact: true }).tap();
  await expect(page.locator('.song-content h1')).toHaveText('Third Song');
  await page.screenshot({
    path: testInfo.outputPath('session-gestures-reader.png'),
    fullPage: true,
  });
});
