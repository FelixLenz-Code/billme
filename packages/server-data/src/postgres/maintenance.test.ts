import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSingleTenantScope,
  runMaintenanceSweep,
  type AuditEntry,
  type AuditEntryDraft,
} from '@billme/server-core';
import {
  createPostgresMaintenanceRepository,
  deleteServerSqliteImportRunsBefore,
} from './billing.js';
import type { PostgresQueryable } from './connection.js';

const scope = createSingleTenantScope('tenant-1', 'lite');

test('runMaintenanceSweep applies explicit retention policies and audits deletions', async () => {
  const calls: Array<{ kind: string; args: Record<string, unknown> }> = [];
  const auditEntries: AuditEntryDraft[] = [];

  const result = await runMaintenanceSweep(scope, {
    clock: {
      now: () => new Date('2026-06-15T12:00:00.000Z'),
      nowIso: () => '2026-06-15T12:00:00.000Z',
    },
    retentionRepo: {
      async deleteReleasedNumberReservations(_scope, args) {
        calls.push({ kind: 'released-number-reservations', args });
        return 2;
      },
      async deleteSqliteImportRuns(_scope, args) {
        calls.push({ kind: 'sqlite-import-runs', args });
        return 1;
      },
    },
    auditLog: {
      append(_scope, entry) {
        auditEntries.push(entry);
        return {
          sequence: 1,
          ...entry,
          prevHash: null,
          hash: 'maintenance-hash',
        } satisfies AuditEntry;
      },
    },
  });

  assert.equal(result.totalDeleted, 3);
  assert.deepEqual(calls, [
    {
      kind: 'released-number-reservations',
      args: { updatedBefore: '2026-03-17T12:00:00.000Z' },
    },
    {
      kind: 'sqlite-import-runs',
      args: {
        completedBefore: '2025-06-15T12:00:00.000Z',
        statuses: ['completed', 'failed'],
      },
    },
  ]);
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0]?.action, 'maintenance.retention');
  assert.deepEqual(result.steps, [
    {
      key: 'released-number-reservations',
      retentionDays: 90,
      deleteBefore: '2026-03-17T12:00:00.000Z',
      deletedCount: 2,
    },
    {
      key: 'sqlite-import-runs',
      retentionDays: 365,
      deleteBefore: '2025-06-15T12:00:00.000Z',
      deletedCount: 1,
    },
  ]);
});

test('createPostgresMaintenanceRepository issues targeted delete statements', async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    async query(sql: string, params?: unknown[]) {
      queries.push({ sql, params: params ?? [] });
      return {
        rowCount: queries.length === 1 ? 4 : 2,
        rows: [],
      };
    },
  } as unknown as PostgresQueryable;

  const repository = createPostgresMaintenanceRepository(db);
  const releasedDeleted = await repository.deleteReleasedNumberReservations(scope, {
    updatedBefore: '2026-03-17T12:00:00.000Z',
  });
  const importRunsDeleted = await repository.deleteSqliteImportRuns(scope, {
    completedBefore: '2025-06-15T12:00:00.000Z',
    statuses: ['completed', 'failed'],
  });

  assert.equal(releasedDeleted, 4);
  assert.equal(importRunsDeleted, 2);
  assert.match(queries[0]?.sql ?? '', /DELETE FROM number_reservations/);
  assert.deepEqual(queries[0]?.params, ['tenant-1', '2026-03-17T12:00:00.000Z']);
  assert.match(queries[1]?.sql ?? '', /DELETE FROM sqlite_import_runs/);
  assert.deepEqual(queries[1]?.params, ['tenant-1', ['completed', 'failed'], '2025-06-15T12:00:00.000Z']);
});

test('deleteServerSqliteImportRunsBefore skips empty status lists', async () => {
  const db = {
    async query() {
      throw new Error('should not query');
    },
  } as PostgresQueryable;

  const deleted = await deleteServerSqliteImportRunsBefore(db, 'tenant-1', '2025-06-15T12:00:00.000Z', []);

  assert.equal(deleted, 0);
});
