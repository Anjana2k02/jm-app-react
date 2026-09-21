import { test, expect } from '@playwright/test';

test('mobile install instructions and home-screen icons are available', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#settings');
  const card = page.getByRole('region', { name: 'Jammer Docs on your phone' });
  await expect(card).toContainText('Android');
  await expect(card).toContainText('iPhone / iPad');
  await expect(card).toContainText('Add to Home Screen');
  await expect(page.getByRole('button', { name: 'Install Jammer Docs' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('install-mobile.png'), fullPage: true });

  const manifestURL = await page.locator('link[rel="manifest"]').getAttribute('href');
  const response = await page.request.get(manifestURL!);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.name).toBe('Jammer Docs');
  for (const icon of manifest.icons) {
    const dimensions = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return `${image.naturalWidth}x${image.naturalHeight}`;
    }, icon.src);
    expect(dimensions).toBe(icon.sizes);
  }
  const appleIcon = page.locator('link[rel="apple-touch-icon"]');
  expect((await page.request.get((await appleIcon.getAttribute('href'))!)).ok()).toBe(true);
});

test('an install prompt captured before Settings can be dismissed and requested again', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New document', exact: true })).toBeVisible();
  const sendPrompt = async (outcome: 'accepted' | 'dismissed') => {
    await page.evaluate((choice) => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(event, {
        prompt: async () => {
          document.body.dataset.prompted = 'true';
        },
        userChoice: Promise.resolve({ outcome: choice }),
      });
      window.dispatchEvent(event);
    }, outcome);
  };
  await sendPrompt('dismissed');
  await page.locator('.sidebar').getByRole('button', { name: 'Settings' }).click();
  const install = page.getByRole('button', { name: 'Install Jammer Docs' });
  await install.click();
  await expect(page.locator('body')).toHaveAttribute('data-prompted', 'true');
  await expect(page.getByRole('status')).toContainText('Installation dismissed');
  await expect(install).toBeHidden();
  await sendPrompt('accepted');
  await install.click();
  await expect(page.getByRole('status')).toContainText('Installation requested');
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(page.getByRole('status')).toContainText('You’re using the installed app.');
  await expect(install).toBeHidden();
});

test('standalone launch shows installed status', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { value: true });
  });
  await page.goto('/#settings');
  await expect(page.getByRole('status')).toContainText('You’re using the installed app.');
  await expect(page.getByRole('button', { name: 'Install Jammer Docs' })).toBeHidden();
});
