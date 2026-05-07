import { BookingWorkflowStatus, Transaction, TransactionFlag } from '../types';

export type InboxQueueKey =
  | 'all'
  | 'incomplete'
  | 'review'
  | 'approval'
  | 'posted'
  | 'errors'
  | 'missing_receipt'
  | 'duplicates';

export const inboxQueueLabels: Record<InboxQueueKey, string> = {
  all: 'Alle',
  incomplete: 'Unvollständig',
  review: 'Zur Prüfung',
  approval: 'Freigabe',
  posted: 'Gebucht',
  errors: 'Fehler',
  missing_receipt: 'Ohne Beleg',
  duplicates: 'Dubletten',
};

export function txMatchesQueue(tx: Transaction, queue: InboxQueueKey): boolean {
  switch (queue) {
    case 'all':
      return true;
    case 'incomplete':
      return ['incomplete', 'suggested', 'period_locked'].includes(tx.workflowStatus);
    case 'review':
      return tx.workflowStatus === 'ready_for_review';
    case 'approval':
      return tx.workflowStatus === 'pending_approval' || tx.workflowStatus === 'approved';
    case 'posted':
      return ['posted', 'reversed', 'corrected'].includes(tx.workflowStatus);
    case 'errors':
      return tx.issueCounts.errors > 0 || tx.workflowStatus === 'integration_error';
    case 'missing_receipt':
      return tx.flags.includes('missing_receipt');
    case 'duplicates':
      return tx.flags.includes('duplicate_suspected');
    default:
      return true;
  }
}

export function getQueueCounts(transactions: Transaction[]): Record<InboxQueueKey, number> {
  return (Object.keys(inboxQueueLabels) as InboxQueueKey[]).reduce((acc, queue) => {
    acc[queue] = transactions.filter((tx) => txMatchesQueue(tx, queue)).length;
    return acc;
  }, {} as Record<InboxQueueKey, number>);
}

export function getStatusPresentation(status: BookingWorkflowStatus): {
  label: string;
  className: string;
} {
  const map: Record<BookingWorkflowStatus, { label: string; className: string }> = {
    imported: { label: 'Neu', className: 'bg-gray-100 text-gray-700' },
    suggested: { label: 'Vorschlag', className: 'bg-blue-100 text-blue-700' },
    incomplete: { label: 'Unvollständig', className: 'bg-amber-100 text-amber-800' },
    ready_for_review: { label: 'Zur Prüfung', className: 'bg-indigo-100 text-indigo-700' },
    pending_approval: { label: 'Freigabe offen', className: 'bg-violet-100 text-violet-700' },
    approved: { label: 'Freigegeben', className: 'bg-cyan-100 text-cyan-700' },
    posted: { label: 'Gebucht', className: 'bg-emerald-100 text-emerald-800' },
    reversed: { label: 'Storniert', className: 'bg-rose-100 text-rose-700' },
    corrected: { label: 'Korrigiert', className: 'bg-orange-100 text-orange-700' },
    period_locked: { label: 'Periode gesperrt', className: 'bg-red-100 text-red-700' },
    integration_error: { label: 'Integrationsfehler', className: 'bg-red-100 text-red-800' },
  };
  return map[status];
}

export function getFlagLabel(flag: TransactionFlag): string {
  const labels: Record<TransactionFlag, string> = {
    missing_receipt: 'Ohne Beleg',
    duplicate_suspected: 'Dublette?',
    tax_unclear: 'Steuer unklar',
    period_locked: 'Periode gesperrt',
  };
  return labels[flag];
}

