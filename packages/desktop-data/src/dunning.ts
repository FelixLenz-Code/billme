import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import type { DunningSettings, DunningHistoryEntry, DunningRunResult, InvoiceDunningStatus } from '@billme/server-core/domain';
import type { ServerProduct } from '@billme/server-core';
import type { AuditActor, Clock, DunningEmailPort, DunningSecretPort } from '@billme/server-core/ports';
import { processDunningRun as processDomainDunningRun, summarizeInvoiceDunningStatus } from '@billme/server-core/services';
import { logEmail } from './emailRepo';
import { createBillingScope, createSqliteAuditLogPort, createSqliteInvoiceRepository } from './billingDomainCompat';

type LoggerPort = {
  debug?(message: string, meta?: Record<string, unknown>): void;
  info?(message: string, meta?: Record<string, unknown>): void;
  warn?(message: string, meta?: Record<string, unknown>): void;
  error?(message: string, meta?: Record<string, unknown>): void;
};

export interface SqliteDunningRuntime<TSettings extends DunningSettings = DunningSettings> {
  getSettings(db: Database.Database): TSettings | null;
  setSettings(db: Database.Database, settings: TSettings): void;
  secretStore: DunningSecretPort;
  sendEmail: DunningEmailPort['send'];
  clock?: Clock;
  actor?: AuditActor;
  logger?: LoggerPort;
  isRetryableError?: (error: unknown) => boolean;
}

type DunningHistoryRow = {
  id: string;
  invoice_id: string;
  invoice_number: string;
  dunning_level: number;
  days_overdue: number;
  fee_applied: number;
  email_sent: number;
  email_log_id: string | null;
  processed_at: string;
  created_at: string;
};

const rowToDunningHistory = (row: DunningHistoryRow): DunningHistoryEntry => ({
  id: row.id,
  invoiceId: row.invoice_id,
  invoiceNumber: row.invoice_number,
  dunningLevel: row.dunning_level,
  daysOverdue: row.days_overdue,
  feeApplied: row.fee_applied,
  emailSent: row.email_sent === 1,
  emailLogId: row.email_log_id ?? undefined,
  processedAt: row.processed_at,
  createdAt: row.created_at,
});

export const createSqliteDunningHistoryRepository = (db: Database.Database) => ({
  listByInvoice(_scope: { tenantId: string }, invoiceId: string): DunningHistoryEntry[] {
    const rows = db
      .prepare(
        `
          SELECT *
          FROM dunning_history
          WHERE invoice_id = ?
          ORDER BY dunning_level DESC, processed_at DESC
        `,
      )
      .all(invoiceId) as DunningHistoryRow[];

    return rows.map(rowToDunningHistory);
  },
  record(_scope: { tenantId: string }, entry: Omit<DunningHistoryEntry, 'id' | 'createdAt'>): DunningHistoryEntry {
    const createdAt = new Date().toISOString();
    const id = randomUUID();
    db.prepare(
      `
        INSERT INTO dunning_history (
          id, invoice_id, invoice_number, dunning_level, days_overdue,
          fee_applied, email_sent, email_log_id, processed_at, created_at
        ) VALUES (
          @id, @invoiceId, @invoiceNumber, @dunningLevel, @daysOverdue,
          @feeApplied, @emailSent, @emailLogId, @processedAt, @createdAt
        )
      `,
    ).run({
      id,
      invoiceId: entry.invoiceId,
      invoiceNumber: entry.invoiceNumber,
      dunningLevel: entry.dunningLevel,
      daysOverdue: entry.daysOverdue,
      feeApplied: entry.feeApplied,
      emailSent: entry.emailSent ? 1 : 0,
      emailLogId: entry.emailLogId ?? null,
      processedAt: entry.processedAt,
      createdAt,
    });

    return {
      ...entry,
      id,
      createdAt,
    };
  },
});

const createLoggerBridge = (logger?: LoggerPort) => ({
  debug: (message: string, meta?: Record<string, unknown>) => logger?.debug?.(message, meta),
  info: (message: string, meta?: Record<string, unknown>) => logger?.info?.(message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => logger?.warn?.(message, meta),
  error: (message: string, meta?: Record<string, unknown>) => logger?.error?.(message, meta),
});

export const processDunningRun = async <TSettings extends DunningSettings>(
  db: Database.Database,
  product: ServerProduct,
  runtime: SqliteDunningRuntime<TSettings>,
): Promise<DunningRunResult> => {
  const scope = createBillingScope(product);
  const dunningHistoryRepo = createSqliteDunningHistoryRepository(db);

  return processDomainDunningRun(scope, {
    invoiceRepo: createSqliteInvoiceRepository(db),
    settingsRepo: {
      get: () => runtime.getSettings(db),
      save: (_scope, settings) => runtime.setSettings(db, settings),
    },
    dunningHistoryRepo,
    emailPort: {
      send: runtime.sendEmail,
      log: (_scope, entry) => {
        const createdAt = new Date().toISOString();
        const id = randomUUID();
        const nextEntry = {
          ...entry,
          id,
          createdAt,
        };
        logEmail(db, nextEntry);
        return nextEntry;
      },
    },
    secretStore: runtime.secretStore,
    auditLog: createSqliteAuditLogPort(db),
    clock: runtime.clock,
    actor: runtime.actor,
    logger: createLoggerBridge(runtime.logger),
    isRetryableError: runtime.isRetryableError,
  });
};

export const getInvoiceDunningStatus = (
  db: Database.Database,
  product: ServerProduct,
  invoiceId: string,
  options?: {
    now?: Date;
  },
): InvoiceDunningStatus => {
  const scope = createBillingScope(product);
  const invoiceRepo = createSqliteInvoiceRepository(db);
  const dunningHistoryRepo = createSqliteDunningHistoryRepository(db);
  const invoice = invoiceRepo.getById(scope, invoiceId);
  const history = dunningHistoryRepo.listByInvoice(scope, invoiceId);
  return summarizeInvoiceDunningStatus(invoice, history, options?.now);
};
