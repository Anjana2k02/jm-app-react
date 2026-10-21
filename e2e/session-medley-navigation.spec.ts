import { test, expect } from '@playwright/test';

for (const mobile of [false, true]) {
  test(`top navigation moves through songs inside medleys on ${mobile ? 'mobile' : 'desktop'}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      const now = new Date().toISOString();
      const base = { user_id: 'local', created_at: now, updated_at: now };
      localStorage.setItem(
        'jammer-docs-local-v1',
        JSON.stringify({
          documents: [
            {
              ...base,
              id: 'opening',
              title: 'Opening',
              content: [{ insert: 'Opening lyrics\n', attributes: { songKey: 'G' } }],
            },
            {
              ...base,
              id: 'medley',
              title: 'My medley',
              song_type: 'medley',
              content: [
                { insert: { medleySong: { id: 'one', name: 'First part', key: 'C' } } },
                { insert: 'First part lyrics\n' },
                { insert: { medleySong: { id: 'two', name: 'Second part', key: 'Am' } } },
                { insert: 'Second part lyrics\n' },
              ],
            },
            {
              ...base,
              id: 'closing',
              title: 'Closing',
              content: [{ insert: 'Closing lyrics\n', attributes: { songKey: 'D' } }],
            },
          ],
          sessions: [{ ...base, id: 'practice', name: 'Practice', notes: '', session_date: null }],
          session_songs: ['opening', 'medley', 'closing'].map((document_id, sort_order) => ({
            user_id: 'local',
            session_id: 'practice',
            document_id,
            sort_order,
          })),
          templates: [],
          template_items: [],
        }),
      );
    });
    await page.goto('/#session/practice');
    if (mobile) await expect(page.getByRole('button', { name: 'Expand song panel' })).toBeVisible();
    await page.getByRole('button', { name: 'Live Mode', exact: true }).click();
    const next = page.getByRole('button', { name: 'Next', exact: true });
    const previous = page.getByRole('button', { name: 'Previous', exact: true });
    const key = page.locator('.song-key-display');
    const content = page.locator('.rich-viewer');
    await expect(previous).toBeDisabled();
    await expect(key).toHaveText('G');
    await expect(page.locator('.live-next-song')).toContainText('First part');
    await expect(page.locator('.up-next-key')).toHaveText('C');
    await expect(page.locator('.up-next-key')).toBeVisible();
    await next.click();
    await expect(content).toContainText('First part lyrics');
    await expect(key).toHaveText('C');
    await expect(page.locator('.live-next-song')).toContainText('Second part');
    await expect(page.locator('.up-next-key')).toHaveText('Am');
    await expect(page.getByRole('button', { name: 'Next song', exact: true })).toHaveCount(0);
    await next.click();
    await expect(content).toContainText('Second part lyrics');
    await expect(key).toHaveText('Am');
    await expect(page.locator('.song-navigation-center')).toContainText('3 / 4');
    await expect(page.locator('.live-next-song')).toContainText('Closing');
    await expect(page.locator('.up-next-key')).toHaveText('D');
    await next.click();
    await expect(content).toContainText('Closing lyrics');
    await expect(next).toBeDisabled();
    await expect(page.locator('.up-next-key')).toHaveCount(0);
    await previous.click();
    await expect(content).toContainText('Second part lyrics');
    await expect(key).toHaveText('Am');
    await previous.click();
    await expect(content).toContainText('First part lyrics');
    await previous.click();
    await expect(content).toContainText('Opening lyrics');
    await expect(previous).toBeDisabled();
    await expect(page.locator('.session-detail')).toHaveClass(/live-mode/);
  });
}
