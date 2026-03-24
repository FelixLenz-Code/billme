import type Database from 'better-sqlite3';

export type LedgerChart = 'SKR03' | 'SKR04';

export interface LedgerAccount {
  id: string;
  chart: LedgerChart;
  accountNumber: string;
  name: string;
  keywords?: string[];
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListLedgerAccountsArgs {
  chart?: LedgerChart;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UpsertLedgerAccount {
  chart: LedgerChart;
  accountNumber: string;
  name: string;
  source?: string;
}

export interface LedgerAccountStats {
  total: number;
  byChart: Record<LedgerChart, number>;
}

const toLedgerAccount = (row: {
  id: string;
  chart: string;
  account_number: string;
  name: string;
  keywords_csv: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}): LedgerAccount => ({
  id: row.id,
  chart: row.chart as LedgerChart,
  accountNumber: row.account_number,
  name: row.name,
  keywords: row.keywords_csv
    ? row.keywords_csv
      .split('|')
      .map((v) => v.trim())
      .filter(Boolean)
    : undefined,
  source: row.source,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listLedgerAccounts = (db: Database.Database, args: ListLedgerAccountsArgs = {}): LedgerAccount[] => {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (args.chart) {
    where.push('chart = @chart');
    params.chart = args.chart;
  }

  if (args.search && args.search.trim().length > 0) {
    where.push('(account_number LIKE @search OR name LIKE @search)');
    params.search = `%${args.search.trim()}%`;
  }

  const limit = Math.max(1, Math.min(10_000, Math.floor(args.limit ?? 500)));
  const offset = Math.max(0, Math.floor(args.offset ?? 0));
  params.limit = limit;
  params.offset = offset;

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `
      SELECT
        la.id,
        la.chart,
        la.account_number,
        la.name,
        (
          SELECT GROUP_CONCAT(ak.keyword, '|')
          FROM account_keywords ak
          WHERE ak.tenant_id = 'default'
            AND ak.chart = la.chart
            AND ak.account_number = la.account_number
            AND ak.active = 1
        ) AS keywords_csv,
        la.source,
        la.created_at,
        la.updated_at
      FROM ledger_accounts
      AS la
      ${whereSql}
      ORDER BY chart ASC, account_number ASC
      LIMIT @limit OFFSET @offset
    `,
    )
    .all(params) as Array<{
    id: string;
    chart: string;
    account_number: string;
    name: string;
    keywords_csv: string | null;
    source: string;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map(toLedgerAccount);
};

export const countLedgerAccounts = (db: Database.Database, chart?: LedgerChart): number => {
  if (chart) {
    const row = db
      .prepare('SELECT COUNT(*) as c FROM ledger_accounts WHERE chart = ?')
      .get(chart) as { c: number };
    return row.c;
  }

  const row = db.prepare('SELECT COUNT(*) as c FROM ledger_accounts').get() as { c: number };
  return row.c;
};

export const getLedgerAccountStats = (db: Database.Database): LedgerAccountStats => {
  const rows = db
    .prepare(
      `
      SELECT chart, COUNT(*) as c
      FROM ledger_accounts
      GROUP BY chart
    `,
    )
    .all() as Array<{ chart: string; c: number }>;

  const byChart: Record<LedgerChart, number> = {
    SKR03: 0,
    SKR04: 0,
  };

  for (const row of rows) {
    if (row.chart === 'SKR03' || row.chart === 'SKR04') {
      byChart[row.chart] = row.c;
    }
  }

  return {
    total: byChart.SKR03 + byChart.SKR04,
    byChart,
  };
};

export const upsertLedgerAccounts = (
  db: Database.Database,
  rows: UpsertLedgerAccount[],
): { inserted: number; updated: number; total: number } => {
  if (rows.length === 0) {
    return { inserted: 0, updated: 0, total: 0 };
  }

  const existingRows = db
    .prepare('SELECT chart, account_number FROM ledger_accounts')
    .all() as Array<{ chart: string; account_number: string }>;
  const existingKeys = new Set(existingRows.map((row) => `${row.chart}:${row.account_number}`));

  const upsert = db.prepare(`
    INSERT INTO ledger_accounts (id, chart, account_number, name, source, created_at, updated_at)
    VALUES (@id, @chart, @accountNumber, @name, @source, @createdAt, @updatedAt)
    ON CONFLICT(chart, account_number) DO UPDATE SET
      name = excluded.name,
      source = excluded.source,
      updated_at = excluded.updated_at
  `);

  let inserted = 0;
  let updated = 0;

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const row of rows) {
      const key = `${row.chart}:${row.accountNumber}`;
      if (existingKeys.has(key)) {
        updated += 1;
      } else {
        inserted += 1;
        existingKeys.add(key);
      }

      upsert.run({
        id: `ledger:${row.chart}:${row.accountNumber}`,
        chart: row.chart,
        accountNumber: row.accountNumber,
        name: row.name,
        source: row.source ?? 'manual',
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  tx();
  return {
    inserted,
    updated,
    total: inserted + updated,
  };
};
