import type { EmailOutboxEntry, QueueEmailDeliveryInput } from '../domain/email-outbox.js';
import type { TenantScope } from '../domain/foundations.js';
import { systemClock, type Clock, type EmailOutboxRepository } from '../ports/index.js';
import { queueEmailDeliveryInputSchema } from '../domain/email-outbox.js';

export const defaultEmailOutboxMaxAttempts = 5;

export const buildEmailOutboxDedupeKey = (input: Pick<
  QueueEmailDeliveryInput,
  'documentType' | 'documentId' | 'documentNumber' | 'recipientEmail' | 'recipientName' | 'subject' | 'bodyText'
>): string => {
  return JSON.stringify([
    'v1',
    input.documentType,
    input.documentId,
    input.documentNumber,
    input.recipientEmail.trim().toLowerCase(),
    input.recipientName.trim(),
    input.subject,
    input.bodyText,
  ]);
};

export interface QueueEmailDeliveryDependencies {
  outboxRepo: Pick<EmailOutboxRepository, 'enqueue'>;
  clock?: Clock;
}

export const queueEmailDelivery = async (
  scope: TenantScope,
  dependencies: QueueEmailDeliveryDependencies,
  input: QueueEmailDeliveryInput,
): Promise<EmailOutboxEntry> => {
  const payload = queueEmailDeliveryInputSchema.parse(input);
  const clock = dependencies.clock ?? systemClock;

  return dependencies.outboxRepo.enqueue(scope, {
    ...payload,
    dedupeKey: payload.dedupeKey ?? buildEmailOutboxDedupeKey(payload),
    maxAttempts: payload.maxAttempts ?? defaultEmailOutboxMaxAttempts,
    nextAttemptAt: payload.nextAttemptAt ?? clock.nowIso(),
  });
};
