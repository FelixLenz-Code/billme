import { expect, test } from '@playwright/test';
import { appUrl, invokeDesktopIpc, launchDesktopApp, seedDesktopData } from '../support.mjs';

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

test('shows pro report summaries and opens Auswertungen workspace', async () => {
  const { page, baseUrl } = desktop;

  await page.goto(appUrl(baseUrl, '/accounting'));
  await expect(page.getByRole('heading', { name: 'Pro Buchhaltung' })).toBeVisible();

  const susa = await invokeDesktopIpc(page, 'pro:getSusaReport', {});
  const guv = await invokeDesktopIpc(page, 'pro:getGuvReport', {});
  const bilanz = await invokeDesktopIpc(page, 'pro:getBilanzReport', {});

  const susaCard = page.locator('div.rounded-2xl').filter({ hasText: 'SuSa Saldo' }).first();
  const guvCard = page.locator('div.rounded-2xl').filter({ hasText: 'GuV Ergebnis' }).first();
  const bilanzCard = page.locator('div.rounded-2xl').filter({ hasText: 'Bilanz Delta' }).first();

  await expect(susaCard).toContainText(`${(susa.totals.balance ?? 0).toFixed(2)} EUR`);
  await expect(guvCard).toContainText(`${(guv.netResult ?? 0).toFixed(2)} EUR`);
  await expect(bilanzCard).toContainText(`${(bilanz.totals.delta ?? 0).toFixed(2)} EUR`);

  await page.getByRole('button', { name: 'Auswertungen' }).click();
  await expect(page.getByRole('heading', { name: 'SuSa, GuV und Bilanz-Preview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'SuSa' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'GuV' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bilanz' })).toBeVisible();
});
