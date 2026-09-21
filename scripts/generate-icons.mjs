import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Export the same vector artwork used in the app without an image dependency.
const directory = new URL('../public/icons/', import.meta.url);
const logo = await readFile(new URL('logo.svg', directory), 'utf8');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, size, square] of [
    ['favicon-32.png', 32, false],
    ['icon-192.png', 192, false],
    ['icon-512.png', 512, false],
    ['icon-maskable-512.png', 512, true],
    ['apple-touch-icon.png', 180, true],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%;}svg{display:block;width:100%;height:100%;}</style>${square ? logo.replace('rx="112"', 'rx="0"') : logo}`,
    );
    await page.screenshot({
      path: fileURLToPath(new URL(name, directory)),
      omitBackground: !square,
    });
  }
} finally {
  await browser.close();
}
