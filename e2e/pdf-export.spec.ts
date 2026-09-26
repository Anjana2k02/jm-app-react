import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const sessionName = 'සිංහල ගීත සැසිය';
const lyrics = 'ශ්‍රී ලංකා මගේ ආදරණීය රටයි';

async function openExport(page: Page) {
  await page.addInitScript(
    ({ sessionName, lyrics }) => {
      const now = new Date().toISOString();
      localStorage.setItem(
        'jammer-docs-local-v1',
        JSON.stringify({
          documents: [
            {
              id: 'sinhala-song',
              user_id: 'local',
              title: 'සිංහල ගීතය',
              artist: 'ගායකයා',
              content: [
                { insert: 'CHORUS\n', attributes: { bold: true } },
                {
                  insert:
                    'සිත් සුසුම් නිවන ගායනා\nනැවුම් ගීයක් සිතට එක්වී\nමලට පෙති නැතුවයි\nශ්‍රී ලංකාවේ ප්‍රධාන ජාතිය\n',
                  attributes: { font: 'Courier New' },
                },
                ...Array.from({ length: 35 }, () => [
                  { insert: 'A                 E7      D\n', attributes: { font: 'Courier New' } },
                  { insert: `${lyrics}\n`, attributes: { font: 'Courier New' } },
                ]).flat(),
                { insert: `${lyrics} `.repeat(12) + '\n', attributes: { bold: true } },
                { insert: 'END OF SONG\n' },
              ],
              created_at: now,
              updated_at: now,
            },
          ],
          templates: [],
          template_items: [],
          sessions: [
            {
              id: 'sinhala-session',
              user_id: 'local',
              name: sessionName,
              notes: 'සංගීත පුහුණුව සඳහා සටහන්',
              session_date: '2026-09-26',
              created_at: now,
              updated_at: now,
            },
          ],
          session_songs: [
            {
              session_id: 'sinhala-session',
              document_id: 'sinhala-song',
              user_id: 'local',
              sort_order: 0,
            },
          ],
        }),
      );
    },
    { sessionName, lyrics },
  );
  await page.goto('/#sessions');
  await page.getByRole('button', { name: `Options for ${sessionName}` }).click();
}

test('exports Sinhala titles, notes, and chord lyrics across PDF pages', async ({
  page,
}, testInfo) => {
  const fontResponses: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/fonts/NotoSansSinhala') && response.ok()) {
      fontResponses.push(response.url());
    }
  });
  await openExport(page);
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    const widths: { actual: number; expected: number }[] = [];
    (window as unknown as { sinhalaWidths: typeof widths }).sinhalaWidths = widths;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (/[\u0D80-\u0DFF]/.test(text)) {
        const reference = document.createElement('canvas').getContext('2d')!;
        const size = /\d+(?:\.\d+)?px/.exec(this.font)![0];
        reference.font = `${this.font.includes('bold') || this.font.includes('700') ? '700' : '400'} ${size} "PDF Sinhala"`;
        widths.push({
          actual: this.measureText(text).width,
          expected: reference.measureText(text).width,
        });
      }
      return original.call(this, text, x, y, maxWidth);
    };
  });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`${sessionName}.pdf`);
  const path = testInfo.outputPath('sinhala-session.pdf');
  await download.saveAs(path);
  const pdf = (await readFile(path)).toString('latin1');
  expect(pdf.startsWith('%PDF-')).toBe(true);
  expect(pdf.match(/\/Type \/Page\b/g)!.length).toBeGreaterThanOrEqual(3);
  expect(pdf.match(/\/Subtype \/Image\b/g)!.length).toBeGreaterThan(5);
  expect(pdf).toContain('END OF SONG');
  expect(pdf).toContain('A                 E7      D');
  expect(fontResponses).toHaveLength(2);
  expect(fontResponses.every((url) => url.includes('NotoSansSinhala-3.000-'))).toBe(true);
  // Noto 2.002 gives these pre-base vowel signs zero advance with modern
  // shaping engines, placing them on top of their consonants. Check actual
  // glyph spacing, rather than comparing two renderings of the same bad font.
  const vowelAdvances = await page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    return ['400', '700'].flatMap((weight) => {
      ctx.font = `${weight} 30px "PDF Sinhala"`;
      return [
        ['පෙති', 'පති'],
        ['ගේ', 'ග'],
      ].map(
        ([withVowel, withoutVowel]) =>
          ctx.measureText(withVowel).width - ctx.measureText(withoutVowel).width,
      );
    });
  });
  for (const advance of vowelAdvances) expect(advance).toBeGreaterThan(10);
  const widths = await page.evaluate(
    () =>
      (window as unknown as { sinhalaWidths: { actual: number; expected: number }[] })
        .sinhalaWidths,
  );
  expect(widths.length).toBeGreaterThan(5);
  for (const { actual, expected } of widths) expect(actual).toBeCloseTo(expected, 2);
  expect(await page.evaluate(() => document.fonts.check('16px "PDF Sinhala"', 'සිංහල'))).toBe(true);
});

test('reports a missing Sinhala font and allows export to be retried', async ({ page }) => {
  await page.route('**/fonts/NotoSansSinhala-*.ttf', (route) => route.abort());
  await openExport(page);
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByText(/The Sinhala PDF font could not load/)).toBeVisible();
  expect(downloads).toBe(0);
  await page.unroute('**/fonts/NotoSansSinhala-*.ttf');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(`${sessionName}.pdf`);
});
