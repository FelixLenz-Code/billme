import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { bootstrapSql } from '../db/bootstrap';
import { runMigrations } from '../db/migrate';
import { buildAccountSuggestionContext, suggestAccountForTransaction } from './accountSuggestionPipeline';
import type { AccountSuggestionRule } from '../db/accountSuggestionRulesRepo';

const canRunNativeSqlite = (() => {
  try {
    const probe = new Database(':memory:');
    probe.close();
    return true;
  } catch {
    return false;
  }
})();

const createDb = (): Database.Database => {
  const db = new Database(':memory:');
  db.exec(bootstrapSql);
  runMigrations(db);
  return db;
};

const seedLedger = (db: Database.Database) => {
  const now = new Date().toISOString();
  const insert = db.prepare(
    `
      INSERT INTO ledger_accounts (id, chart, account_number, name, source, created_at, updated_at)
      VALUES (?, 'SKR03', ?, ?, 'test', ?, ?)
    `,
  );
  insert.run('ledger:1200', '1200', 'Bank', now, now);
  insert.run('ledger:8400', '8400', 'Erloese 19%', now, now);
  insert.run('ledger:4930', '4930', 'Telekommunikation', now, now);
  insert.run('ledger:4970', '4970', 'Werbung', now, now);
};

const seedKeyword = (db: Database.Database, accountNumber: string, keyword: string) => {
  const now = new Date().toISOString();
  db.prepare(
    `
      INSERT INTO account_keywords
        (id, tenant_id, chart, account_number, keyword, source, active, created_at, updated_at)
      VALUES (?, 'default', 'SKR03', ?, ?, 'user', 1, ?, ?)
    `,
  ).run(`kw:${accountNumber}:${keyword}`, accountNumber, keyword, now, now);
};

const seedPosted = (
  db: Database.Database,
  args: { id: string; counterparty: string; purpose: string; accountNumber: string; amount: number },
) => {
  const now = `2026-02-${String(Number(args.id.replace(/\D/g, '').slice(-2)) || 1).padStart(2, '0')}T10:00:00.000Z`;
  db.prepare(
    `
      INSERT INTO bank_transactions
        (id, tenant_id, account_id, date, amount, type, counterparty, purpose, linked_invoice_id, status, source_transaction_id, created_at, updated_at)
      VALUES (?, 'default', 'bank-1', '2026-02-10', ?, 'expense', ?, ?, NULL, 'booked', ?, ?, ?)
    `,
  ).run(args.id, args.amount, args.counterparty, args.purpose, args.id, now, now);

  db.prepare(
    `
      INSERT INTO booking_drafts (id, tenant_id, transaction_id, workflow_status, draft_json, updated_at)
      VALUES (?, 'default', ?, 'posted', '{}', ?)
    `,
  ).run(`draft-${args.id}`, args.id, now);

  db.prepare(
    `
      INSERT INTO journal_entries
        (id, tenant_id, entry_number, posting_date, document_date, booking_text, reference, period, fiscal_year, status, source_draft_id, reversed_entry_id, created_at)
      VALUES (?, 'default', ?, '2026-02-10', '2026-02-10', ?, ?, '2026-02', 2026, 'posted', ?, NULL, ?)
    `,
  ).run(
    `je-${args.id}`,
    ((db.prepare('SELECT COALESCE(MAX(entry_number), 0) + 1 as next FROM journal_entries').get() as { next: number }).next),
    args.purpose,
    args.id,
    `draft-${args.id}`,
    now,
  );

  db.prepare(
    `
      INSERT INTO journal_lines
        (id, tenant_id, entry_id, line_no, account_number, debit_amount, credit_amount, tax_code, cost_center, memo)
      VALUES (?, 'default', ?, 1, ?, ?, 0, NULL, NULL, NULL)
    `,
  ).run(`jl-${args.id}-1`, `je-${args.id}`, args.accountNumber, Math.abs(args.amount));
  db.prepare(
    `
      INSERT INTO journal_lines
        (id, tenant_id, entry_id, line_no, account_number, debit_amount, credit_amount, tax_code, cost_center, memo)
      VALUES (?, 'default', ?, 2, '1200', 0, ?, NULL, NULL, NULL)
    `,
  ).run(`jl-${args.id}-2`, `je-${args.id}`, Math.abs(args.amount));
};

describe.skipIf(!canRunNativeSqlite)('accountSuggestionPipeline', () => {
  it('rule overrides all lower layers', () => {
    const db = createDb();
    seedLedger(db);
    seedKeyword(db, '4970', 'telefon');

    const rules: AccountSuggestionRule[] = [{
      id: 'r1',
      tenantId: 'default',
      chart: 'SKR03',
      priority: 1,
      field: 'counterparty',
      operator: 'contains',
      value: 'telekom',
      targetAccountNumber: '4930',
      flowType: 'expense',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];

    const ctx = buildAccountSuggestionContext(db, { chart: 'SKR03', rules });
    const suggestion = suggestAccountForTransaction(ctx, {
      flowType: 'expense',
      counterparty: 'Telekom GmbH',
      purpose: 'Telefon Rechnung',
    });

    expect(suggestion.layer).toBe('rule');
    expect(suggestion.accountNumber).toBe('4930');
  });

  it('counterparty memory overrides keyword', () => {
    const db = createDb();
    seedLedger(db);
    seedKeyword(db, '4970', 'telefon');
    seedPosted(db, {
      id: 'tx-memory-1',
      counterparty: 'Telekom Deutschland',
      purpose: 'Altvertrag',
      accountNumber: '4930',
      amount: -120,
    });

    const ctx = buildAccountSuggestionContext(db, { chart: 'SKR03', rules: [] });
    const suggestion = suggestAccountForTransaction(ctx, {
      flowType: 'expense',
      counterparty: 'Telekom Deutschland',
      purpose: 'Telefon und Internet',
    });
    expect(suggestion.layer).toBe('counterparty');
    expect(suggestion.accountNumber).toBe('4930');
  });

  it('bayes classifies when enough posted examples exist', () => {
    const db = createDb();
    seedLedger(db);
    for (let i = 0; i < 20; i += 1) {
      seedPosted(db, {
        id: `tx-bayes-${i}`,
        counterparty: 'AWS Europe',
        purpose: 'Cloud Rechnung',
        accountNumber: '4930',
        amount: -100 - i,
      });
    }
    const ctx = buildAccountSuggestionContext(db, { chart: 'SKR03', rules: [] });
    const suggestion = suggestAccountForTransaction(ctx, {
      flowType: 'expense',
      counterparty: 'Amazon Web Services',
      purpose: 'Cloud Nutzung',
    });
    expect(suggestion.layer).toBe('bayes');
    expect(suggestion.accountNumber).toBe('4930');
  });

  it('falls back to keyword if no rules/memory/bayes match', () => {
    const db = createDb();
    seedLedger(db);
    seedKeyword(db, '4970', 'werbung');

    const ctx = buildAccountSuggestionContext(db, { chart: 'SKR03', rules: [] });
    const suggestion = suggestAccountForTransaction(ctx, {
      flowType: 'expense',
      counterparty: 'Meta Platforms',
      purpose: 'Werbung Kampagne',
    });
    expect(suggestion.layer).toBe('keyword');
    expect(suggestion.accountNumber).toBe('4970');
  });
});
