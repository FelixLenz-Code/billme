import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

export interface AppliedMigrationsResult {
  applied: string[];
  skipped: string[];
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'sql');

const ensureMigrationsTable = async (pool: Pool): Promise<void> => {
  await pool.query(
    `
      CREATE TABLE IF NOT EXISTS server_schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `,
  );
};

const checksum = (value: string): string => createHash('sha256').update(value).digest('hex');

export const runPostgresMigrations = async (pool: Pool): Promise<AppliedMigrationsResult> => {
  await ensureMigrationsTable(pool);

  const entries = (await readdir(migrationsDir))
    .filter((entry) => entry.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    const sql = await readFile(join(migrationsDir, entry), 'utf8');
    const nextChecksum = checksum(sql);
    const existing = await pool.query<{ checksum: string }>(
      'SELECT checksum FROM server_schema_migrations WHERE name = $1 LIMIT 1',
      [entry],
    );

    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== nextChecksum) {
        throw new Error(`Migration checksum mismatch for ${entry}`);
      }
      skipped.push(entry);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO server_schema_migrations (name, checksum, applied_at) VALUES ($1, $2, $3)',
        [entry, nextChecksum, new Date().toISOString()],
      );
      await client.query('COMMIT');
      applied.push(entry);
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors and rethrow original problem
      }
      throw error;
    } finally {
      client.release();
    }
  }

  return { applied, skipped };
};
