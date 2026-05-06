import type Database from 'better-sqlite3';
import type { ProWorkflowEntry } from '@billme/accounting-shared';
import type { TenantScope } from '@billme/server-core';
import { getTenantId } from '../tenantScope';

export const listProWorkflowEntries = (db: Database.Database, scope: TenantScope): ProWorkflowEntry[] => {
  const tenantId = getTenantId(scope);
  const rows = db
    .prepare(
      `
      SELECT transaction_id, transaction_json, draft_json, updated_at
      FROM pro_workflow_entries
      WHERE tenant_id = ?
      ORDER BY updated_at DESC, transaction_id ASC
    `,
    )
    .all(tenantId) as Array<{
    transaction_id: string;
    transaction_json: string;
    draft_json: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    transactionId: row.transaction_id,
    transactionJson: row.transaction_json,
    draftJson: row.draft_json,
    updatedAt: row.updated_at,
  }));
};

export const upsertProWorkflowEntry = (
  db: Database.Database,
  args: {
    transactionId: string;
    transactionJson: string;
    draftJson: string;
  },
  scope: TenantScope,
): { ok: true } => {
  const tenantId = getTenantId(scope);
  const now = new Date().toISOString();
  db.prepare(
    `
      INSERT INTO pro_workflow_entries (tenant_id, transaction_id, transaction_json, draft_json, updated_at)
      VALUES (@tenantId, @transactionId, @transactionJson, @draftJson, @updatedAt)
      ON CONFLICT(tenant_id, transaction_id) DO UPDATE SET
        transaction_json = excluded.transaction_json,
        draft_json = excluded.draft_json,
        updated_at = excluded.updated_at
    `,
  ).run({
    tenantId,
    transactionId: args.transactionId,
    transactionJson: args.transactionJson,
    draftJson: args.draftJson,
    updatedAt: now,
  });

  return { ok: true };
};
