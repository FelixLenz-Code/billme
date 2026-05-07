import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  bindProAccountingScope,
  bindProWorkflowScope,
  createProAccountingService,
  createProWorkflowService,
} from '@billme/accounting-engine';
import { bootstrapSql } from './bootstrap';
import { runMigrations } from './migrate';
import { createSqliteProAccountingRepository, createSqliteProWorkflowRepository } from './proAccountingPorts';
import { createProTenantScope } from '../tenantScope';

const createDb = (): Database.Database => {
  const db = new Database(':memory:');
  db.exec(bootstrapSql);
  runMigrations(db);
  return db;
};

const canRunNativeSqlite = (() => {
  try {
    const probe = new Database(':memory:');
    probe.close();
    return true;
  } catch {
    return false;
  }
})();

const seedBankTransaction = (db: Database.Database, tenantId: string, id: string, date: string, amount = -120): void => {
  db.prepare(
    `
      INSERT INTO bank_transactions (
        id,
        tenant_id,
        account_id,
        date,
        amount,
        type,
        counterparty,
        purpose,
        linked_invoice_id,
        status,
        source_transaction_id,
        created_at,
        updated_at
      ) VALUES (?, ?, 'bank-1', ?, ?, 'expense', 'Lieferant GmbH', 'Eingangsrechnung', NULL, 'pending', ?, ?, ?)
    `,
  ).run(id, tenantId, date, amount, id, `${date}T09:00:00.000Z`, `${date}T09:00:00.000Z`);
};

describe.skipIf(!canRunNativeSqlite)('proAccounting sqlite ports', () => {
  it('binds accounting services to tenant-scoped sqlite repositories', async () => {
    const db = createDb();
    seedBankTransaction(db, 'default', 'tx-default', '2026-02-15');
    seedBankTransaction(db, 'tenant-b', 'tx-tenant-b', '2026-02-16', -80);

    const accountingService = createProAccountingService(createSqliteProAccountingRepository(db));
    const defaultService = bindProAccountingScope(accountingService, createProTenantScope('default'));
    const tenantBService = bindProAccountingScope(accountingService, createProTenantScope('tenant-b'));

    expect((await defaultService.listBankTransactions()).map((entry) => entry.id)).toEqual(['tx-default']);
    expect((await tenantBService.listBankTransactions()).map((entry) => entry.id)).toEqual(['tx-tenant-b']);
  });

  it('binds workflow services to tenant-scoped sqlite repositories', async () => {
    const db = createDb();
    const workflowService = createProWorkflowService(createSqliteProWorkflowRepository(db));
    const defaultWorkflow = bindProWorkflowScope(workflowService, createProTenantScope('default'));
    const tenantBWorkflow = bindProWorkflowScope(workflowService, createProTenantScope('tenant-b'));

    await defaultWorkflow.upsert({
      transactionId: 'tx-1',
      transactionJson: '{"tenant":"default"}',
      draftJson: '{"draft":1}',
    });
    await tenantBWorkflow.upsert({
      transactionId: 'tx-1',
      transactionJson: '{"tenant":"tenant-b"}',
      draftJson: '{"draft":2}',
    });

    expect(await defaultWorkflow.list()).toEqual([
      expect.objectContaining({
        transactionId: 'tx-1',
        transactionJson: '{"tenant":"default"}',
        draftJson: '{"draft":1}',
      }),
    ]);
    expect(await tenantBWorkflow.list()).toEqual([
      expect.objectContaining({
        transactionId: 'tx-1',
        transactionJson: '{"tenant":"tenant-b"}',
        draftJson: '{"draft":2}',
      }),
    ]);
  });
});
