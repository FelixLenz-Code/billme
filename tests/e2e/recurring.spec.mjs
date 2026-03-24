import { expect, test } from '@playwright/test';
import { appUrl, invokeDesktopIpc, launchDesktopApp, seedDesktopData } from './support.mjs';

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

test('creates a recurring profile and runs the generator', async () => {
  const { page, baseUrl } = desktop;
  await page.goto(appUrl(baseUrl, '/recurring'));

  await expect(page.getByRole('heading', { name: 'Abo-Rechnungen' })).toBeVisible();
  await page.getByRole('button', { name: 'Neues Abo' }).click();

  await expect(page.getByRole('heading', { name: 'Neues Abo' })).toBeVisible();
  await page
    .locator('label:has-text("Interne Bezeichnung")')
    .locator('xpath=following-sibling::input[1]')
    .fill('Browser Test Abo');
  await page.locator('label:has-text("Kunde")').locator('xpath=following-sibling::select[1]').selectOption('c2');
  await page
    .locator('label:has-text("Intervall")')
    .locator('xpath=following-sibling::select[1]')
    .selectOption('monthly');
  await page
    .locator('label:has-text("Start / Nächste Ausführung")')
    .locator('xpath=following-sibling::input[1]')
    .fill('2026-04-01');
  await page.getByRole('button', { name: 'Speichern' }).click();

  await expect(page.getByText('Browser Test Abo')).toBeVisible();

  const profiles = await invokeDesktopIpc(page, 'recurring:list', {});
  expect(profiles.some((profile) => profile.name === 'Browser Test Abo' && profile.clientId === 'c2')).toBeTruthy();

  const targetCard = page
    .getByText('Browser Test Abo', { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"group")][1]')
    .first();
  await targetCard.getByRole('button', { name: 'Jetzt ausführen' }).click();
  await expect(page.getByText('Abo-Rechnungen generiert')).toBeVisible();
});
