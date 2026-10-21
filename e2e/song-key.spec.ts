import { test, expect } from '@playwright/test';

test('ordinary song keys survive lyric edits and update in the top session navigation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    if (localStorage.getItem('jammer-docs-local-v1')) return;
    localStorage.setItem(
      'jammer-docs-local-v1',
      JSON.stringify({
        documents: ['First', 'Second'].map((title, i) => ({
          id: `song-${i}`,
          user_id: 'local',
          title,
          content: [{ insert: `${title} lyrics\n` }],
          created_at: now,
          updated_at: now,
        })),
        sessions: [
          {
            id: 'practice',
            user_id: 'local',
            name: 'Practice',
            session_date: null,
            notes: '',
            created_at: now,
            updated_at: now,
          },
        ],
        session_songs: [0, 1].map((i) => ({
          session_id: 'practice',
          document_id: `song-${i}`,
          user_id: 'local',
          sort_order: i,
        })),
        templates: [],
        template_items: [],
      }),
    );
  });
  await page.goto('/#documents/song-0');
  await page.getByLabel('Song key', { exact: true }).fill('F#m');
  await page.getByRole('textbox', { name: 'Document content' }).fill('Edited lyrics');
  await page.reload();
  await expect(page.getByLabel('Song key', { exact: true })).toHaveValue('F#m');
  await expect(page.getByRole('textbox', { name: 'Document content' })).toContainText(
    'Edited lyrics',
  );
  await page.goto('/#session/practice');
  await expect(page.locator('.song-navigation .song-key-display')).toHaveText('F#m');
  await page.getByRole('button', { name: 'Live Mode', exact: true }).click();
  await expect(page.locator('.song-navigation .song-key-display')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.song-navigation .song-key-display')).toHaveCount(0);
});
