import { BookingDraft, Transaction } from '../types';

export interface BookingPolicy {
  requireReceiptForExpenses: boolean;
  closedPeriodsBefore: string;
}

export const defaultBookingPolicy: BookingPolicy = {
  requireReceiptForExpenses: true,
  closedPeriodsBefore: '2026-01-01',
};

export function isPostingDateClosed(postingDate: string | undefined, policy: BookingPolicy): boolean {
  if (!postingDate) return false;
  return postingDate < policy.closedPeriodsBefore;
}

export function requiresReceipt(transaction: Transaction, policy: BookingPolicy): boolean {
  return policy.requireReceiptForExpenses && transaction.amount < 0;
}

export function reviewRequiredForDraft(draft: BookingDraft): boolean {
  const gross = Math.max(
    draft.lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    0,
  );
  return gross >= 1000 || draft.lines.length > 2;
}

