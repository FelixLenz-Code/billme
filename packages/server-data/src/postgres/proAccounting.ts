import { randomUUID } from 'node:crypto';
import type {
  AccountSuggestionRule,
  AccountSuggestionRuleField,
  AccountSuggestionRuleFlowType,
  AccountSuggestionRuleOperator,
  DatevExportResult,
  LedgerAccount,
  LedgerAccountStats,
  ListLedgerAccountsArgs,
  ProBankTransaction,
  ProWorkflowEntry,
  TaxCaseAccountMapping,
  TaxCaseDefinition,
  UpsertAccountSuggestionRuleInput,
  ValidationIssue,
} from '@billme/accounting-shared';
import type { ProAccountingCatalogRepository, ProWorkflowRepository, TenantScope } from '@billme/server-core';
import type { PostgresQueryable } from './connection.js';

const toNumber = (value: string | number): number => (typeof value === 'number' ? value : Number(value));
const getTenantId = (scope: TenantScope): string => scope.tenantId;
const nowIso = (): string => new Date().toISOString();

export interface ServerArticleRecord {
  id: string;
  tenantId: string;
  sku?: string;
  title: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  taxRate: number;
}

export interface ServerBankAccountRecord {
  id: string;
  tenantId: string;
  name: string;
  iban: string;
  balance: number;
  defaultSkrAccountNumber: string;
  type: string;
  color: string;
}

export interface ServerTemplateRecord {
  id: string;
  tenantId: string;
  kind: string;
  name: string;
  elementsJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerActiveTemplatesRecord {
  tenantId: string;
  id: number;
  invoiceTemplateId?: string;
  offerTemplateId?: string;
}

export interface ServerProWorkflowRecord extends ProWorkflowEntry {
  tenantId: string;
}

export interface ServerBankTransactionRecord extends ProBankTransaction {
  sourceTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerBookingDraftRecord {
  id: string;
  tenantId: string;
  transactionId: string;
  workflowStatus: string;
  draftJson: string;
  updatedAt: string;
}

export interface ServerBookingDraftLineRecord {
  id: string;
  tenantId: string;
  draftId: string;
  lineNo: number;
  accountNumber: string;
  debitAmount: number;
  creditAmount: number;
  taxCode?: string;
  taxCaseKey?: string;
  taxRate?: number;
  netAmount?: number;
  taxAmount?: number;
  grossAmount?: number;
  countryCode?: string;
  counterpartyVatId?: string;
  evidenceType?: string;
  evidenceReference?: string;
  costCenter?: string;
  memo?: string;
}

export interface ServerDraftValidationIssueRecord {
  id: string;
  tenantId: string;
  draftId: string;
  code: string;
  severity: ValidationIssue['severity'];
  message: string;
  fieldPath?: string;
  blocking: boolean;
  source: ValidationIssue['source'];
  issueJson: string;
  createdAt: string;
}

export interface ServerAccountingPeriodRecord {
  id: string;
  tenantId: string;
  period: string;
  fiscalYear: number;
  status: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerJournalEntryRecord {
  id: string;
  tenantId: string;
  entryNumber: number;
  postingDate: string;
  documentDate?: string;
  bookingText: string;
  reference?: string;
  period: string;
  fiscalYear: number;
  status: string;
  sourceDraftId?: string;
  reversedEntryId?: string;
  createdAt: string;
}

export interface ServerJournalLineRecord {
  id: string;
  tenantId: string;
  entryId: string;
  lineNo: number;
  accountNumber: string;
  debitAmount: number;
  creditAmount: number;
  taxCode?: string;
  taxCaseKey?: string;
  taxRate?: number;
  netAmount?: number;
  taxAmount?: number;
  grossAmount?: number;
  countryCode?: string;
  counterpartyVatId?: string;
  evidenceType?: string;
  evidenceReference?: string;
  costCenter?: string;
  memo?: string;
}

export interface ServerAccountMappingHgbRecord {
  id: string;
  tenantId: string;
  chart: string;
  accountNumber: string;
  statementType: string;
  positionKey: string;
  positionLabel: string;
  balanceSide?: string;
  updatedAt: string;
}

export interface ServerReportSnapshotRecord {
  id: string;
  tenantId: string;
  reportType: string;
  argsJson: string;
  payloadJson: string;
  createdAt: string;
}

export interface ServerDatevExportRecord extends DatevExportResult {
  tenantId: string;
  metaJson: string;
}

export interface ServerVatEvidenceRecord {
  id: string;
  tenantId: string;
  draftId?: string;
  entryId?: string;
  lineId?: string;
  taxCaseKey: string;
  evidenceType?: string;
  evidenceReference?: string;
  countryCode?: string;
  counterpartyVatId?: string;
  capturedAt: string;
}

export interface ServerJournalPostingPairRecord {
  id: string;
  tenantId: string;
  entryId: string;
  debitLineId: string;
  creditLineId: string;
  amount: number;
  taxCaseKey?: string;
  datevBuKey?: string;
  createdAt: string;
}

export interface ServerImportedTransactionRecord {
  id: string;
  tenantId: string;
  accountId: string;
  date: string;
  amount: number;
  type: string;
  counterparty: string;
  purpose: string;
  linkedInvoiceId?: string;
  status: string;
  dedupHash?: string;
  importBatchId?: string;
  deletedAt?: string;
}

export interface ServerImportBatchRecord {
  id: string;
  tenantId: string;
  accountId: string;
  profile: string;
  fileName: string;
  fileSha256: string;
  mappingJson: string;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  createdAt: string;
  rolledBackAt?: string;
  rollbackReason?: string;
}

export interface ServerEurLineRecord {
  id: string;
  taxYear: number;
  kennziffer?: string;
  label: string;
  kind: string;
  exportable: boolean;
  sortOrder: number;
  computedFromJson?: string;
  sourceVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerEurClassificationRecord {
  id: string;
  tenantId: string;
  sourceType: string;
  sourceId: string;
  taxYear: number;
  eurLineId?: string;
  excluded: boolean;
  vatMode: string;
  note?: string;
  updatedAt: string;
}

export interface ServerEurRuleRecord {
  id: string;
  tenantId: string;
  taxYear: number;
  priority: number;
  field: string;
  operator: string;
  value: string;
  targetEurLineId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServerAccountKeywordRecord {
  id: string;
  tenantId: string;
  chart: string;
  accountNumber: string;
  keyword: string;
  source: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServerTaxCaseRecord extends TaxCaseDefinition {
  updatedAt: string;
}

export const listServerArticles = async (
  db: PostgresQueryable,
  tenantId: string,
): Promise<ServerArticleRecord[]> => {
  const result = await db.query<{
    id: string;
    tenant_id: string;
    sku: string | null;
    title: string;
    description: string;
    price: string | number;
    unit: string;
    category: string;
    tax_rate: string | number;
  }>('SELECT * FROM articles WHERE tenant_id = $1 ORDER BY title ASC, id ASC', [tenantId]);
  return result.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    sku: row.sku ?? undefined,
    title: row.title,
    description: row.description,
    price: toNumber(row.price),
    unit: row.unit,
    category: row.category,
    taxRate: toNumber(row.tax_rate),
  }));
};

export const saveServerArticle = async (
  db: PostgresQueryable,
  record: ServerArticleRecord,
): Promise<ServerArticleRecord> => {
  await db.query(
    `
      INSERT INTO articles (id, tenant_id, sku, title, description, price, unit, category, tax_rate)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        sku = EXCLUDED.sku,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        unit = EXCLUDED.unit,
        category = EXCLUDED.category,
        tax_rate = EXCLUDED.tax_rate
    `,
    [
      record.id,
      record.tenantId,
      record.sku ?? null,
      record.title,
      record.description,
      record.price,
      record.unit,
      record.category,
      record.taxRate,
    ],
  );
  return record;
};

export const listServerBankAccounts = async (
  db: PostgresQueryable,
  tenantId: string,
): Promise<ServerBankAccountRecord[]> => {
  const result = await db.query<{
    id: string;
    tenant_id: string;
    name: string;
    iban: string;
    balance: string | number;
    default_skr_account_number: string;
    type: string;
    color: string;
  }>('SELECT * FROM accounts WHERE tenant_id = $1 ORDER BY name ASC, id ASC', [tenantId]);
  return result.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    iban: row.iban,
    balance: toNumber(row.balance),
    defaultSkrAccountNumber: row.default_skr_account_number,
    type: row.type,
    color: row.color,
  }));
};

export const saveServerBankAccount = async (
  db: PostgresQueryable,
  record: ServerBankAccountRecord,
): Promise<ServerBankAccountRecord> => {
  await db.query(
    `
      INSERT INTO accounts (
        id, tenant_id, name, iban, balance, default_skr_account_number, type, color
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        name = EXCLUDED.name,
        iban = EXCLUDED.iban,
        balance = EXCLUDED.balance,
        default_skr_account_number = EXCLUDED.default_skr_account_number,
        type = EXCLUDED.type,
        color = EXCLUDED.color
    `,
    [
      record.id,
      record.tenantId,
      record.name,
      record.iban,
      record.balance,
      record.defaultSkrAccountNumber,
      record.type,
      record.color,
    ],
  );
  return record;
};

export const listServerTemplates = async (
  db: PostgresQueryable,
  tenantId: string,
): Promise<ServerTemplateRecord[]> => {
  const result = await db.query<{
    id: string;
    tenant_id: string;
    kind: string;
    name: string;
    elements_json: string;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM templates WHERE tenant_id = $1 ORDER BY kind ASC, name ASC, id ASC', [tenantId]);
  return result.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    kind: row.kind,
    name: row.name,
    elementsJson: row.elements_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const saveServerTemplate = async (
  db: PostgresQueryable,
  record: ServerTemplateRecord,
): Promise<ServerTemplateRecord> => {
  await db.query(
    `
      INSERT INTO templates (id, tenant_id, kind, name, elements_json, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        kind = EXCLUDED.kind,
        name = EXCLUDED.name,
        elements_json = EXCLUDED.elements_json,
        updated_at = EXCLUDED.updated_at
    `,
    [
      record.id,
      record.tenantId,
      record.kind,
      record.name,
      record.elementsJson,
      record.createdAt,
      record.updatedAt,
    ],
  );
  return record;
};

export const getServerActiveTemplates = async (
  db: PostgresQueryable,
  tenantId: string,
): Promise<ServerActiveTemplatesRecord | null> => {
  const result = await db.query<{
    tenant_id: string;
    id: number;
    invoice_template_id: string | null;
    offer_template_id: string | null;
  }>('SELECT * FROM active_templates WHERE tenant_id = $1 LIMIT 1', [tenantId]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    tenantId: row.tenant_id,
    id: row.id,
    invoiceTemplateId: row.invoice_template_id ?? undefined,
    offerTemplateId: row.offer_template_id ?? undefined,
  };
};

export const saveServerActiveTemplates = async (
  db: PostgresQueryable,
  record: ServerActiveTemplatesRecord,
): Promise<ServerActiveTemplatesRecord> => {
  await db.query(
    `
      INSERT INTO active_templates (tenant_id, id, invoice_template_id, offer_template_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tenant_id) DO UPDATE SET
        id = EXCLUDED.id,
        invoice_template_id = EXCLUDED.invoice_template_id,
        offer_template_id = EXCLUDED.offer_template_id
    `,
    [record.tenantId, record.id, record.invoiceTemplateId ?? null, record.offerTemplateId ?? null],
  );
  return record;
};

export const saveServerLedgerAccount = async (
  db: PostgresQueryable,
  account: LedgerAccount,
): Promise<LedgerAccount> => {
  await db.query(
    `
      INSERT INTO ledger_accounts (id, chart, account_number, name, source, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (chart, account_number) DO UPDATE SET
        name = EXCLUDED.name,
        source = EXCLUDED.source,
        updated_at = EXCLUDED.updated_at
    `,
    [
      account.id,
      account.chart,
      account.accountNumber,
      account.name,
      account.source,
      account.createdAt,
      account.updatedAt,
    ],
  );
  return account;
};

export const saveServerTaxCase = async (
  db: PostgresQueryable,
  record: ServerTaxCaseRecord,
): Promise<ServerTaxCaseRecord> => {
  await db.query(
    `
      INSERT INTO tax_cases (
        key, label, mechanism, default_rate, requires_counterparty_vat_id,
        requires_country, requires_evidence, active, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9
      )
      ON CONFLICT (key) DO UPDATE SET
        label = EXCLUDED.label,
        mechanism = EXCLUDED.mechanism,
        default_rate = EXCLUDED.default_rate,
        requires_counterparty_vat_id = EXCLUDED.requires_counterparty_vat_id,
        requires_country = EXCLUDED.requires_country,
        requires_evidence = EXCLUDED.requires_evidence,
        active = EXCLUDED.active,
        updated_at = EXCLUDED.updated_at
    `,
    [
      record.key,
      record.label,
      record.mechanism,
      record.defaultRate,
      record.requiresCounterpartyVatId,
      record.requiresCountry,
      record.requiresEvidence,
      record.active,
      record.updatedAt,
    ],
  );
  return record;
};

export const saveServerTaxCaseAccountMapping = async (
  db: PostgresQueryable,
  mapping: TaxCaseAccountMapping,
): Promise<TaxCaseAccountMapping> => {
  await db.query(
    `
      INSERT INTO tax_case_account_mappings (
        id, chart, tax_case_key, role, account_number, datev_bu_key, valid_from, valid_to, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
      ON CONFLICT (chart, tax_case_key, role) DO UPDATE SET
        account_number = EXCLUDED.account_number,
        datev_bu_key = EXCLUDED.datev_bu_key,
        valid_from = EXCLUDED.valid_from,
        valid_to = EXCLUDED.valid_to,
        updated_at = EXCLUDED.updated_at
    `,
    [
      mapping.id,
      mapping.chart,
      mapping.taxCaseKey,
      mapping.role,
      mapping.accountNumber,
      mapping.datevBuKey ?? null,
      mapping.validFrom ?? null,
      mapping.validTo ?? null,
      mapping.updatedAt,
    ],
  );
  return mapping;
};

export const saveServerAccountKeyword = async (
  db: PostgresQueryable,
  record: ServerAccountKeywordRecord,
): Promise<ServerAccountKeywordRecord> => {
  await db.query(
    `
      INSERT INTO account_keywords (
        id, tenant_id, chart, account_number, keyword, source, active, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
      ON CONFLICT (tenant_id, chart, account_number, keyword) DO UPDATE SET
        source = EXCLUDED.source,
        active = EXCLUDED.active,
        updated_at = EXCLUDED.updated_at
    `,
    [
      record.id,
      record.tenantId,
      record.chart,
      record.accountNumber,
      record.keyword,
      record.source,
      record.active,
      record.createdAt,
      record.updatedAt,
    ],
  );
  return record;
};

export const saveServerAccountSuggestionRule = async (
  db: PostgresQueryable,
  rule: AccountSuggestionRule,
): Promise<AccountSuggestionRule> => {
  await db.query(
    `
      INSERT INTO account_suggestion_rules (
        id, tenant_id, chart, priority, field, operator, value, target_account_number,
        flow_type, active, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        chart = EXCLUDED.chart,
        priority = EXCLUDED.priority,
        field = EXCLUDED.field,
        operator = EXCLUDED.operator,
        value = EXCLUDED.value,
        target_account_number = EXCLUDED.target_account_number,
        flow_type = EXCLUDED.flow_type,
        active = EXCLUDED.active,
        updated_at = EXCLUDED.updated_at
    `,
    [
      rule.id,
      rule.tenantId,
      rule.chart,
      rule.priority,
      rule.field,
      rule.operator,
      rule.value,
      rule.targetAccountNumber,
      rule.flowType,
      rule.active,
      rule.createdAt,
      rule.updatedAt,
    ],
  );
  return rule;
};

export const saveServerProWorkflowEntry = async (
  db: PostgresQueryable,
  record: ServerProWorkflowRecord,
): Promise<ServerProWorkflowRecord> => {
  await db.query(
    `
      INSERT INTO pro_workflow_entries (tenant_id, transaction_id, transaction_json, draft_json, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tenant_id, transaction_id) DO UPDATE SET
        transaction_json = EXCLUDED.transaction_json,
        draft_json = EXCLUDED.draft_json,
        updated_at = EXCLUDED.updated_at
    `,
    [record.tenantId, record.transactionId, record.transactionJson, record.draftJson, record.updatedAt],
  );
  return record;
};

export const saveServerBankTransaction = async (
  db: PostgresQueryable,
  record: ServerBankTransactionRecord,
): Promise<ServerBankTransactionRecord> => {
  await db.query(
    `
      INSERT INTO bank_transactions (
        id, tenant_id, account_id, date, amount, type, counterparty, purpose,
        linked_invoice_id, status, source_transaction_id, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        account_id = EXCLUDED.account_id,
        date = EXCLUDED.date,
        amount = EXCLUDED.amount,
        type = EXCLUDED.type,
        counterparty = EXCLUDED.counterparty,
        purpose = EXCLUDED.purpose,
        linked_invoice_id = EXCLUDED.linked_invoice_id,
        status = EXCLUDED.status,
        source_transaction_id = EXCLUDED.source_transaction_id,
        updated_at = EXCLUDED.updated_at
    `,
    [
      record.id,
      record.tenantId,
      record.accountId,
      record.date,
      record.amount,
      record.type,
      record.counterparty,
      record.purpose,
      record.linkedInvoiceId ?? null,
      record.status,
      record.sourceTransactionId ?? null,
      record.createdAt,
      record.updatedAt,
    ],
  );
  return record;
};

export const saveServerBookingDraft = async (
  db: PostgresQueryable,
  record: ServerBookingDraftRecord,
): Promise<ServerBookingDraftRecord> => {
  await db.query(
    `
      INSERT INTO booking_drafts (id, tenant_id, transaction_id, workflow_status, draft_json, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        transaction_id = EXCLUDED.transaction_id,
        workflow_status = EXCLUDED.workflow_status,
        draft_json = EXCLUDED.draft_json,
        updated_at = EXCLUDED.updated_at
    `,
    [record.id, record.tenantId, record.transactionId, record.workflowStatus, record.draftJson, record.updatedAt],
  );
  return record;
};

export const saveServerBookingDraftLine = async (
  db: PostgresQueryable,
  record: ServerBookingDraftLineRecord,
): Promise<ServerBookingDraftLineRecord> => {
  await db.query(
    `
      INSERT INTO booking_draft_lines (
        id, tenant_id, draft_id, line_no, account_number, debit_amount, credit_amount,
        tax_code, tax_case_key, tax_rate, net_amount, tax_amount, gross_amount,
        country_code, counterparty_vat_id, evidence_type, evidence_reference, cost_center, memo
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        draft_id = EXCLUDED.draft_id,
        line_no = EXCLUDED.line_no,
        account_number = EXCLUDED.account_number,
        debit_amount = EXCLUDED.debit_amount,
        credit_amount = EXCLUDED.credit_amount,
        tax_code = EXCLUDED.tax_code,
        tax_case_key = EXCLUDED.tax_case_key,
        tax_rate = EXCLUDED.tax_rate,
        net_amount = EXCLUDED.net_amount,
        tax_amount = EXCLUDED.tax_amount,
        gross_amount = EXCLUDED.gross_amount,
        country_code = EXCLUDED.country_code,
        counterparty_vat_id = EXCLUDED.counterparty_vat_id,
        evidence_type = EXCLUDED.evidence_type,
        evidence_reference = EXCLUDED.evidence_reference,
        cost_center = EXCLUDED.cost_center,
        memo = EXCLUDED.memo
    `,
    [
      record.id,
      record.tenantId,
      record.draftId,
      record.lineNo,
      record.accountNumber,
      record.debitAmount,
      record.creditAmount,
      record.taxCode ?? null,
      record.taxCaseKey ?? null,
      record.taxRate ?? null,
      record.netAmount ?? null,
      record.taxAmount ?? null,
      record.grossAmount ?? null,
      record.countryCode ?? null,
      record.counterpartyVatId ?? null,
      record.evidenceType ?? null,
      record.evidenceReference ?? null,
      record.costCenter ?? null,
      record.memo ?? null,
    ],
  );
  return record;
};

export const saveServerDraftValidationIssue = async (
  db: PostgresQueryable,
  record: ServerDraftValidationIssueRecord,
): Promise<ServerDraftValidationIssueRecord> => {
  await db.query(
    `
      INSERT INTO draft_validation_issues (
        id, tenant_id, draft_id, code, severity, message, field_path, blocking, source, issue_json, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        draft_id = EXCLUDED.draft_id,
        code = EXCLUDED.code,
        severity = EXCLUDED.severity,
        message = EXCLUDED.message,
        field_path = EXCLUDED.field_path,
        blocking = EXCLUDED.blocking,
        source = EXCLUDED.source,
        issue_json = EXCLUDED.issue_json,
        created_at = EXCLUDED.created_at
    `,
    [
      record.id,
      record.tenantId,
      record.draftId,
      record.code,
      record.severity,
      record.message,
      record.fieldPath ?? null,
      record.blocking,
      record.source,
      record.issueJson,
      record.createdAt,
    ],
  );
  return record;
};

export const saveServerAccountingPeriod = async (
  db: PostgresQueryable,
  record: ServerAccountingPeriodRecord,
): Promise<ServerAccountingPeriodRecord> => {
  await db.query(
    `
      INSERT INTO accounting_periods (
        id, tenant_id, period, fiscal_year, status, starts_at, ends_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        period = EXCLUDED.period,
        fiscal_year = EXCLUDED.fiscal_year,
        status = EXCLUDED.status,
        starts_at = EXCLUDED.starts_at,
        ends_at = EXCLUDED.ends_at,
        updated_at = EXCLUDED.updated_at
    `,
    [
      record.id,
      record.tenantId,
      record.period,
      record.fiscalYear,
      record.status,
      record.startsAt,
      record.endsAt,
      record.createdAt,
      record.updatedAt,
    ],
  );
  return record;
};

export const saveServerJournalEntry = async (
  db: PostgresQueryable,
  record: ServerJournalEntryRecord,
): Promise<ServerJournalEntryRecord> => {
  await db.query(
    `
      INSERT INTO journal_entries (
        id, tenant_id, entry_number, posting_date, document_date, booking_text, reference,
        period, fiscal_year, status, source_draft_id, reversed_entry_id, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        entry_number = EXCLUDED.entry_number,
        posting_date = EXCLUDED.posting_date,
        document_date = EXCLUDED.document_date,
        booking_text = EXCLUDED.booking_text,
        reference = EXCLUDED.reference,
        period = EXCLUDED.period,
        fiscal_year = EXCLUDED.fiscal_year,
        status = EXCLUDED.status,
        source_draft_id = EXCLUDED.source_draft_id,
        reversed_entry_id = EXCLUDED.reversed_entry_id,
        created_at = EXCLUDED.created_at
    `,
    [
      record.id,
      record.tenantId,
      record.entryNumber,
      record.postingDate,
      record.documentDate ?? null,
      record.bookingText,
      record.reference ?? null,
      record.period,
      record.fiscalYear,
      record.status,
      record.sourceDraftId ?? null,
      record.reversedEntryId ?? null,
      record.createdAt,
    ],
  );
  return record;
};

export const saveServerJournalLine = async (
  db: PostgresQueryable,
  record: ServerJournalLineRecord,
): Promise<ServerJournalLineRecord> => {
  await db.query(
    `
      INSERT INTO journal_lines (
        id, tenant_id, entry_id, line_no, account_number, debit_amount, credit_amount,
        tax_code, tax_case_key, tax_rate, net_amount, tax_amount, gross_amount,
        country_code, counterparty_vat_id, evidence_type, evidence_reference, cost_center, memo
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        entry_id = EXCLUDED.entry_id,
        line_no = EXCLUDED.line_no,
        account_number = EXCLUDED.account_number,
        debit_amount = EXCLUDED.debit_amount,
        credit_amount = EXCLUDED.credit_amount,
        tax_code = EXCLUDED.tax_code,
        tax_case_key = EXCLUDED.tax_case_key,
        tax_rate = EXCLUDED.tax_rate,
        net_amount = EXCLUDED.net_amount,
        tax_amount = EXCLUDED.tax_amount,
        gross_amount = EXCLUDED.gross_amount,
        country_code = EXCLUDED.country_code,
        counterparty_vat_id = EXCLUDED.counterparty_vat_id,
        evidence_type = EXCLUDED.evidence_type,
        evidence_reference = EXCLUDED.evidence_reference,
        cost_center = EXCLUDED.cost_center,
        memo = EXCLUDED.memo
    `,
    [
      record.id,
      record.tenantId,
      record.entryId,
      record.lineNo,
      record.accountNumber,
      record.debitAmount,
      record.creditAmount,
      record.taxCode ?? null,
      record.taxCaseKey ?? null,
      record.taxRate ?? null,
      record.netAmount ?? null,
      record.taxAmount ?? null,
      record.grossAmount ?? null,
      record.countryCode ?? null,
      record.counterpartyVatId ?? null,
      record.evidenceType ?? null,
      record.evidenceReference ?? null,
      record.costCenter ?? null,
      record.memo ?? null,
    ],
  );
  return record;
};

export const saveServerAccountMappingHgb = async (
  db: PostgresQueryable,
  record: ServerAccountMappingHgbRecord,
): Promise<ServerAccountMappingHgbRecord> => {
  await db.query(
    `
      INSERT INTO account_mappings_hgb (
        id, tenant_id, chart, account_number, statement_type, position_key, position_label, balance_side, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        chart = EXCLUDED.chart,
        account_number = EXCLUDED.account_number,
        statement_type = EXCLUDED.statement_type,
        position_key = EXCLUDED.position_key,
        position_label = EXCLUDED.position_label,
        balance_side = EXCLUDED.balance_side,
        updated_at = EXCLUDED.updated_at
    `,
    [
      record.id,
      record.tenantId,
      record.chart,
      record.accountNumber,
      record.statementType,
      record.positionKey,
      record.positionLabel,
      record.balanceSide ?? null,
      record.updatedAt,
    ],
  );
  return record;
};

export const saveServerReportSnapshot = async (
  db: PostgresQueryable,
  record: ServerReportSnapshotRecord,
): Promise<ServerReportSnapshotRecord> => {
  await db.query(
    `
      INSERT INTO report_snapshots (id, tenant_id, report_type, args_json, payload_json, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        report_type = EXCLUDED.report_type,
        args_json = EXCLUDED.args_json,
        payload_json = EXCLUDED.payload_json,
        created_at = EXCLUDED.created_at
    `,
    [record.id, record.tenantId, record.reportType, record.argsJson, record.payloadJson, record.createdAt],
  );
  return record;
};

export const saveServerDatevExport = async (
  db: PostgresQueryable,
  record: ServerDatevExportRecord,
): Promise<ServerDatevExportRecord> => {
  await db.query(
    `
      INSERT INTO datev_exports (
        id, tenant_id, file_path, record_count, from_date, to_date, created_at, meta_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        file_path = EXCLUDED.file_path,
        record_count = EXCLUDED.record_count,
        from_date = EXCLUDED.from_date,
        to_date = EXCLUDED.to_date,
        created_at = EXCLUDED.created_at,
        meta_json = EXCLUDED.meta_json
    `,
    [
      record.id,
      record.tenantId,
      record.filePath,
      record.recordCount,
      record.fromDate ?? null,
      record.toDate ?? null,
      record.createdAt,
      record.metaJson,
    ],
  );
  return record;
};

export const saveServerVatEvidence = async (
  db: PostgresQueryable,
  record: ServerVatEvidenceRecord,
): Promise<ServerVatEvidenceRecord> => {
  await db.query(
    `
      INSERT INTO vat_evidence (
        id, tenant_id, draft_id, entry_id, line_id, tax_case_key, evidence_type,
        evidence_reference, country_code, counterparty_vat_id, captured_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        draft_id = EXCLUDED.draft_id,
        entry_id = EXCLUDED.entry_id,
        line_id = EXCLUDED.line_id,
        tax_case_key = EXCLUDED.tax_case_key,
        evidence_type = EXCLUDED.evidence_type,
        evidence_reference = EXCLUDED.evidence_reference,
        country_code = EXCLUDED.country_code,
        counterparty_vat_id = EXCLUDED.counterparty_vat_id,
        captured_at = EXCLUDED.captured_at
    `,
    [
      record.id,
      record.tenantId,
      record.draftId ?? null,
      record.entryId ?? null,
      record.lineId ?? null,
      record.taxCaseKey,
      record.evidenceType ?? null,
      record.evidenceReference ?? null,
      record.countryCode ?? null,
      record.counterpartyVatId ?? null,
      record.capturedAt,
    ],
  );
  return record;
};

export const saveServerJournalPostingPair = async (
  db: PostgresQueryable,
  record: ServerJournalPostingPairRecord,
): Promise<ServerJournalPostingPairRecord> => {
  await db.query(
    `
      INSERT INTO journal_posting_pairs (
        id, tenant_id, entry_id, debit_line_id, credit_line_id, amount, tax_case_key, datev_bu_key, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        entry_id = EXCLUDED.entry_id,
        debit_line_id = EXCLUDED.debit_line_id,
        credit_line_id = EXCLUDED.credit_line_id,
        amount = EXCLUDED.amount,
        tax_case_key = EXCLUDED.tax_case_key,
        datev_bu_key = EXCLUDED.datev_bu_key,
        created_at = EXCLUDED.created_at
    `,
    [
      record.id,
      record.tenantId,
      record.entryId,
      record.debitLineId,
      record.creditLineId,
      record.amount,
      record.taxCaseKey ?? null,
      record.datevBuKey ?? null,
      record.createdAt,
    ],
  );
  return record;
};

export const saveServerImportedTransaction = async (
  db: PostgresQueryable,
  record: ServerImportedTransactionRecord,
): Promise<ServerImportedTransactionRecord> => {
  await db.query(
    `
      INSERT INTO transactions (
        id, tenant_id, account_id, date, amount, type, counterparty, purpose,
        linked_invoice_id, status, dedup_hash, import_batch_id, deleted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        account_id = EXCLUDED.account_id,
        date = EXCLUDED.date,
        amount = EXCLUDED.amount,
        type = EXCLUDED.type,
        counterparty = EXCLUDED.counterparty,
        purpose = EXCLUDED.purpose,
        linked_invoice_id = EXCLUDED.linked_invoice_id,
        status = EXCLUDED.status,
        dedup_hash = EXCLUDED.dedup_hash,
        import_batch_id = EXCLUDED.import_batch_id,
        deleted_at = EXCLUDED.deleted_at
    `,
    [
      record.id,
      record.tenantId,
      record.accountId,
      record.date,
      record.amount,
      record.type,
      record.counterparty,
      record.purpose,
      record.linkedInvoiceId ?? null,
      record.status,
      record.dedupHash ?? null,
      record.importBatchId ?? null,
      record.deletedAt ?? null,
    ],
  );
  return record;
};

export const saveServerImportBatch = async (
  db: PostgresQueryable,
  record: ServerImportBatchRecord,
): Promise<ServerImportBatchRecord> => {
  await db.query(
    `
      INSERT INTO import_batches (
        id, tenant_id, account_id, profile, file_name, file_sha256, mapping_json,
        imported_count, skipped_count, error_count, created_at, rolled_back_at, rollback_reason
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        account_id = EXCLUDED.account_id,
        profile = EXCLUDED.profile,
        file_name = EXCLUDED.file_name,
        file_sha256 = EXCLUDED.file_sha256,
        mapping_json = EXCLUDED.mapping_json,
        imported_count = EXCLUDED.imported_count,
        skipped_count = EXCLUDED.skipped_count,
        error_count = EXCLUDED.error_count,
        created_at = EXCLUDED.created_at,
        rolled_back_at = EXCLUDED.rolled_back_at,
        rollback_reason = EXCLUDED.rollback_reason
    `,
    [
      record.id,
      record.tenantId,
      record.accountId,
      record.profile,
      record.fileName,
      record.fileSha256,
      record.mappingJson,
      record.importedCount,
      record.skippedCount,
      record.errorCount,
      record.createdAt,
      record.rolledBackAt ?? null,
      record.rollbackReason ?? null,
    ],
  );
  return record;
};

export const saveServerEurLine = async (
  db: PostgresQueryable,
  record: ServerEurLineRecord,
): Promise<ServerEurLineRecord> => {
  await db.query(
    `
      INSERT INTO eur_lines (
        id, tax_year, kennziffer, label, kind, exportable, sort_order,
        computed_from_json, source_version, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11
      )
      ON CONFLICT (id) DO UPDATE SET
        tax_year = EXCLUDED.tax_year,
        kennziffer = EXCLUDED.kennziffer,
        label = EXCLUDED.label,
        kind = EXCLUDED.kind,
        exportable = EXCLUDED.exportable,
        sort_order = EXCLUDED.sort_order,
        computed_from_json = EXCLUDED.computed_from_json,
        source_version = EXCLUDED.source_version,
        updated_at = EXCLUDED.updated_at
    `,
    [
      record.id,
      record.taxYear,
      record.kennziffer ?? null,
      record.label,
      record.kind,
      record.exportable,
      record.sortOrder,
      record.computedFromJson ?? null,
      record.sourceVersion,
      record.createdAt,
      record.updatedAt,
    ],
  );
  return record;
};

export const saveServerEurClassification = async (
  db: PostgresQueryable,
  record: ServerEurClassificationRecord,
): Promise<ServerEurClassificationRecord> => {
  await db.query(
    `
      INSERT INTO eur_classifications (
        id, tenant_id, source_type, source_id, tax_year, eur_line_id,
        excluded, vat_mode, note, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10
      )
      ON CONFLICT (tenant_id, source_type, source_id, tax_year) DO UPDATE SET
        eur_line_id = EXCLUDED.eur_line_id,
        excluded = EXCLUDED.excluded,
        vat_mode = EXCLUDED.vat_mode,
        note = EXCLUDED.note,
        updated_at = EXCLUDED.updated_at
    `,
    [
      record.id,
      record.tenantId,
      record.sourceType,
      record.sourceId,
      record.taxYear,
      record.eurLineId ?? null,
      record.excluded,
      record.vatMode,
      record.note ?? null,
      record.updatedAt,
    ],
  );
  return record;
};

export const saveServerEurRule = async (
  db: PostgresQueryable,
  record: ServerEurRuleRecord,
): Promise<ServerEurRuleRecord> => {
  await db.query(
    `
      INSERT INTO eur_rules (
        id, tenant_id, tax_year, priority, field, operator, value,
        target_eur_line_id, active, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        tax_year = EXCLUDED.tax_year,
        priority = EXCLUDED.priority,
        field = EXCLUDED.field,
        operator = EXCLUDED.operator,
        value = EXCLUDED.value,
        target_eur_line_id = EXCLUDED.target_eur_line_id,
        active = EXCLUDED.active,
        updated_at = EXCLUDED.updated_at
    `,
    [
      record.id,
      record.tenantId,
      record.taxYear,
      record.priority,
      record.field,
      record.operator,
      record.value,
      record.targetEurLineId,
      record.active,
      record.createdAt,
      record.updatedAt,
    ],
  );
  return record;
};

export const createPostgresProWorkflowRepository = (
  db: PostgresQueryable,
): ProWorkflowRepository => ({
  async list(scope) {
    const tenantId = getTenantId(scope);
    const result = await db.query<{
      transaction_id: string;
      transaction_json: string;
      draft_json: string;
      updated_at: string;
    }>(
      `
        SELECT transaction_id, transaction_json, draft_json, updated_at
        FROM pro_workflow_entries
        WHERE tenant_id = $1
        ORDER BY updated_at DESC, transaction_id ASC
      `,
      [tenantId],
    );
    return result.rows.map((row) => ({
      transactionId: row.transaction_id,
      transactionJson: row.transaction_json,
      draftJson: row.draft_json,
      updatedAt: row.updated_at,
    }));
  },

  async upsert(scope, args) {
    await saveServerProWorkflowEntry(db, {
      tenantId: getTenantId(scope),
      transactionId: args.transactionId,
      transactionJson: args.transactionJson,
      draftJson: args.draftJson,
      updatedAt: nowIso(),
    });
    return { ok: true };
  },
});

export const createPostgresProAccountingCatalogRepository = (
  db: PostgresQueryable,
): ProAccountingCatalogRepository => ({
  async listLedgerAccounts(scope, args = {}) {
    const tenantId = getTenantId(scope);
    const params: Array<string | number> = [tenantId];
    const filters: string[] = [];

    if (args.chart) {
      params.push(args.chart);
      filters.push(`la.chart = $${params.length}`);
    }

    if (args.search && args.search.trim().length > 0) {
      params.push(`%${args.search.trim()}%`);
      filters.push(`(la.account_number ILIKE $${params.length} OR la.name ILIKE $${params.length})`);
    }

    const limit = Math.max(1, Math.min(10_000, Math.floor(args.limit ?? 500)));
    const offset = Math.max(0, Math.floor(args.offset ?? 0));
    params.push(limit);
    const limitIndex = params.length;
    params.push(offset);
    const offsetIndex = params.length;

    const whereSql = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await db.query<{
      id: string;
      chart: LedgerAccount['chart'];
      account_number: string;
      name: string;
      source: string;
      created_at: string;
      updated_at: string;
      keywords: string[] | null;
    }>(
      `
        SELECT
          la.id,
          la.chart,
          la.account_number,
          la.name,
          la.source,
          la.created_at,
          la.updated_at,
          (
            SELECT array_agg(ak.keyword ORDER BY ak.keyword)
            FROM account_keywords ak
            WHERE ak.tenant_id = $1
              AND ak.chart = la.chart
              AND ak.account_number = la.account_number
              AND ak.active = TRUE
          ) AS keywords
        FROM ledger_accounts la
        ${whereSql}
        ORDER BY la.chart ASC, la.account_number ASC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
      `,
      params,
    );
    return result.rows.map((row) => ({
      id: row.id,
      chart: row.chart,
      accountNumber: row.account_number,
      name: row.name,
      keywords: row.keywords ?? undefined,
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  async getLedgerStats() {
    const result = await db.query<{ chart: LedgerAccount['chart']; count: string }>(
      `
        SELECT chart, COUNT(*)::text AS count
        FROM ledger_accounts
        GROUP BY chart
      `,
    );
    const byChart: LedgerAccountStats['byChart'] = { SKR03: 0, SKR04: 0 };
    for (const row of result.rows) {
      if (row.chart === 'SKR03' || row.chart === 'SKR04') {
        byChart[row.chart] = Number(row.count);
      }
    }
    return {
      total: byChart.SKR03 + byChart.SKR04,
      byChart,
    };
  },

  async listTaxCases(_scope, args = {}) {
    const result = await db.query<{
      key: TaxCaseDefinition['key'];
      label: string;
      mechanism: TaxCaseDefinition['mechanism'];
      default_rate: string | number;
      requires_counterparty_vat_id: boolean;
      requires_country: boolean;
      requires_evidence: boolean;
      active: boolean;
    }>(
      `
        SELECT key, label, mechanism, default_rate, requires_counterparty_vat_id, requires_country, requires_evidence, active
        FROM tax_cases
        ${args.activeOnly ? 'WHERE active = TRUE' : ''}
        ORDER BY key ASC
      `,
    );
    return result.rows.map((row) => ({
      key: row.key,
      label: row.label,
      mechanism: row.mechanism,
      defaultRate: toNumber(row.default_rate),
      requiresCounterpartyVatId: row.requires_counterparty_vat_id,
      requiresCountry: row.requires_country,
      requiresEvidence: row.requires_evidence,
      active: row.active,
    }));
  },

  async listTaxCaseAccountMappings(_scope, args = {}) {
    const params: string[] = [];
    const filters: string[] = [];
    if (args.chart) {
      params.push(args.chart);
      filters.push(`chart = $${params.length}`);
    }
    if (args.taxCaseKey) {
      params.push(args.taxCaseKey);
      filters.push(`tax_case_key = $${params.length}`);
    }
    const whereSql = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await db.query<{
      id: string;
      chart: TaxCaseAccountMapping['chart'];
      tax_case_key: TaxCaseAccountMapping['taxCaseKey'];
      role: TaxCaseAccountMapping['role'];
      account_number: string;
      datev_bu_key: string | null;
      valid_from: string | null;
      valid_to: string | null;
      updated_at: string;
    }>(
      `
        SELECT id, chart, tax_case_key, role, account_number, datev_bu_key, valid_from, valid_to, updated_at
        FROM tax_case_account_mappings
        ${whereSql}
        ORDER BY chart ASC, tax_case_key ASC, role ASC
      `,
      params,
    );
    return result.rows.map((row) => ({
      id: row.id,
      chart: row.chart,
      taxCaseKey: row.tax_case_key,
      role: row.role,
      accountNumber: row.account_number,
      datevBuKey: row.datev_bu_key ?? undefined,
      validFrom: row.valid_from ?? undefined,
      validTo: row.valid_to ?? undefined,
      updatedAt: row.updated_at,
    }));
  },

  async upsertTaxCaseAccountMapping(_scope, args) {
    const existing = await db.query<{ id: string }>(
      `
        SELECT id
        FROM tax_case_account_mappings
        WHERE chart = $1 AND tax_case_key = $2 AND role = $3
        LIMIT 1
      `,
      [args.chart, args.taxCaseKey, args.role],
    );
    const mapping: TaxCaseAccountMapping = {
      id: args.id ?? existing.rows[0]?.id ?? randomUUID(),
      chart: args.chart,
      taxCaseKey: args.taxCaseKey,
      role: args.role,
      accountNumber: args.accountNumber,
      datevBuKey: args.datevBuKey,
      validFrom: args.validFrom,
      validTo: args.validTo,
      updatedAt: nowIso(),
    };
    return saveServerTaxCaseAccountMapping(db, mapping);
  },

  async listAccountSuggestionRules(scope, args = {}) {
    const tenantId = getTenantId(scope);
    const params: Array<string | boolean> = [tenantId];
    const filters = ['tenant_id = $1'];
    if (args.chart) {
      params.push(args.chart);
      filters.push(`chart = $${params.length}`);
    }
    if (args.activeOnly) {
      params.push(true);
      filters.push(`active = $${params.length}`);
    }
    const result = await db.query<{
      id: string;
      tenant_id: string;
      chart: TaxCaseAccountMapping['chart'];
      priority: number;
      field: AccountSuggestionRuleField;
      operator: AccountSuggestionRuleOperator;
      value: string;
      target_account_number: string;
      flow_type: AccountSuggestionRuleFlowType;
      active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
        SELECT id, tenant_id, chart, priority, field, operator, value, target_account_number, flow_type, active, created_at, updated_at
        FROM account_suggestion_rules
        WHERE ${filters.join(' AND ')}
        ORDER BY chart ASC, priority ASC, created_at ASC
      `,
      params,
    );
    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      chart: row.chart,
      priority: row.priority,
      field: row.field,
      operator: row.operator,
      value: row.value,
      targetAccountNumber: row.target_account_number,
      flowType: row.flow_type,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  async upsertAccountSuggestionRule(scope, input) {
    const tenantId = input.tenantId ?? getTenantId(scope);
    const now = nowIso();
    const existing = input.id
      ? await db.query<{ created_at: string }>('SELECT created_at FROM account_suggestion_rules WHERE id = $1 LIMIT 1', [input.id])
      : { rows: [] as Array<{ created_at: string }> };
    const rule: AccountSuggestionRule = {
      id: input.id ?? randomUUID(),
      tenantId,
      chart: input.chart,
      priority: input.priority,
      field: input.field,
      operator: input.operator,
      value: input.value.trim(),
      targetAccountNumber: input.targetAccountNumber.trim(),
      flowType: input.flowType ?? 'any',
      active: input.active !== false,
      createdAt: existing.rows[0]?.created_at ?? now,
      updatedAt: now,
    };
    return saveServerAccountSuggestionRule(db, rule);
  },

  async deleteAccountSuggestionRule(scope, id) {
    await db.query('DELETE FROM account_suggestion_rules WHERE tenant_id = $1 AND id = $2', [getTenantId(scope), id]);
  },
});
