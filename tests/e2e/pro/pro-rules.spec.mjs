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

test('creates, updates, toggles and deletes pro account suggestion rules', async () => {
  const { page, baseUrl } = desktop;
  const value = `e2e-telekom-${Date.now()}`;
  const updatedValue = `${value}-updated`;

  await page.goto(appUrl(baseUrl, '/accounting'));
  await expect(page.getByRole('heading', { name: 'Pro Buchhaltung' })).toBeVisible();
  await page.getByRole('button', { name: 'Regeln' }).click();
  const modal = page.locator('div.w-\\[760px\\]').filter({ hasText: 'Kontierungsvorschlag-Regeln' });
  await expect(modal).toBeVisible();

  await modal.getByRole('button', { name: 'Neue Regel' }).click();
  await modal.getByPlaceholder('z.B. telefon, telekom, aws').fill(value);
  const targetAccountSelect = modal
    .locator('label:has-text("Zielkonto")')
    .locator('xpath=following-sibling::select[1]');
  const firstSelectableValue = await targetAccountSelect
    .locator('option')
    .nth(1)
    .evaluate((option) => option.getAttribute('value'));
  expect(firstSelectableValue).toBeTruthy();
  await targetAccountSelect.selectOption(firstSelectableValue);
  await modal.getByRole('button', { name: 'Regel erstellen' }).click();

  let createdRuleId = null;
  await expect
    .poll(async () => {
      const rules = await invokeDesktopIpc(page, 'pro:listAccountSuggestionRules', { chart: 'SKR03' });
      const found = rules.find((rule) => rule.value === value);
      createdRuleId = found?.id ?? null;
      return createdRuleId;
    })
    .not.toBeNull();

  const row = modal.locator('div.space-y-2 > div').filter({ hasText: `"${value}"` }).first();
  await row.getByRole('button', { name: 'Aktiv', exact: true }).click();

  await expect
    .poll(async () => {
      const rules = await invokeDesktopIpc(page, 'pro:listAccountSuggestionRules', { chart: 'SKR03' });
      return rules.find((rule) => rule.id === createdRuleId)?.active ?? true;
    })
    .toBe(false);

  await row.getByRole('button', { name: 'Bearbeiten' }).click();
  await modal.getByPlaceholder('z.B. telefon, telekom, aws').fill(updatedValue);
  await modal.getByRole('button', { name: 'Aktualisieren' }).click();

  await expect
    .poll(async () => {
      const rules = await invokeDesktopIpc(page, 'pro:listAccountSuggestionRules', { chart: 'SKR03' });
      return rules.find((rule) => rule.id === createdRuleId)?.value ?? null;
    })
    .toBe(updatedValue);

  const updatedRow = modal.locator('div.space-y-2 > div').filter({ hasText: `"${updatedValue}"` }).first();
  await updatedRow.locator('button').last().click();

  await expect
    .poll(async () => {
      const rules = await invokeDesktopIpc(page, 'pro:listAccountSuggestionRules', { chart: 'SKR03' });
      return rules.some((rule) => rule.id === createdRuleId);
    })
    .toBe(false);
});
