import { test, expect } from '@playwright/test';
test('rich text formatting, undo/redo, and image persistence', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New document', exact: true }).click();
  await page.getByLabel('Document title', { exact: true }).fill('Formatted Song');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Document content' });
  await editor.fill('A line with feeling');
  await editor.press('Control+a');
  await page.getByRole('button', { name: 'bold', exact: true }).click();
  await expect(page.locator('.ql-editor strong')).toContainText('A line with feeling');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.ql-editor strong')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.ql-editor strong')).toContainText('A line with feeling');
  await page.locator('input[type=file]').setInputFiles({
    name: 'note.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.locator('.ql-editor img')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('✓ Saved');
  await page.reload();
  await expect(page.locator('.ql-editor img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect(page.locator('.ql-editor strong')).toContainText('A line with feeling');
});
test('document editing, smart paste, templates, sessions, search, and persistence', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.screenshot({ path: testInfo.outputPath('home-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'New document', exact: true }).click();
  await page.getByLabel('Document title', { exact: true }).fill('Morning Song');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: 'Smart Paste', exact: true }).click();
  await page
    .getByLabel('Chord sheet to paste')
    .fill('C       G       Am       F\nOur original morning melody\n\nVerse two');
  await page.getByRole('button', { name: 'Insert content' }).click();
  await expect(page.getByRole('textbox', { name: 'Document content' })).toContainText(
    'Our original morning melody',
  );
  await expect(page.locator('.ql-editor [style*="Courier New"]').first()).toContainText('C');
  await page.getByLabel('Document title', { exact: true }).fill('Morning Song Revised');
  await page.getByRole('button', { name: 'New template', exact: true }).click();
  await page.getByLabel('Template name').fill('Acoustic');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByLabel('Template view')).toHaveValue(/.+/);
  await page.getByRole('button', { name: 'New document', exact: true }).first().click();
  await page.getByLabel('Document title', { exact: true }).fill('Evening Song');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.locator('.sidebar').getByRole('button', { name: 'Sessions', exact: true }).click();
  await page.getByRole('button', { name: 'Create session', exact: true }).first().click();
  await page.getByLabel('Session name').fill('Friday Practice');
  await page.getByLabel('Date (optional)').fill('2027-01-10');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create session', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add songs', exact: true }).first().click();
  await page.getByLabel('Morning Song Revised').check();
  await page.getByLabel('Evening Song', { exact: true }).check();
  await page.getByRole('button', { name: 'Add 2 songs' }).click();
  await page.screenshot({ path: testInfo.outputPath('session-desktop.png'), fullPage: true });
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.song-content h1')).toHaveText('Evening Song');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await page.locator('.song-select').nth(1).focus();
  await page.keyboard.press('Control+ArrowUp');
  await expect(page.locator('.song-content h1')).toHaveText('Evening Song');
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Add songs', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Morning Song Revised/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Collapse song panel' }).click();
  await expect(page.getByRole('button', { name: 'Expand song panel' })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.song-content h1')).toHaveText('Morning Song Revised');
  await expect(page.locator('.rich-viewer [contenteditable=true]')).toHaveCount(0);
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator('.song-content h1')).toHaveText('Evening Song');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.locator('.sidebar').getByRole('button', { name: 'Search', exact: false }).click();
  await page.getByRole('textbox', { name: 'Search workspace' }).fill('morning melody');
  await page.getByRole('button', { name: 'Morning Song Revised Document' }).click();
  await expect(page.getByRole('textbox', { name: 'Document content' })).toContainText(
    'Our original morning melody',
  );
  await page.getByRole('button', { name: 'Delete document' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete document' }).click();
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator('.document-list')).not.toContainText('Morning Song Revised');
  expect(errors).toEqual([]);
});
test('mobile navigation and session drawer stay within viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'New document', exact: true }).click();
  await page.getByLabel('Document title', { exact: true }).fill('Mobile Song');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Document content' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Document content' }).fill('Mobile lyrics');
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await page.locator('.mobile-bottom').getByRole('button', { name: 'Sessions' }).click();
  await page.getByRole('button', { name: 'Create session', exact: true }).first().click();
  await page.getByLabel('Session name').fill('Mobile Practice');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create session', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add songs', exact: true }).first().click();
  await page.getByLabel('Mobile Song').check();
  await page.getByRole('button', { name: 'Add 1 song' }).click();
  await page.locator('.song-select').click();
  await expect(page.getByRole('button', { name: 'Expand song panel' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.song-content')).toContainText('Mobile lyrics');
  await page.screenshot({ path: testInfo.outputPath('session-mobile.png'), fullPage: true });
});
