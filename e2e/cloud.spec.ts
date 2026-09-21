import { test, expect } from '@playwright/test';
test('cloud authentication, failed save recovery after reload, and sign out', async ({ page }) => {
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'musician@example.test',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const session = {
    access_token: 'test-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'test-refresh-token',
    user,
  };
  let failWrites = true;
  const docs: Record<string, unknown>[] = [];
  const writes: string[] = [];
  let imageUploadPath = '';
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const reply = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/auth/v1/token') return reply(session);
    if (url.pathname === '/auth/v1/user') return reply(user);
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname.startsWith('/storage/v1/object/doc-images/') && req.method() === 'POST') {
      imageUploadPath = url.pathname;
      return reply({ Key: url.pathname.split('/object/')[1] });
    }
    if (url.pathname.startsWith('/storage/v1/object/public/'))
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
          'base64',
        ),
      });
    if (url.pathname.startsWith('/rest/v1/')) {
      expect(req.headers().apikey).toBe('test-public-key');
      expect(req.headers().authorization).toBe('Bearer test-access-token');
      if (req.method() === 'HEAD') return route.fulfill({ status: 200 });
      if (req.method() === 'GET') return reply(url.pathname.endsWith('/documents') ? docs : []);
      if (failWrites) return reply({ message: 'Simulated connection failure', code: 'TEST' }, 503);
      writes.push(`${req.method()} ${url.pathname}`);
      if (url.pathname.endsWith('/documents')) {
        const rows = req.postDataJSON();
        for (const row of rows) {
          const i = docs.findIndex((d) => d.id === row.id);
          if (i >= 0) docs[i] = row;
          else docs.push(row);
        }
      }
      return route.fulfill({ status: 201, body: '' });
    }
    return reply({ message: 'Unexpected request' }, 400);
  });
  await page.goto('http://127.0.0.1:5184');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Cloud workspace', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New document', exact: true }).click();
  await page.getByLabel('Document title', { exact: true }).fill('Cloud Song');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('textbox', { name: 'Document content' }).fill('Never lose this lyric');
  await expect(page.getByRole('alert')).toContainText('Simulated connection failure');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Document content' })).toContainText(
    'Never lose this lyric',
  );
  await expect(page.getByRole('alert')).toContainText('Simulated connection failure');
  failWrites = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('✓ Saved');
  expect(docs).toHaveLength(1);
  expect(docs[0].user_id).toBe(user.id);
  expect(JSON.stringify(docs[0].content)).toContain('Never lose this lyric');
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem('jammer-draft-11111111-1111-4111-8111-111111111111'),
      ),
    )
    .toBeNull();
  await page.locator('input[type=file]').setInputFiles({
    name: 'note.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.locator('.ql-editor img')).toHaveAttribute(
    'src',
    /\/storage\/v1\/object\/public\/doc-images\//,
  );
  expect(imageUploadPath).toContain(`/doc-images/${user.id}/`);
  await page.getByRole('button', { name: 'New template', exact: true }).click();
  await page.getByLabel('Template name').fill('Cloud Order');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.locator('.sidebar').getByRole('button', { name: 'Sessions', exact: true }).click();
  await page.getByRole('button', { name: 'Create session', exact: true }).first().click();
  await page.getByLabel('Session name').fill('Cloud Practice');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create session', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add songs', exact: true }).first().click();
  await page.getByLabel('Cloud Song').check();
  await page.getByRole('button', { name: 'Add 1 song', exact: true }).click();
  await expect
    .poll(() => writes)
    .toEqual(
      expect.arrayContaining([
        'POST /rest/v1/documents',
        'POST /rest/v1/templates',
        'POST /rest/v1/template_items',
        'POST /rest/v1/sessions',
        'POST /rest/v1/session_songs',
      ]),
    );
  await page.getByRole('button', { name: 'Remove Cloud Song from session' }).click();
  await expect.poll(() => writes).toContain('DELETE /rest/v1/session_songs');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.locator('.sidebar').getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Check API connection' }).click();
  await expect(
    page.getByRole('list', { name: 'API connection results' }).getByRole('listitem'),
  ).toHaveCount(5);
  await expect(page.getByRole('list', { name: 'API connection results' })).not.toContainText('×');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
