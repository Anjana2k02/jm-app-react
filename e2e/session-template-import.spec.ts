import { test, expect } from '@playwright/test';

for (const mobile of [false, true]) {
  test(`imports only template members in order without duplicates on ${mobile ? 'mobile' : 'desktop'}`, async ({
    page,
  }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      if (localStorage.getItem('jammer-docs-local-v1')) return;
      const now = new Date().toISOString();
      const base = { user_id: 'local', created_at: now, updated_at: now };
      localStorage.setItem(
        'jammer-docs-local-v1',
        JSON.stringify({
          documents: ['Existing', 'Second', 'First', 'Unrelated'].map((title, i) => ({
            ...base,
            id: `song-${i}`,
            title,
            content: [{ insert: `${title} lyrics\n` }],
            song_type: i === 1 ? 'medley' : 'song',
          })),
          templates: [
            { ...base, id: 'template', name: 'Sunday set' },
            { ...base, id: 'empty', name: 'Empty set' },
          ],
          template_items: [
            { template_id: 'template', document_id: 'song-1', sort_order: 2, user_id: 'local' },
            { template_id: 'template', document_id: 'song-2', sort_order: 0, user_id: 'local' },
            { template_id: 'template', document_id: 'song-0', sort_order: 1, user_id: 'local' },
            {
              template_id: 'template',
              document_id: 'missing-song',
              sort_order: 3,
              user_id: 'local',
            },
          ],
          sessions: ['practice', 'other'].map((id) => ({
            ...base,
            id,
            name: id,
            notes: '',
            session_date: null,
          })),
          session_songs: ['practice', 'other'].map((session_id) => ({
            session_id,
            document_id: 'song-0',
            user_id: 'local',
            sort_order: 0,
          })),
        }),
      );
    });
    await page.goto('/#session/practice');
    if (mobile) await page.getByRole('button', { name: 'Expand song panel' }).click();
    await page.getByRole('button', { name: 'Add songs', exact: true }).click();
    const popup = page.getByRole('dialog', { name: 'Add songs', exact: true });
    // A selection in Songs must not be imported when using Templates.
    await popup.getByRole('checkbox', { name: 'Unrelated', exact: true }).check();
    await popup.getByRole('button', { name: 'Templates', exact: true }).click();
    await expect(popup.getByRole('button', { name: 'Templates', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(popup.getByRole('radio', { name: /Empty set/ })).toBeDisabled();
    await popup.getByRole('textbox', { name: 'Search templates' }).fill('missing');
    await expect(popup.getByText('No templates found.', { exact: true })).toBeVisible();
    await popup.getByRole('textbox', { name: 'Search templates' }).fill('Sunday');
    await popup.getByRole('radio', { name: /Sunday set/ }).check();
    await expect(popup.getByRole('button', { name: 'Add 2 songs', exact: true })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath('template-import.png'), fullPage: true });
    await popup.getByRole('button', { name: 'Add 2 songs', exact: true }).click();
    await expect(popup).toBeHidden();
    await expect(page.locator('.song-select strong')).toHaveText(['Existing', 'First', 'Second']);
    await page.reload();
    if (mobile) await page.getByRole('button', { name: 'Expand song panel' }).click();
    await expect(page.locator('.song-select strong')).toHaveText(['Existing', 'First', 'Second']);
    await page.getByRole('button', { name: 'Add songs', exact: true }).click();
    await popup.getByRole('button', { name: 'Templates', exact: true }).click();
    await expect(popup.getByRole('radio', { name: /Sunday set/ })).toBeDisabled();
    await expect(popup.getByText('Already added', { exact: true })).toBeVisible();
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('jammer-docs-local-v1')!),
    );
    expect(
      stored.session_songs.filter((row: { session_id: string }) => row.session_id === 'other'),
    ).toHaveLength(1);
    expect(stored.template_items).toHaveLength(4);
  });
}
