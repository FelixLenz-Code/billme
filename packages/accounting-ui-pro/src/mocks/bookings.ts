import { BookingDraft } from '../types';

function baseDraft(partial: Partial<BookingDraft> & Pick<BookingDraft, 'id' | 'transactionId' | 'workflowStatus'>): BookingDraft {
  return {
    id: partial.id,
    transactionId: partial.transactionId,
    workflowStatus: partial.workflowStatus,
    documentDate: partial.documentDate,
    postingDate: partial.postingDate,
    serviceDate: partial.serviceDate,
    bookingText: partial.bookingText ?? '',
    externalReference: partial.externalReference,
    chartFramework: 'SKR03',
    lines: partial.lines ?? [],
    validationIssues: partial.validationIssues ?? [],
    activity: partial.activity ?? [],
    assignedTo: partial.assignedTo,
    approval: partial.approval ?? { required: false, status: 'not_required' },
  };
}

export const mockBookingDrafts: BookingDraft[] = [
  baseDraft({
    id: 'bd-1',
    transactionId: 'tx-1',
    workflowStatus: 'incomplete',
    documentDate: '2026-02-24',
    postingDate: '2026-02-24',
    bookingText: 'Softwarelizenz Februar',
    externalReference: 'RE-2026-10-42',
    lines: [
      { id: 'l1', accountId: '4930', accountName: 'Bürobedarf', type: 'Soll', amount: 119, taxCode: 'VSt19' },
      { id: 'l2', accountId: '1200', accountName: 'Bank', type: 'Haben', amount: 119 },
    ],
    approval: { required: false, status: 'not_required' },
    activity: [
      { id: 'e1', at: new Date().toISOString(), actorId: 'u1', actorName: 'Mara Buchhaltung', type: 'state_changed', label: 'Entwurf erstellt' },
    ],
  }),
  baseDraft({
    id: 'bd-2',
    transactionId: 'tx-2',
    workflowStatus: 'pending_approval',
    documentDate: '2026-02-23',
    postingDate: '2026-02-23',
    bookingText: 'Kundenzahlung Projekt A',
    lines: [
      { id: 'l1', accountId: '1200', accountName: 'Bank', type: 'Soll', amount: 2500 },
      { id: 'l2', accountId: '8400', accountName: 'Erlöse 19% USt (SKR03)', type: 'Haben', amount: 2500, taxCode: 'USt19' },
    ],
    approval: { required: true, status: 'pending' },
    activity: [
      { id: 'e2', at: new Date().toISOString(), actorId: 'u1', actorName: 'Mara Buchhaltung', type: 'state_changed', label: 'Zur Freigabe eingereicht' },
    ],
  }),
  baseDraft({
    id: 'bd-3',
    transactionId: 'tx-3',
    workflowStatus: 'incomplete',
    documentDate: '2026-02-22',
    postingDate: '2026-02-22',
    bookingText: '',
    lines: [
      { id: 'l1', accountId: '4530', accountName: 'Kfz-Kosten', type: 'Soll', amount: 85.5 },
      { id: 'l2', accountId: '1200', accountName: 'Bank', type: 'Haben', amount: 80.5 },
    ],
    approval: { required: false, status: 'not_required' },
  }),
  baseDraft({
    id: 'bd-4',
    transactionId: 'tx-4',
    workflowStatus: 'posted',
    documentDate: '2026-02-20',
    postingDate: '2026-02-20',
    bookingText: 'Bürobedarf Bestellung 99281',
    lines: [
      { id: 'l1', accountId: '4930', accountName: 'Bürobedarf', type: 'Soll', amount: 45.2, taxCode: 'VSt19' },
      { id: 'l2', accountId: '1200', accountName: 'Bank', type: 'Haben', amount: 45.2 },
    ],
    approval: { required: true, status: 'approved', reviewerId: 'u2', reviewerName: 'Rene Review', reviewedAt: new Date().toISOString() },
    activity: [
      { id: 'e4', at: new Date().toISOString(), actorId: 'u2', actorName: 'Rene Review', type: 'state_changed', label: 'Freigegeben' },
      { id: 'e5', at: new Date().toISOString(), actorId: 'u3', actorName: 'Anja Accountant', type: 'booking_posted', label: 'Buchung gebucht' },
    ],
  }),
  baseDraft({
    id: 'bd-5',
    transactionId: 'tx-5',
    workflowStatus: 'approved',
    documentDate: '2025-12-28',
    postingDate: '2025-12-29',
    bookingText: 'Hosting Jahresrechnung',
    lines: [
      { id: 'l1', accountId: '4980', accountName: 'Betriebsbedarf', type: 'Soll', amount: 600, taxCode: 'VSt19' },
      { id: 'l2', accountId: '1200', accountName: 'Bank', type: 'Haben', amount: 600 },
    ],
    approval: { required: true, status: 'approved', reviewerId: 'u2', reviewerName: 'Rene Review', reviewedAt: new Date().toISOString() },
  }),
  baseDraft({
    id: 'bd-6',
    transactionId: 'tx-6',
    workflowStatus: 'suggested',
    documentDate: '2026-02-19',
    postingDate: '2026-02-19',
    bookingText: 'Kundenzahlung Projekt A',
    lines: [
      { id: 'l1', accountId: '1200', accountName: 'Bank', type: 'Soll', amount: 2500 },
      { id: 'l2', accountId: '8400', accountName: 'Erlöse 19% USt (SKR03)', type: 'Haben', amount: 2500, taxCode: 'USt19' },
    ],
    approval: { required: true, status: 'not_required' },
  }),
];

