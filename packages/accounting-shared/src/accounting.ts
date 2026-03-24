export type BookingWorkflowStatus =
  | 'imported'
  | 'suggested'
  | 'incomplete'
  | 'ready_for_review'
  | 'pending_approval'
  | 'approved'
  | 'posted'
  | 'reversed'
  | 'corrected'
  | 'period_locked'
  | 'integration_error';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  code: string;
  severity: ValidationSeverity;
  message: string;
  fieldPath?: string;
  blocking: boolean;
  source: 'system' | 'user' | 'rule';
}

export interface JournalLine {
  id: string;
  accountNumber: string;
  debitAmount: number;
  creditAmount: number;
  taxCode?: string;
  costCenter?: string;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  postingDate: string;
  documentDate?: string;
  bookingText: string;
  reference?: string;
  period: string;
  fiscalYear: number;
  status: 'posted' | 'reversed';
  lines: JournalLine[];
}

export interface LedgerBalance {
  accountNumber: string;
  openingBalance: number;
  debitTurnover: number;
  creditTurnover: number;
  closingBalance: number;
}

export interface ReportGenerationContext {
  mandantId: string;
  chart: 'SKR03' | 'SKR04';
  mappingVersion: string;
  asOfDate: string;
}

export interface BookingDraftLineEntity {
  id: string;
  accountNumber: string;
  debitAmount: number;
  creditAmount: number;
  taxCode?: string;
  costCenter?: string;
  memo?: string;
}

export interface BookingDraftEntity {
  id: string;
  tenantId: string;
  transactionId: string;
  workflowStatus: BookingWorkflowStatus;
  postingDate?: string;
  documentDate?: string;
  bookingText: string;
  reference?: string;
  period: string;
  fiscalYear: number;
  lines: BookingDraftLineEntity[];
  validationIssues: ValidationIssue[];
  updatedAt: string;
}

export interface JournalLineEntity {
  id: string;
  accountNumber: string;
  debitAmount: number;
  creditAmount: number;
  taxCode?: string;
  costCenter?: string;
  memo?: string;
}

export interface JournalEntryEntity {
  id: string;
  tenantId: string;
  entryNumber: number;
  postingDate: string;
  documentDate?: string;
  bookingText: string;
  reference?: string;
  period: string;
  fiscalYear: number;
  status: 'posted' | 'reversed';
  sourceDraftId?: string;
  reversedEntryId?: string;
  createdAt: string;
  lines: JournalLineEntity[];
}

export interface AccountingPeriod {
  id: string;
  tenantId: string;
  period: string;
  fiscalYear: number;
  status: 'open' | 'soft_locked' | 'closed';
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatevExportResult {
  id: string;
  filePath: string;
  recordCount: number;
  fromDate?: string;
  toDate?: string;
  createdAt: string;
}
