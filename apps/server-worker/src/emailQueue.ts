import type { Clock, EmailOutboxEntry } from '@billme/server-core';
import { systemClock } from '@billme/server-core';
import type { WorkerLogger } from './logger.js';

export interface EmailQueueDispatchResult {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
}

export interface EmailQueueDispatchDependencies {
  claimDue(): Promise<EmailOutboxEntry[]>;
  send(entry: EmailOutboxEntry): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
  recordSuccess(entry: EmailOutboxEntry, args: { sentAt: string; messageId?: string }): Promise<void>;
  recordFailure(entry: EmailOutboxEntry, args: { failedAt: string; error: string; retryAt?: string }): Promise<'pending' | 'failed'>;
  clock?: Clock;
  logger?: WorkerLogger;
  isRetryableError?(error: unknown): boolean;
}

const retryScheduleMs = [5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000] as const;

export const calculateQueuedEmailRetryAt = (entry: EmailOutboxEntry, failedAt = new Date()): string => {
  const delayMs = retryScheduleMs[Math.min(entry.attemptCount, retryScheduleMs.length - 1)] ?? retryScheduleMs.at(-1) ?? 300_000;
  return new Date(failedAt.getTime() + delayMs).toISOString();
};

export const dispatchQueuedEmailBatch = async (
  dependencies: EmailQueueDispatchDependencies,
): Promise<EmailQueueDispatchResult> => {
  const clock = dependencies.clock ?? systemClock;
  const claimedEntries = await dependencies.claimDue();
  const result: EmailQueueDispatchResult = {
    claimed: claimedEntries.length,
    sent: 0,
    retried: 0,
    failed: 0,
  };

  for (const entry of claimedEntries) {
    const attemptedAt = clock.now();
    const attemptedAtIso = attemptedAt.toISOString();

    try {
      const delivery = await dependencies.send(entry);
      if (delivery.success) {
        await dependencies.recordSuccess(entry, {
          sentAt: attemptedAtIso,
          messageId: delivery.messageId,
        });
        result.sent += 1;
        continue;
      }

      const errorMessage = delivery.error ?? 'Unknown email delivery failure';
      const retryable = dependencies.isRetryableError?.(new Error(errorMessage)) ?? false;
      const nextStatus = await dependencies.recordFailure(entry, {
        failedAt: attemptedAtIso,
        error: errorMessage,
        retryAt: retryable ? calculateQueuedEmailRetryAt(entry, attemptedAt) : undefined,
      });
      if (nextStatus === 'pending') {
        result.retried += 1;
      } else {
        result.failed += 1;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const retryable = dependencies.isRetryableError?.(error) ?? false;
      dependencies.logger?.error('Queued email dispatch failed', {
        emailId: entry.id,
        documentId: entry.documentId,
        retryable,
        error: errorMessage,
      });

      const nextStatus = await dependencies.recordFailure(entry, {
        failedAt: attemptedAtIso,
        error: errorMessage,
        retryAt: retryable ? calculateQueuedEmailRetryAt(entry, attemptedAt) : undefined,
      });
      if (nextStatus === 'pending') {
        result.retried += 1;
      } else {
        result.failed += 1;
      }
    }
  }

  return result;
};
