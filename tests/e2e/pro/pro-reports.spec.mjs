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

test('shows pro report summaries and opens Auswertungen workspace', async () => {
  const { page, baseUrl } = desktop;

  await page.goto(appUrl(baseUrl, '/accounting'));
  await expect(page.getByRole('heading', { name: 'Pro Buchhaltung' })).toBeVisible();

  await page.getByRole('button', { name: 'Auswertungen' }).click();
  await expect(page.getByRole('heading', { name: 'SuSa, GuV und Bilanz-Preview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'SuSa' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'GuV' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bilanz (Preview)' })).toBeVisible();

  const susaAccountsCard = page.locator('div.rounded-xl').filter({ hasText: 'Konten' }).first();
  const susaWarningsCard = page.locator('div.rounded-xl').filter({ hasText: 'Warnungen' }).first();
  await expect(susaAccountsCard).toContainText(/\d+/);
  await expect(susaWarningsCard).toContainText(/\d+/);
  await expect(page.getByText('Summen- und Saldenliste (Preview)')).toBeVisible();

  await page.getByRole('button', { name: 'GuV' }).click();
  const guvRevenueCard = page.locator('div.rounded-xl').filter({ hasText: 'Umsätze' }).first();
  const guvResultCard = page.locator('div.rounded-xl').filter({ hasText: 'Ergebnis' }).first();
  await expect(guvRevenueCard).toContainText('€');
  await expect(guvResultCard).toContainText('€');
  await expect(page.getByText('Gewinn- und Verlustrechnung (Preview)')).toBeVisible();

  await page.getByRole('button', { name: 'Bilanz (Preview)' }).click();
  const bilanzAktivaCard = page.locator('div.rounded-xl').filter({ hasText: 'Aktiva' }).first();
  const bilanzDifferenzCard = page.locator('div.rounded-xl').filter({ hasText: 'Differenz' }).first();
  await expect(bilanzAktivaCard).toContainText('€');
  await expect(bilanzDifferenzCard).toContainText('€');
  await expect(page.getByText('Bilanz (HGB Preview, Mock)')).toBeVisible();
});
