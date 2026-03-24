import type { JournalEntry, ValidationIssue } from '@billme/accounting-shared';

export interface PostDraftInput {
  draftId: string;
  postingDate: string;
  documentDate?: string;
  bookingText: string;
  reference?: string;
  period: string;
  fiscalYear: number;
  lines: Array<{
    accountNumber: string;
    debitAmount: number;
    creditAmount: number;
    taxCode?: string;
    costCenter?: string;
    memo?: string;
  }>;
}

export interface PostDraftResult {
  entry: JournalEntry;
  issues: ValidationIssue[];
}

export const validateBalancedEntry = (input: PostDraftInput): ValidationIssue[] => {
  const debit = input.lines.reduce((sum, line) => sum + Number(line.debitAmount || 0), 0);
  const credit = input.lines.reduce((sum, line) => sum + Number(line.creditAmount || 0), 0);

  if (Math.abs(debit - credit) < 0.01) {
    return [];
  }

  return [
    {
      id: `unbalanced-${input.draftId}`,
      code: 'UNBALANCED_ENTRY',
      severity: 'error',
      message: 'Soll/Haben sind nicht ausgeglichen.',
      blocking: true,
      source: 'system',
    },
  ];
};

export const buildPostedEntry = (input: PostDraftInput): JournalEntry => ({
  id: `journal-${input.draftId}`,
  postingDate: input.postingDate,
  documentDate: input.documentDate,
  bookingText: input.bookingText,
  reference: input.reference,
  period: input.period,
  fiscalYear: input.fiscalYear,
  status: 'posted',
  lines: input.lines.map((line, idx) => ({
    id: `${input.draftId}-line-${idx + 1}`,
    accountNumber: line.accountNumber,
    debitAmount: Number(line.debitAmount || 0),
    creditAmount: Number(line.creditAmount || 0),
    taxCode: line.taxCode,
    costCenter: line.costCenter,
    memo: line.memo,
  })),
});
