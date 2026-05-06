import crypto from 'node:crypto';
import type { Pool } from 'pg';
import type { AuditEntry, AuditEntryDraft, AuditSubject, TenantScope } from '@billme/server-core';
import type { AuditActor } from '@billme/server-core/ports';
import type { PostgresTransactionClient } from './connection.js';
import { withSerializablePostgresTransaction } from './connection.js';

type AuditRow = {
  sequence: string | number;
  ts: string;
  entity_type: string;
  entity_id: string;
  action: string;
  reason: string | null;
  before_json: string | null;
  after_json: string | null;
  prev_hash: string | null;
  hash: string;
  actor: string;
};

export interface AuditChainVerificationResult {
  ok: boolean;
  errors: Array<{ sequence: number; message: string }>;
  count: number;
  headHash: string | null;
}

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const body = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',');
  return `{${body}}`;
};

export const sha256Hex = (input: string): string => {
  return crypto.createHash('sha256').update(input).digest('hex');
};

export const encodeAuditActor = (actor: AuditActor): string => {
  if (actor.type === 'system' && actor.displayName === 'local' && !actor.id) {
    return 'local';
  }

  return JSON.stringify(actor);
};

export const decodeAuditActor = (value: string): AuditActor => {
  if (!value || value === 'local') {
    return { type: 'system', displayName: 'local' };
  }

  try {
    const parsed = JSON.parse(value) as AuditActor;
    if (parsed && typeof parsed === 'object' && parsed.type) {
      return parsed;
    }
  } catch {
    // ignored
  }

  return {
    type: 'system',
    displayName: value,
  };
};

export const verifyAuditChainRows = (rows: AuditRow[]): AuditChainVerificationResult => {
  const normalizedRows = rows
    .map((row) => ({
      ...row,
      sequence: Number(row.sequence),
    }))
    .sort((left, right) => left.sequence - right.sequence);

  const errors: Array<{ sequence: number; message: string }> = [];
  let expectedPrevHash: string | null = null;

  for (const row of normalizedRows) {
    if ((row.prev_hash ?? null) !== expectedPrevHash) {
      errors.push({
        sequence: row.sequence,
        message: `prev_hash mismatch (expected ${expectedPrevHash ?? 'null'})`,
      });
    }

    const payload = {
      sequence: row.sequence,
      ts: row.ts,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action,
      reason: row.reason ?? null,
      before: parseJson(row.before_json, null),
      after: parseJson(row.after_json, null),
      prevHash: row.prev_hash ?? null,
      actor: row.actor,
    };

    const computedHash = sha256Hex(`${row.prev_hash ?? ''}:${stableStringify(payload)}`);
    if (computedHash !== row.hash) {
      errors.push({ sequence: row.sequence, message: 'hash mismatch' });
    }

    expectedPrevHash = row.hash;
  }

  return {
    ok: errors.length === 0,
    errors,
    count: normalizedRows.length,
    headHash: expectedPrevHash,
  };
};

const rowToAuditEntry = (scope: TenantScope, row: AuditRow, subject: AuditSubject): AuditEntry => ({
  sequence: Number(row.sequence),
  occurredAt: row.ts,
  action: row.action,
  reason: row.reason ?? undefined,
  actor: decodeAuditActor(row.actor),
  subject: {
    entityType: row.entity_type,
    entityId: row.entity_id,
    tenantId: subject.tenantId ?? scope.tenantId,
  },
  change: {
    before: parseJson(row.before_json, null),
    after: parseJson(row.after_json, null),
  },
  prevHash: row.prev_hash,
  hash: row.hash,
});

const appendWithClient = async (
  client: PostgresTransactionClient,
  scope: TenantScope,
  entry: AuditEntryDraft,
): Promise<AuditEntry> => {
  await client.query('SELECT pg_advisory_xact_lock($1)', [772233]);

  const previous = await client.query<{ sequence: string; hash: string }>(
    'SELECT sequence, hash FROM audit_log ORDER BY sequence DESC LIMIT 1 FOR UPDATE',
  );

  const previousSequence = Number(previous.rows[0]?.sequence ?? 0);
  const sequence = previousSequence + 1;
  const prevHash = previous.rows[0]?.hash ?? null;
  const actor = encodeAuditActor(entry.actor);
  const beforeJson = entry.change?.before === undefined ? null : stableStringify(entry.change.before);
  const afterJson = entry.change?.after === undefined ? null : stableStringify(entry.change.after);
  const payload = {
    sequence,
    ts: entry.occurredAt,
    entityType: entry.subject.entityType,
    entityId: entry.subject.entityId,
    action: entry.action,
    reason: entry.reason ?? null,
    before: entry.change?.before ?? null,
    after: entry.change?.after ?? null,
    prevHash,
    actor,
  };
  const hash = sha256Hex(`${prevHash ?? ''}:${stableStringify(payload)}`);

  await client.query(
    `
      INSERT INTO audit_log (
        tenant_id,
        sequence,
        ts,
        entity_type,
        entity_id,
        action,
        reason,
        before_json,
        after_json,
        prev_hash,
        hash,
        actor
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8::text, $9::text, $10, $11, $12
      )
    `,
    [
      entry.subject.tenantId ?? scope.tenantId,
      sequence,
      entry.occurredAt,
      entry.subject.entityType,
      entry.subject.entityId,
      entry.action,
      entry.reason ?? null,
      beforeJson,
      afterJson,
      prevHash,
      hash,
      actor,
    ],
  );

  return {
    sequence,
    occurredAt: entry.occurredAt,
    action: entry.action,
    reason: entry.reason,
    actor: entry.actor,
    subject: {
      ...entry.subject,
      tenantId: entry.subject.tenantId ?? scope.tenantId,
    },
    change: entry.change,
    prevHash,
    hash,
  };
};

const isPool = (target: Pool | PostgresTransactionClient): target is Pool => {
  return !('release' in target);
};

export const createPostgresAuditLogPort = (target: Pool | PostgresTransactionClient) => ({
  async append(scope: TenantScope, entry: AuditEntryDraft): Promise<AuditEntry> {
    if (isPool(target)) {
      return withSerializablePostgresTransaction(target, (client) => appendWithClient(client, scope, entry));
    }

    return appendWithClient(target, scope, entry);
  },
  async listBySubject(scope: TenantScope, subject: AuditSubject): Promise<AuditEntry[]> {
    const result = await target.query<AuditRow>(
      `
        SELECT sequence, ts, entity_type, entity_id, action, reason, before_json, after_json, prev_hash, hash, actor
        FROM audit_log
        WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
        ORDER BY sequence DESC
      `,
      [subject.tenantId ?? scope.tenantId, subject.entityType, subject.entityId],
    );

    return result.rows.map((row) => rowToAuditEntry(scope, row, subject));
  },
});

export const verifyPostgresAuditChain = async (
  target: Pool | PostgresTransactionClient,
  tenantId?: string,
): Promise<AuditChainVerificationResult> => {
  const result = tenantId
    ? await target.query<AuditRow>(
        `
          SELECT sequence, ts, entity_type, entity_id, action, reason, before_json, after_json, prev_hash, hash, actor
          FROM audit_log
          WHERE tenant_id = $1
          ORDER BY sequence ASC
        `,
        [tenantId],
      )
    : await target.query<AuditRow>(
        `
          SELECT sequence, ts, entity_type, entity_id, action, reason, before_json, after_json, prev_hash, hash, actor
          FROM audit_log
          ORDER BY sequence ASC
        `,
      );

  return verifyAuditChainRows(result.rows);
};
