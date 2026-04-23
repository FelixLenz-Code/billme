import { expect, test } from '@playwright/test';
import { appUrl, launchDesktopApp, seedDesktopData } from '../support.mjs';

let desktop;

test.beforeEach(async () => {
  desktop = await launchDesktopApp({ app: 'pro' });
  await seedDesktopData(desktop.page, { app: 'pro' });
});

test.afterEach(async () => {
  if (desktop) {
    await desktop.close();
    desktop = undefined;
  }
});

test('resolves and reopens an exception case in pro workspace', async () => {
  const { page, baseUrl } = desktop;

  await page.goto(appUrl(baseUrl, '/accounting'));
  await expect(page.getByRole('heading', { name: 'Pro Buchhaltung' })).toBeVisible();
  await page.getByRole('button', { name: 'Exceptions' }).click();
  await expect(page.getByRole('heading', { name: 'Exception Center' })).toBeVisible();

  await page.getByRole('button', { name: 'Ohne Beleg' }).click();
  await expect(page.getByText('Keine Einträge für den Filter.')).toHaveCount(0);

  const snapshot = page.locator('div.border').filter({ hasText: 'Workflow Snapshot' }).first();
  await page.getByPlaceholder('Was wurde geprüft/gelöst?').fill('E2E resolved in exception center');
  await page.getByRole('button', { name: 'Als gelöst markieren' }).click();
  await expect(snapshot).toContainText('Exception Status');
  await expect(snapshot).toContainText('resolved');

  await page.getByRole('button', { name: 'Reopen' }).click();
  await expect(snapshot).toContainText('open');
});
