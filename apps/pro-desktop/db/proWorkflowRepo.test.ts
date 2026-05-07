import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { bootstrapSql } from './bootstrap';
import { runMigrations } from './migrate';
import { listProWorkflowEntries, upsertProWorkflowEntry } from './proWorkflowRepo';
import { createProTenantScope } from '../tenantScope';

const createLegacyWorkflowDb = (): Database.Database => {
  const db = new Database(':memory:');
  db.exec(bootstrapSql);
  db.exec('DROP TABLE pro_workflow_entries;');
  db.exec(`
    CREATE TABLE pro_workflow_entries (
      transaction_id TEXT PRIMARY KEY,
      transaction_json TEXT NOT NULL,
      draft_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
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

describe.skipIf(!canRunNativeSqlite)('proWorkflowRepo tenant scope', () => {
  it('migrates legacy workflow rows and scopes queries by tenant', () => {
    const db = createLegacyWorkflowDb();
    db.prepare(
      `
        INSERT INTO pro_workflow_entries (transaction_id, transaction_json, draft_json, updated_at)
        VALUES (?, ?, ?, ?)
      `,
    ).run('tx-legacy', '{"legacy":true}', '{"draft":1}', '2026-01-01T00:00:00.000Z');

    runMigrations(db);

    const defaultScope = createProTenantScope('default');
    const tenantB = createProTenantScope('tenant-b');

    expect(listProWorkflowEntries(db, defaultScope)).toEqual([
      {
        transactionId: 'tx-legacy',
        transactionJson: '{"legacy":true}',
        draftJson: '{"draft":1}',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    upsertProWorkflowEntry(
      db,
      {
        transactionId: 'tx-legacy',
        transactionJson: '{"legacy":false}',
        draftJson: '{"draft":2}',
      },
      tenantB,
    );

    expect(listProWorkflowEntries(db, defaultScope)).toHaveLength(1);
    expect(listProWorkflowEntries(db, tenantB)).toEqual([
      expect.objectContaining({
        transactionId: 'tx-legacy',
        transactionJson: '{"legacy":false}',
        draftJson: '{"draft":2}',
      }),
    ]);
  });
});
