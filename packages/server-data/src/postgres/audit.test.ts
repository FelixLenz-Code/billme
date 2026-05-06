import assert from 'node:assert/strict';
import test from 'node:test';
import { createPostgresAuditLogPort, sha256Hex, stableStringify, verifyAuditChainRows } from './audit';

test('stableStringify keeps object keys deterministic', () => {
  const left = stableStringify({ b: 2, a: 1, nested: { z: true, y: false } });
  const right = stableStringify({ nested: { y: false, z: true }, a: 1, b: 2 });
  assert.equal(left, right);
});

test('verifyAuditChainRows accepts a valid chain', () => {
  const firstPayload = {
    sequence: 1,
    ts: '2026-01-01T00:00:00.000Z',
    entityType: 'invoice',
    entityId: 'inv-1',
    action: 'created',
    reason: null,
    before: null,
    after: { id: 'inv-1' },
    prevHash: null,
    actor: 'local',
  };
  const firstHash = sha256Hex(`:${stableStringify(firstPayload)}`);
  const secondPayload = {
    sequence: 2,
    ts: '2026-01-02T00:00:00.000Z',
    entityType: 'invoice',
    entityId: 'inv-1',
    action: 'updated',
    reason: null,
    before: { id: 'inv-1' },
    after: { id: 'inv-1', status: 'paid' },
    prevHash: firstHash,
    actor: 'local',
  };
  const secondHash = sha256Hex(`${firstHash}:${stableStringify(secondPayload)}`);

  const result = verifyAuditChainRows([
    {
      sequence: 1,
      ts: firstPayload.ts,
      entity_type: firstPayload.entityType,
      entity_id: firstPayload.entityId,
      action: firstPayload.action,
      reason: null,
      before_json: null,
      after_json: JSON.stringify(firstPayload.after),
      prev_hash: null,
      hash: firstHash,
      actor: 'local',
    },
    {
      sequence: 2,
      ts: secondPayload.ts,
      entity_type: secondPayload.entityType,
      entity_id: secondPayload.entityId,
      action: secondPayload.action,
      reason: null,
      before_json: JSON.stringify(secondPayload.before),
      after_json: JSON.stringify(secondPayload.after),
      prev_hash: firstHash,
      hash: secondHash,
      actor: 'local',
    },
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
  assert.equal(result.headHash, secondHash);
});

test('verifyAuditChainRows reports hash mismatches', () => {
  const result = verifyAuditChainRows([
    {
      sequence: 1,
      ts: '2026-01-01T00:00:00.000Z',
      entity_type: 'invoice',
      entity_id: 'inv-1',
      action: 'created',
      reason: null,
      before_json: null,
      after_json: '{"id":"inv-1"}',
      prev_hash: null,
      hash: 'broken',
      actor: 'local',
    },
  ]);

  assert.equal(result.ok, false);
  assert.match(result.errors[0]?.message ?? '', /hash mismatch/);
});

test('createPostgresAuditLogPort reuses active transaction clients', async () => {
  const queries: string[] = [];
  const target = {
    async connect() {
      throw new Error('should not reconnect active transaction clients');
    },
    async query(sql: string) {
      queries.push(sql);
      if (sql.includes('SELECT pg_advisory_xact_lock($1)')) {
        return { rows: [] };
      }

      if (sql.includes('SELECT sequence, hash FROM audit_log')) {
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO audit_log')) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    release() {
      // PoolClient marker used by the type guard.
    },
  };

  const auditLog = createPostgresAuditLogPort(target as never);
  const scope = { tenantId: 'tenant-1', product: 'lite', deploymentMode: 'single-tenant' } as const;
  const entry = {
    occurredAt: '2026-01-01T00:00:00.000Z',
    action: 'client.create',
    reason: 'Regression test',
    actor: { type: 'system', displayName: 'test-runner' },
    subject: {
      entityType: 'client',
      entityId: 'client-1',
    },
    change: {
      before: null,
      after: { id: 'client-1' },
    },
  } as const;

  const appended = await auditLog.append(scope, entry);

  assert.equal(appended.sequence, 1);
  assert.equal(queries.length, 3);
  assert.match(queries[0] ?? '', /SELECT pg_advisory_xact_lock/);
  assert.match(queries[1] ?? '', /SELECT sequence, hash FROM audit_log/);
  assert.match(queries[2] ?? '', /INSERT INTO audit_log/);
});
