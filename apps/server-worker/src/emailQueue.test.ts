import assert from 'node:assert/strict';
import test from 'node:test';
import { createSingleTenantScope, type EmailOutboxEntry } from '@billme/server-core';
import { dispatchQueuedEmailBatch, calculateQueuedEmailRetryAt } from './emailQueue.js';

const scope = createSingleTenantScope('tenant-1', 'lite');

const createLogger = () => ({
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return createLogger();
  },
});

const createEntry = (overrides: Partial<EmailOutboxEntry> = {}): EmailOutboxEntry => ({
  id: 'email-1',
  tenantId: scope.tenantId,
  dedupeKey: 'dedupe-1',
  documentType: 'invoice',
  documentId: 'invoice-1',
  documentNumber: 'INV-2026-001',
  recipientEmail: 'billing@example.com',
  recipientName: 'Acme GmbH',
  subject: 'Invoice INV-2026-001',
  bodyText: 'Hello there',
  status: 'processing',
  attemptCount: 0,
  maxAttempts: 5,
  nextAttemptAt: '2026-04-20T08:00:00.000Z',
  createdAt: '2026-04-20T08:00:00.000Z',
  updatedAt: '2026-04-20T08:00:00.000Z',
  ...overrides,
});

test('dispatchQueuedEmailBatch marks successful deliveries as sent', async () => {
  const sent: Array<{ id: string; messageId?: string }> = [];

  const result = await dispatchQueuedEmailBatch({
    async claimDue() {
      return [createEntry()];
    },
    async send() {
      return { success: true as const, messageId: 'message-1' };
    },
    async recordSuccess(entry, args) {
      sent.push({ id: entry.id, messageId: args.messageId });
    },
    async recordFailure() {
      return 'failed';
    },
  });

  assert.deepEqual(result, { claimed: 1, sent: 1, retried: 0, failed: 0 });
  assert.deepEqual(sent, [{ id: 'email-1', messageId: 'message-1' }]);
});

test('dispatchQueuedEmailBatch retries retryable delivery results', async () => {
  const failures: Array<{ id: string; retryAt?: string }> = [];
  const entry = createEntry({ attemptCount: 1 });

  const result = await dispatchQueuedEmailBatch({
    async claimDue() {
      return [entry];
    },
    async send() {
      return { success: false as const, error: 'socket hang up' };
    },
    async recordSuccess() {
      return;
    },
    async recordFailure(nextEntry, args) {
      failures.push({ id: nextEntry.id, retryAt: args.retryAt });
      return 'pending';
    },
    isRetryableError(error) {
      return String(error).toLowerCase().includes('socket');
    },
  });

  assert.deepEqual(result, { claimed: 1, sent: 0, retried: 1, failed: 0 });
  assert.equal(failures[0]?.id, 'email-1');
  assert.equal(typeof failures[0]?.retryAt, 'string');
});

test('dispatchQueuedEmailBatch marks thrown permanent errors as failed', async () => {
  const failures: Array<{ id: string; error: string }> = [];

  const result = await dispatchQueuedEmailBatch({
    async claimDue() {
      return [createEntry({ id: 'email-2' })];
    },
    async send() {
      throw new Error('authentication failed');
    },
    async recordSuccess() {
      return;
    },
    async recordFailure(entry, args) {
      failures.push({ id: entry.id, error: args.error });
      return 'failed';
    },
    logger: createLogger(),
    isRetryableError(error) {
      return String(error).toLowerCase().includes('timeout');
    },
  });

  assert.deepEqual(result, { claimed: 1, sent: 0, retried: 0, failed: 1 });
  assert.equal(failures[0]?.id, 'email-2');
  assert.match(failures[0]?.error ?? '', /authentication failed/);
});

test('calculateQueuedEmailRetryAt increases with attempt count', () => {
  const base = new Date('2026-04-20T08:00:00.000Z');
  const first = calculateQueuedEmailRetryAt(createEntry({ attemptCount: 0 }), base);
  const second = calculateQueuedEmailRetryAt(createEntry({ attemptCount: 2 }), base);

  assert.equal(first, '2026-04-20T08:05:00.000Z');
  assert.equal(second, '2026-04-20T09:00:00.000Z');
});
