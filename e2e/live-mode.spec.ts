import { test, expect, type Page } from '@playwright/test';

async function openSession(page: Page, empty = false) {
  await page.addInitScript(
    ({ empty }) => {
      const now = new Date().toISOString();
      const documents = [
        'Morning Song',
        'Evening Song — a quiet moment before the encore',
        'Final Song',
      ].map((title, i) => ({
        id: `song-${i}`,
        user_id: 'local',
        title,
        content: Array.from({ length: 60 }, (_, line) => ({
          insert: `Line ${line + 1}: C    G    Am    F\n`,
          attributes: { font: 'Courier New' },
        })),
        created_at: now,
        updated_at: now,
      }));
      localStorage.setItem('jammer-theme', 'dark');
      localStorage.setItem(
        'jammer-docs-local-v1',
        JSON.stringify({
          documents,
          templates: [],
          template_items: [],
          sessions: [
            {
              id: 'live-session',
              user_id: 'local',
              name: 'Session 1',
              notes: '',
              session_date: null,
              created_at: now,
              updated_at: now,
            },
          ],
          session_songs: empty
            ? []
            : documents.map((doc, i) => ({
                session_id: 'live-session',
                user_id: 'local',
                document_id: doc.id,
                sort_order: i,
              })),
        }),
      );
    },
    { empty },
  );
  await page.goto('/#session/live-session');
  await expect(page.getByRole('heading', { name: 'Session 1' })).toBeVisible();
}

test('Live Mode enters fullscreen, keeps navigation, and toggles without losing the song or scroll', async ({
  page,
}, testInfo) => {
  await openSession(page);
  const root = page.locator('.session-detail');
  const content = page.locator('.song-content');
  await page.getByRole('button', { name: 'Collapse song panel' }).click();
  await content.evaluate((el) => {
    el.scrollTop = 300;
  });
  await page.getByRole('button', { name: 'Live Mode' }).click();
  await expect(root).toHaveClass(/live-mode/);
  await expect
    .poll(() =>
      page.evaluate(() => document.fullscreenElement?.classList.contains('session-detail')),
    )
    .toBe(true);
  await expect(page.locator('.session-header')).toBeHidden();
  await expect(page.locator('.song-panel')).toBeHidden();
  await expect(page.locator('.live-next-song')).toContainText('Evening Song');
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  expect(await content.evaluate((el) => el.scrollTop)).toBe(300);
  await content.dblclick({ position: { x: 100, y: 150 } });
  await expect(root).not.toHaveClass(/live-mode/);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(page.getByRole('button', { name: 'Expand song panel' })).toBeVisible();
  expect(await content.evaluate((el) => el.scrollTop)).toBe(300);
  await content.dblclick({ position: { x: 100, y: 150 } });
  await expect(root).toHaveClass(/live-mode/);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(content.locator('h1')).toContainText('Evening Song');
  await expect(page.locator('.live-next-song')).toContainText('Final Song');
  expect(await content.evaluate((el) => el.scrollTop)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('live-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.live-next-song')).toContainText('Last song');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(content.locator('h1')).toContainText('Evening Song');
  // The browser's own fullscreen exit must also restore the session layout.
  await page.evaluate(() => document.exitFullscreen());
  await expect(root).not.toHaveClass(/live-mode/);
});

test.describe('touch Live Mode', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('double taps toggle the fallback view while swipes and navigation keep it open', async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = () =>
        Promise.reject(new Error('Fullscreen unavailable'));
    });
    await openSession(page);
    await page.locator('.song-select').first().tap();
    await page.getByRole('button', { name: 'Live Mode' }).tap();
    const root = page.locator('.session-detail');
    const content = page.locator('.song-content');
    await expect(root).toHaveClass(/live-mode/);
    await expect(page.locator('.song-panel')).toBeHidden();
    await expect(page.locator('.live-next-song')).toContainText('Evening Song');
    const bounds = (await root.boundingBox())!;
    expect(bounds.x).toBe(0);
    expect(bounds.y).toBe(0);
    // Browser device scaling can introduce subpixel rounding.
    expect(Math.abs(bounds.width - 390)).toBeLessThan(1);
    expect(Math.abs(bounds.height - 844)).toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath('live-mobile.png'), fullPage: true });
    const doubleTap = async () => {
      const box = (await content.boundingBox())!;
      await page.touchscreen.tap(box.x + 120, box.y + 170);
      await page.touchscreen.tap(box.x + 120, box.y + 170);
    };
    await doubleTap();
    await expect(root).not.toHaveClass(/live-mode/);
    await doubleTap();
    await expect(root).toHaveClass(/live-mode/);
    // A drag must not count as the first tap of a double-tap gesture.
    const pointer = {
      pointerType: 'touch',
      pointerId: 7,
      isPrimary: true,
      clientX: 120,
      clientY: 300,
    };
    await content.dispatchEvent('pointerdown', pointer);
    await content.dispatchEvent('pointermove', { ...pointer, clientY: 220 });
    await content.dispatchEvent('pointerup', { ...pointer, clientY: 220 });
    await page.touchscreen.tap(120, 300);
    await expect(root).toHaveClass(/live-mode/);
    await page.getByRole('button', { name: 'Next', exact: true }).tap();
    await expect(content.locator('h1')).toContainText('Evening Song');
    await expect(root).toHaveClass(/live-mode/);
    await page.keyboard.press('Escape');
    await expect(root).not.toHaveClass(/live-mode/);
    await expect(page.getByRole('button', { name: 'Expand song panel' })).toBeVisible();
  });
});

test('empty sessions cannot enter Live Mode', async ({ page }) => {
  await openSession(page, true);
  await expect(page.getByRole('button', { name: 'Live Mode' })).toBeDisabled();
});
