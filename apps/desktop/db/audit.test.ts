import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { bootstrapSql } from './bootstrap';
import { appendAuditLog, verifyAuditChain } from './audit';

const canRunNativeSqlite = (() => {
  try {
    const probe = new Database(':memory:');
    probe.close();
    return true;
  } catch {
    return false;
  }
})();

const makeDb = () => {
  const db = new Database(':memory:');
  db.exec(bootstrapSql);
  return db;
};

describe.skipIf(!canRunNativeSqlite)('audit log serialization', () => {
  it('stores valid JSON and verifies when audited entities contain undefined fields', () => {
    const db = makeDb();

    appendAuditLog(db, {
      entityType: 'invoice',
      entityId: 'inv-1',
      action: 'create',
      reason: 'test',
      before: null,
      after: { id: 'inv-1', number: 'RE-1', servicePeriod: undefined, items: [undefined] },
    });

    const row = db
      .prepare('SELECT after_json FROM audit_log WHERE sequence = 1')
      .get() as { after_json: string | null };

    // Must be valid JSON – the old serializer emitted the bare token `undefined`.
    expect(() => JSON.parse(row.after_json ?? 'null')).not.toThrow();
    const parsed = JSON.parse(row.after_json ?? 'null');
    expect('servicePeriod' in parsed).toBe(false); // undefined property omitted (JSON semantics)
    expect(parsed.items).toEqual([null]); // undefined array element -> null

    const result = verifyAuditChain(db);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('reports a corrupt legacy row without aborting verification', () => {
    const db = makeDb();

    // Simulate a row written by the old buggy serializer (invalid JSON token).
    db.prepare(
      `INSERT INTO audit_log (sequence, ts, entity_type, entity_id, action, reason,
        before_json, after_json, prev_hash, hash, actor)
       VALUES (1, '2026-01-01T00:00:00.000Z', 'invoice', 'inv-1', 'create', NULL,
        NULL, '{"servicePeriod":undefined}', NULL, 'deadbeef', 'local')`,
    ).run();

    let result: ReturnType<typeof verifyAuditChain> | undefined;
    expect(() => {
      result = verifyAuditChain(db);
    }).not.toThrow();

    expect(result?.ok).toBe(false);
    expect(result?.count).toBe(1);
    expect(result?.errors.some((e) => e.message.includes('corrupt'))).toBe(true);
  });
});
