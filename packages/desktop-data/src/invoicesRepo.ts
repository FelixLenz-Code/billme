import type Database from 'better-sqlite3';
import {
  createInvoiceFromOffer as createDomainInvoiceFromOffer,
  deleteInvoice as deleteDomainInvoice,
  getInvoice as getDomainInvoice,
  listInvoices as listDomainInvoices,
  upsertInvoice as upsertDomainInvoice,
} from '../../server-core/src/services/invoice-offer';
import type { ServerProduct } from '../../server-core/src';
import {
  createBillingScope,
  createSqliteBillingDependencies,
  toDomainInvoice,
  toLegacyInvoice,
  type LegacyInvoiceDocument,
  withSqliteTransaction,
} from './billingDomainCompat';

export type { LegacyInvoiceDocument, LegacyInvoiceItem, LegacyPayment } from './billingDomainCompat';

export const listInvoices = (db: Database.Database, product: ServerProduct): LegacyInvoiceDocument[] => {
  const scope = createBillingScope(product);
  const dependencies = createSqliteBillingDependencies(db);
  return listDomainInvoices(scope, dependencies).map(toLegacyInvoice);
};

export const getInvoice = (
  db: Database.Database,
  product: ServerProduct,
  id: string,
): LegacyInvoiceDocument | null => {
  const scope = createBillingScope(product);
  const dependencies = createSqliteBillingDependencies(db);
  const invoice = getDomainInvoice(scope, dependencies, id);
  return invoice ? toLegacyInvoice(invoice) : null;
};

export const upsertInvoice = (
  db: Database.Database,
  product: ServerProduct,
  invoice: LegacyInvoiceDocument,
  reason: string,
): LegacyInvoiceDocument => {
  const scope = createBillingScope(product);
  return withSqliteTransaction(db, () => {
    const dependencies = createSqliteBillingDependencies(db);
    return toLegacyInvoice(
      upsertDomainInvoice(scope, dependencies, {
        invoice: toDomainInvoice(scope, invoice),
        reason,
      }),
    );
  });
};

export const deleteInvoice = (
  db: Database.Database,
  product: ServerProduct,
  id: string,
  reason: string,
): { ok: true } => {
  const scope = createBillingScope(product);
  return withSqliteTransaction(db, () => {
    const dependencies = createSqliteBillingDependencies(db);
    return deleteDomainInvoice(scope, dependencies, { id, reason });
  });
};

export const createInvoiceFromOffer = (
  db: Database.Database,
  product: ServerProduct,
  params: {
    offerId: string;
    invoiceId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    servicePeriod?: string;
  },
): LegacyInvoiceDocument => {
  const scope = createBillingScope(product);
  const dependencies = createSqliteBillingDependencies(db);
  return toLegacyInvoice(
    createDomainInvoiceFromOffer(scope, dependencies, {
      offerId: params.offerId,
      invoiceId: params.invoiceId,
      invoiceNumber: params.invoiceNumber,
      invoiceDate: params.invoiceDate,
      dueDate: params.dueDate,
      servicePeriod: params.servicePeriod,
    }),
  );
};
