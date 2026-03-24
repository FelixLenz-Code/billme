import type Database from 'better-sqlite3';

export interface ProWorkflowEntry {
  transactionId: string;
  transactionJson: string;
  draftJson: string;
  updatedAt: string;
}

export const listProWorkflowEntries = (db: Database.Database): ProWorkflowEntry[] => {
  const rows = db
    .prepare(
      `
      SELECT transaction_id, transaction_json, draft_json, updated_at
      FROM pro_workflow_entries
      ORDER BY updated_at DESC, transaction_id ASC
    `,
    )
    .all() as Array<{
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
): { ok: true } => {
  const now = new Date().toISOString();
  db.prepare(
    `
      INSERT INTO pro_workflow_entries (transaction_id, transaction_json, draft_json, updated_at)
      VALUES (@transactionId, @transactionJson, @draftJson, @updatedAt)
      ON CONFLICT(transaction_id) DO UPDATE SET
        transaction_json = excluded.transaction_json,
        draft_json = excluded.draft_json,
        updated_at = excluded.updated_at
    `,
  ).run({
    transactionId: args.transactionId,
    transactionJson: args.transactionJson,
    draftJson: args.draftJson,
    updatedAt: now,
  });

  return { ok: true };
};
