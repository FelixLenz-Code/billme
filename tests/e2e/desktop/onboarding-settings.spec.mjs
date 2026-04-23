import { expect, test } from '@playwright/test';
import {
  appUrl,
  createDesktopSettings,
  launchDesktopApp,
  seedDesktopData,
  setDesktopSettings,
} from '../support.mjs';

let desktop;

test.beforeEach(async () => {
  desktop = await launchDesktopApp();
  await seedDesktopData(desktop.page);
});

test.afterEach(async () => {
  if (desktop) {
    await desktop.close();
    desktop = undefined;
  }
});

test('completes the onboarding flow from an empty company profile', async () => {
  const { page, baseUrl } = desktop;

  await setDesktopSettings(
    page,
    createDesktopSettings({
      onboardingCompleted: false,
      company: {
        name: '',
      },
    }),
  );

  await page.goto(appUrl(baseUrl, '/'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Willkommen bei Billme' })).toBeVisible();

  await page.getByRole('button', { name: 'Loslegen' }).click();
  await page.getByPlaceholder('Muster GmbH').fill('Browser Test GmbH');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Erste Rechnung erstellen' }).click();

  await expect(page.getByRole('button', { name: 'Dokumente' })).toBeVisible();
  await expect(page.getByText('Willkommen bei Billme')).toHaveCount(0);
});

test('saves company settings and shows the saved toast', async () => {
  const { page, baseUrl } = desktop;
  await page.goto(appUrl(baseUrl, '/settings'));

  await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();

  await page.locator('input[type="text"]').first().fill('Browser Test GmbH');
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();

  await expect(page.getByText('Einstellungen gespeichert!')).toBeVisible();
});
