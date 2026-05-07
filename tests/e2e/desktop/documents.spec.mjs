import { expect, test } from '@playwright/test';
import { appUrl, invokeDesktopIpc, launchDesktopApp, seedDesktopData } from '../support.mjs';

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
  const invoicesBefore = await invokeDesktopIpc(page, 'invoices:list', {});
  const invoiceIdsBefore = new Set(invoicesBefore.map((invoice) => invoice.id));
  const acceptedOffer = (await invokeDesktopIpc(page, 'offers:list', {})).find(
    (offer) =>
      offer.acceptedAt
      || offer.acceptedBy
      || offer.shareDecision === 'accepted'
      || offer.status === 'accepted',
  );
  expect(acceptedOffer).toBeTruthy();

  await page.goto(appUrl(baseUrl, '/documents'));

  await expect(page.getByRole('button', { name: 'Vorlagen' })).toBeVisible();
  const visibleInvoiceNumber = page.getByText(/^RE-\d{4}-\d{3}$/).first();
  await expect(visibleInvoiceNumber).toBeVisible();
  const openedInvoiceNumber = await visibleInvoiceNumber.textContent();
  await visibleInvoiceNumber.click();
  await expect(page.getByRole('heading', { name: openedInvoiceNumber ?? /RE-\d{4}-\d{3}/ })).toBeVisible();
  await invokeDesktopIpc(page, 'documents:convertOfferToInvoice', { offerId: acceptedOffer.id });

  const invoicesAfter = await invokeDesktopIpc(page, 'invoices:list', {});
  expect(invoicesAfter).toHaveLength(invoicesBefore.length + 1);
  const createdInvoice = invoicesAfter.find((invoice) => !invoiceIdsBefore.has(invoice.id));
  expect(createdInvoice?.clientId).toBe(acceptedOffer.clientId);
});
