import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { afterEach, describe, expect, it } from 'vitest';
import { importSkrCharts, ensureSkrChartsImported } from './skrImport';

const require = createRequire(import.meta.url);
const BetterSqlite = (() => {
  try {
    const ctor = require('better-sqlite3');
    const probe = new ctor(':memory:');
    probe.close();
    return ctor;
  } catch {
    return null;
  }
})();

const describeIfSqlite = BetterSqlite ? describe : describe.skip;

const createLedgerDb = () => {
  if (!BetterSqlite) {
    throw new Error('better-sqlite3 unavailable');
  }
  const db = new BetterSqlite(':memory:');
  db.exec(`
    CREATE TABLE ledger_accounts (
      id TEXT PRIMARY KEY,
      chart TEXT NOT NULL CHECK (chart IN ('SKR03', 'SKR04')),
      account_number TEXT NOT NULL,
      name TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_ledger_accounts_chart_number
      ON ledger_accounts(chart, account_number);
    CREATE INDEX idx_ledger_accounts_chart
      ON ledger_accounts(chart);
    CREATE INDEX idx_ledger_accounts_name
      ON ledger_accounts(name);
  `);
  return db;
};

const tempDirs: string[] = [];
const mkTmpDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skr-import-test-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describeIfSqlite('skrImport', () => {
  it('imports SKR rows from CSV fallback', () => {
    const dir = mkTmpDir();
    fs.writeFileSync(
      path.join(dir, 'skr03_konten.csv'),
      'konto,bezeichnung\n1200,Bank\n8400,Erlöse 19% USt\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(dir, 'skr04_konten.csv'),
      'konto,bezeichnung\n1800,Bank SKR04\n4400,Erlöse SKR04\n',
      'utf8',
    );

    const db = createLedgerDb();
    const result = importSkrCharts(db, {
      preferredSource: 'csv',
      sourceDir: dir,
    });

    expect(result.source).toBe('csv');
    expect(result.inserted).toBe(4);
    expect(result.updated).toBe(0);
    expect(result.stats.total).toBe(4);
    expect(result.stats.byChart.SKR03).toBe(2);
    expect(result.stats.byChart.SKR04).toBe(2);
    db.close();
  });

  it('imports SKR rows from SQLite source when available', () => {
    const dir = mkTmpDir();
    const sqlitePath = path.join(dir, 'skr-kontenrahmen.sqlite');
    if (!BetterSqlite) throw new Error('better-sqlite3 unavailable');
    const sourceDb = new BetterSqlite(sqlitePath);
    sourceDb.exec(`
      CREATE TABLE skr_accounts (
        chart TEXT NOT NULL,
        account_number TEXT NOT NULL,
        name TEXT NOT NULL
      );
    `);
    sourceDb
      .prepare(
        'INSERT INTO skr_accounts (chart, account_number, name) VALUES (?, ?, ?), (?, ?, ?)',
      )
      .run('SKR03', '1200', 'Bank', 'SKR04', '1800', 'Bank SKR04');
    sourceDb.close();

    const db = createLedgerDb();
    const result = importSkrCharts(db, {
      preferredSource: 'sqlite',
      sqlitePath,
    });

    expect(result.source).toBe('sqlite');
    expect(result.total).toBe(2);
    expect(result.stats.byChart.SKR03).toBe(1);
    expect(result.stats.byChart.SKR04).toBe(1);
    db.close();
  });

  it('resolves root doppelteBuchhaltung when cwd is apps/pro-desktop', () => {
    const workspaceRoot = mkTmpDir();
    const appDir = path.join(workspaceRoot, 'apps', 'pro-desktop');
    const sourceDir = path.join(workspaceRoot, 'doppelteBuchhaltung');
    fs.mkdirSync(appDir, { recursive: true });
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(
      path.join(sourceDir, 'skr03_konten.csv'),
      'konto,bezeichnung\n1200,Bank\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(sourceDir, 'skr04_konten.csv'),
      'konto,bezeichnung\n1800,Bank SKR04\n',
      'utf8',
    );

    const previousCwd = process.cwd();
    const db = createLedgerDb();
    try {
      process.chdir(appDir);
      const result = importSkrCharts(db, { preferredSource: 'csv' });
      expect(result.source).toBe('csv');
      expect(result.total).toBe(2);
      expect(result.stats.byChart.SKR03).toBe(1);
      expect(result.stats.byChart.SKR04).toBe(1);
    } finally {
      process.chdir(previousCwd);
      db.close();
    }
  });

  it('skips auto-import when ledger accounts already exist', () => {
    const db = createLedgerDb();
    db.prepare(
      `
      INSERT INTO ledger_accounts (id, chart, account_number, name, source, created_at, updated_at)
      VALUES ('ledger:SKR03:1200', 'SKR03', '1200', 'Bank', 'manual', ?, ?)
    `,
    ).run(new Date().toISOString(), new Date().toISOString());

    const result = ensureSkrChartsImported(db, {});
    expect(result.performed).toBe(false);
    expect(result.reason).toBe('already-present');
    db.close();
  });
});
