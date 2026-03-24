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

test('opens a document and converts an accepted offer to an invoice', async () => {
  const { page, baseUrl } = desktop;
  await page.goto(appUrl(baseUrl, '/documents'));

  await expect(page.getByRole('button', { name: 'Vorlagen' })).toBeVisible();
  await expect(page.getByText('RE-2026-002')).toBeVisible();

  await page.locator('button:has-text("Rechnungen")').first().click();
  await page.getByRole('button', { name: 'Angebote' }).click();
  await expect(page.getByText('ANG-2026-001')).toBeVisible();
  await page.getByText('ANG-2026-001').first().click();
  await expect(page.getByRole('heading', { name: 'ANG-2026-001' })).toBeVisible();
  await invokeDesktopIpc(page, 'documents:convertOfferToInvoice', { offerId: 'offer-open-1' });

  const invoices = await invokeDesktopIpc(page, 'invoices:list', {});
  expect(invoices.length).toBeGreaterThan(2);
  expect(invoices.some((invoice) => invoice.clientId === 'c2' && invoice.number !== 'RE-2026-002')).toBeTruthy();
});
