import type Database from 'better-sqlite3';
import type { Account, Transaction } from '../types';

type AccountRow = {
  id: string;
  name: string;
  iban: string;
  balance: number;
  default_skr_account_number: string | null;
  type: string;
  color: string;
};

type TransactionRow = {
  id: string;
  account_id: string;
  date: string;
  amount: number;
  type: string;
  counterparty: string;
  purpose: string;
  linked_invoice_id: string | null;
  status: string;
};

const DEFAULT_BANK_ACCOUNT_BY_CHART: Record<'SKR03' | 'SKR04', string> = {
  SKR03: '1200',
  SKR04: '1800',
};

const getActiveChart = (db: Database.Database): 'SKR03' | 'SKR04' => {
  const rows = db
    .prepare(
      `
      SELECT chart, COUNT(*) as c
      FROM ledger_accounts
      GROUP BY chart
      `,
    )
    .all() as Array<{ chart: string; c: number }>;

  const byChart = rows.reduce(
    (acc, row) => {
      if (row.chart === 'SKR03') acc.SKR03 = row.c;
      if (row.chart === 'SKR04') acc.SKR04 = row.c;
      return acc;
    },
    { SKR03: 0, SKR04: 0 },
  );

  return byChart.SKR03 >= byChart.SKR04 ? 'SKR03' : 'SKR04';
};

const countLedgerAccounts = (db: Database.Database): number => {
  const row = db.prepare('SELECT COUNT(*) as c FROM ledger_accounts').get() as { c: number };
  return Number(row.c || 0);
};

const ledgerAccountExists = (db: Database.Database, accountNumber: string): boolean => {
  const row = db
    .prepare('SELECT 1 FROM ledger_accounts WHERE account_number = ? LIMIT 1')
    .get(accountNumber) as { 1: 1 } | undefined;
  return Boolean(row);
};

const findFirstLedgerAccountByChart = (
  db: Database.Database,
  chart: 'SKR03' | 'SKR04',
): string | undefined => {
  const row = db
    .prepare(
      `
      SELECT account_number
      FROM ledger_accounts
      WHERE chart = ?
      ORDER BY account_number
      LIMIT 1
      `,
    )
    .get(chart) as { account_number: string } | undefined;
  return row?.account_number;
};

const findFirstLedgerAccountAny = (db: Database.Database): string | undefined => {
  const row = db
    .prepare(
      `
      SELECT account_number
      FROM ledger_accounts
      ORDER BY chart, account_number
      LIMIT 1
      `,
    )
    .get() as { account_number: string } | undefined;
  return row?.account_number;
};

const fallbackSkrAccountNumber = (
  db: Database.Database,
  preferredChart: 'SKR03' | 'SKR04',
): string => {
  const preferred = DEFAULT_BANK_ACCOUNT_BY_CHART[preferredChart];
  const byChart = db
    .prepare(
      `
      SELECT account_number
      FROM ledger_accounts
      WHERE chart = ? AND account_number = ?
      LIMIT 1
      `,
    )
    .get(preferredChart, preferred) as { account_number: string } | undefined;
  if (byChart?.account_number) return byChart.account_number;

  const firstByChart = findFirstLedgerAccountByChart(db, preferredChart);
  if (firstByChart) return firstByChart;

  const firstAny = findFirstLedgerAccountAny(db);
  if (firstAny) return firstAny;

  return preferred;
};

const resolveDefaultSkrAccountNumber = (
  db: Database.Database,
  candidate: string | undefined | null,
  preferredChart: 'SKR03' | 'SKR04',
): string => {
  const normalized = String(candidate ?? '').trim();
  if (!normalized) {
    return fallbackSkrAccountNumber(db, preferredChart);
  }

  if (countLedgerAccounts(db) === 0) {
    return normalized;
  }

  return ledgerAccountExists(db, normalized)
    ? normalized
    : fallbackSkrAccountNumber(db, preferredChart);
};

export const listAccounts = (db: Database.Database): Account[] => {
  const activeChart = getActiveChart(db);
  const accountRows = db.prepare('SELECT * FROM accounts ORDER BY name ASC').all() as AccountRow[];
  const txRows = db
    .prepare('SELECT * FROM transactions ORDER BY account_id, date DESC')
    .all() as TransactionRow[];

  const txByAccount = new Map<string, Transaction[]>();
  for (const t of txRows) {
    const list = txByAccount.get(t.account_id) ?? [];
    list.push({
      id: t.id,
      date: t.date,
      amount: t.amount,
      type: t.type as 'income' | 'expense',
      counterparty: t.counterparty,
      purpose: t.purpose,
      linkedInvoiceId: t.linked_invoice_id ?? undefined,
      status: t.status as 'pending' | 'booked' | 'open' | 'matched',
    });
    txByAccount.set(t.account_id, list);
  }

  return accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    iban: a.iban,
    balance: a.balance,
    defaultSkrAccountNumber: resolveDefaultSkrAccountNumber(
      db,
      a.default_skr_account_number,
      activeChart,
    ),
    type: a.type as Account['type'],
    color: a.color,
    transactions: txByAccount.get(a.id) ?? [],
  }));
};

export const upsertAccount = (db: Database.Database, account: Account): Account => {
  const tx = db.transaction(() => {
    const activeChart = getActiveChart(db);
    const defaultSkrAccountNumber = resolveDefaultSkrAccountNumber(
      db,
      account.defaultSkrAccountNumber,
      activeChart,
    );
    const nextAccount: Account = { ...account, defaultSkrAccountNumber };

    const exists = db.prepare('SELECT 1 FROM accounts WHERE id = ?').get(account.id) as
      | { 1: 1 }
      | undefined;

    if (!exists) {
      db.prepare(
        `
          INSERT INTO accounts (id, name, iban, balance, default_skr_account_number, type, color)
          VALUES (@id, @name, @iban, @balance, @defaultSkrAccountNumber, @type, @color)
        `,
      ).run({
        id: nextAccount.id,
        name: nextAccount.name,
        iban: nextAccount.iban,
        balance: nextAccount.balance,
        defaultSkrAccountNumber: nextAccount.defaultSkrAccountNumber,
        type: nextAccount.type,
        color: nextAccount.color,
      });
    } else {
      db.prepare(
        `
          UPDATE accounts SET
            name=@name,
            iban=@iban,
            balance=@balance,
            default_skr_account_number=@defaultSkrAccountNumber,
            type=@type,
            color=@color
          WHERE id=@id
        `,
      ).run({
        id: nextAccount.id,
        name: nextAccount.name,
        iban: nextAccount.iban,
        balance: nextAccount.balance,
        defaultSkrAccountNumber: nextAccount.defaultSkrAccountNumber,
        type: nextAccount.type,
        color: nextAccount.color,
      });
    }

    db.prepare('DELETE FROM transactions WHERE account_id = ?').run(nextAccount.id);
    const insertTx = db.prepare(
      `
        INSERT INTO transactions (
          id, account_id, date, amount, type, counterparty, purpose, linked_invoice_id, status
        ) VALUES (
          @id, @accountId, @date, @amount, @type, @counterparty, @purpose, @linkedInvoiceId, @status
        )
      `,
    );
    for (const t of nextAccount.transactions ?? []) {
      insertTx.run({
        id: t.id,
        accountId: nextAccount.id,
        date: t.date,
        amount: t.amount,
        type: t.type,
        counterparty: t.counterparty,
        purpose: t.purpose,
        linkedInvoiceId: t.linkedInvoiceId ?? null,
        status: t.status,
      });
    }

    return nextAccount;
  });

  return tx();
};

export const deleteAccount = (db: Database.Database, id: string): void => {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM transactions WHERE account_id = ?').run(id);
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  });
  tx();
};

export const ensureAccountDefaultSkrMappings = (db: Database.Database): void => {
  const activeChart = getActiveChart(db);
  const rows = db
    .prepare('SELECT id, default_skr_account_number FROM accounts ORDER BY id ASC')
    .all() as Array<{ id: string; default_skr_account_number: string | null }>;
  if (!rows.length) return;

  const update = db.prepare(
    `
      UPDATE accounts
      SET default_skr_account_number = ?
      WHERE id = ?
    `,
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      const resolved = resolveDefaultSkrAccountNumber(
        db,
        row.default_skr_account_number,
        activeChart,
      );
      if ((row.default_skr_account_number ?? '').trim() === resolved) {
        continue;
      }
      update.run(resolved, row.id);
    }
  });

  tx();
};
