import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const mobile of [false, true]) {
  test(`medley keeps each song on its own page on ${mobile ? 'mobile' : 'desktop'}`, async ({
    page,
  }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'New song', exact: true }).click();
    await page.getByText('Medley', { exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Sunday medley');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByLabel('Song name', { exact: true }).fill('First song');
    await page.getByLabel('Song key', { exact: true }).fill('C');
    await page.getByRole('button', { name: 'Smart Paste', exact: true }).click();
    await page.getByLabel('Chord sheet to paste').fill('C       G\nFirst song lyrics');
    await page.getByRole('button', { name: 'Insert content', exact: true }).click();
    await page.getByRole('button', { name: 'Add song', exact: true }).click();
    await expect(page.getByText('Song 2 of 2', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Document content' })).not.toContainText(
      'First song lyrics',
    );
    await expect(page.getByLabel('Song name', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Song key', { exact: true })).toHaveValue('');
    await page.getByLabel('Song name', { exact: true }).fill('Second song');
    await page.getByLabel('Song key', { exact: true }).fill('Am');
    await page.getByRole('textbox', { name: 'Document content' }).fill('Second song lyrics');
    await page.getByRole('button', { name: 'Previous song', exact: true }).click();
    await expect(page.getByLabel('Song name', { exact: true })).toHaveValue('First song');
    await expect(page.getByLabel('Song key', { exact: true })).toHaveValue('C');
    await expect(page.getByRole('textbox', { name: 'Document content' })).toContainText(
      'First song lyrics',
    );
    await expect(page.getByRole('textbox', { name: 'Document content' })).not.toContainText(
      'Second song lyrics',
    );
    await page.reload();
    await page.getByRole('button', { name: 'Next song', exact: true }).click();
    await expect(page.getByLabel('Song name', { exact: true })).toHaveValue('Second song');
    await expect(page.getByLabel('Song key', { exact: true })).toHaveValue('Am');
    await expect(page.getByRole('textbox', { name: 'Document content' })).toContainText(
      'Second song lyrics',
    );
    await page.screenshot({ path: testInfo.outputPath('medley.png'), fullPage: true });
    await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('jammer-docs-local-v1')!);
      data.sessions = [
        {
          id: 'practice',
          user_id: 'local',
          name: 'Practice',
          notes: '',
          session_date: null,
          created_at: '',
          updated_at: '',
        },
      ];
      data.session_songs = [
        {
          session_id: 'practice',
          document_id: data.documents[0].id,
          user_id: 'local',
          sort_order: 0,
        },
      ];
      localStorage.setItem('jammer-docs-local-v1', JSON.stringify(data));
    });
    await page.goto('/#session/practice');
    await page.reload();
    if (mobile) await expect(page.getByRole('button', { name: 'Expand song panel' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'First song', exact: true })).toBeVisible();
    await expect(page.locator('.song-navigation .song-key-display')).toHaveText('C');
    await expect(page.locator('.rich-viewer')).toContainText('First song lyrics');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Second song', exact: true })).toBeVisible();
    await expect(page.getByText('Am', { exact: true })).toBeVisible();
    await expect(page.locator('.song-navigation .song-key-display')).toHaveText('Am');
    await expect(page.locator('.rich-viewer')).toContainText('Second song lyrics');
    await expect(page.locator('.rich-viewer')).not.toContainText('First song lyrics');
    if (!mobile) {
      await page.goto('/#sessions');
      await page.getByRole('button', { name: 'Options for Practice', exact: true }).click();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export', exact: true }).click();
      const download = await downloadPromise;
      const path = testInfo.outputPath('medley.pdf');
      await download.saveAs(path);
      const pdf = await readFile(path, 'latin1');
      expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(3);
      expect(pdf).toContain('First song lyrics');
      expect(pdf).toContain('Second song lyrics');
      expect(pdf).not.toContain('Key:');
    }
  });
}
