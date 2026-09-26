import { test, expect } from '@playwright/test';

for (const mobile of [false, true]) {
  test(`create a missing song from a session on ${mobile ? 'mobile' : 'desktop'}`, async ({
    page,
  }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      if (localStorage.getItem('jammer-docs-local-v1')) return;
      const now = new Date().toISOString();
      localStorage.setItem(
        'jammer-docs-local-v1',
        JSON.stringify({
          documents: [
            {
              id: 'existing-song',
              user_id: 'local',
              title: 'Existing Song',
              content: [{ insert: 'Existing lyrics\n' }],
              created_at: now,
              updated_at: now,
            },
          ],
          templates: [],
          template_items: [],
          sessions: [
            {
              id: 'practice',
              user_id: 'local',
              name: 'Practice',
              notes: '',
              session_date: null,
              created_at: now,
              updated_at: now,
            },
          ],
          session_songs: [
            {
              session_id: 'practice',
              document_id: 'existing-song',
              user_id: 'local',
              sort_order: 0,
            },
          ],
        }),
      );
    });
    await page.goto('/#session/practice');
    await page.getByRole('button', { name: 'Add songs', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: /Existing Song/ })).toBeDisabled();
    await page.getByRole('textbox', { name: 'Search songs' }).fill('Brand New Song');
    await expect(page.getByText('No songs found.', { exact: false })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('missing-song.png'), fullPage: true });
    await page.getByRole('button', { name: 'Create new song', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Create new song', exact: true });
    await expect(form.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
      'Brand New Song',
    );
    await form.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.song-select')).toHaveCount(1);
    await page.getByRole('button', { name: 'Add songs', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search songs' }).fill('Brand New Song');
    await page.getByRole('button', { name: 'Create new song', exact: true }).click();
    await form.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('textbox', { name: 'Document content' }).fill('New lyrics for practice');
    await page.goto('/#session/practice');
    await expect(page.locator('.song-select')).toHaveCount(2);
    await expect(page.locator('.song-select').nth(0)).toContainText('Existing Song');
    await expect(page.locator('.song-select').nth(1)).toContainText('Brand New Song');
    await page.locator('.song-select').nth(1).click();
    await expect(page.locator('.song-content')).toContainText('New lyrics for practice');
    await page.reload();
    await expect(page.locator('.song-select')).toHaveCount(2);
    await page.locator('.song-select').nth(1).click();
    await expect(page.locator('.song-content')).toContainText('New lyrics for practice');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
