import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export type AccountSuggestionRuleField = 'counterparty' | 'purpose' | 'any';
export type AccountSuggestionRuleOperator = 'contains' | 'equals' | 'startsWith';
export type AccountSuggestionRuleFlowType = 'income' | 'expense' | 'any';

export interface AccountSuggestionRule {
  id: string;
  tenantId: string;
  chart: 'SKR03' | 'SKR04';
  priority: number;
  field: AccountSuggestionRuleField;
  operator: AccountSuggestionRuleOperator;
  value: string;
  targetAccountNumber: string;
  flowType: AccountSuggestionRuleFlowType;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertAccountSuggestionRuleInput {
  id?: string;
  tenantId?: string;
  chart: 'SKR03' | 'SKR04';
  priority: number;
  field: AccountSuggestionRuleField;
  operator: AccountSuggestionRuleOperator;
  value: string;
  targetAccountNumber: string;
  flowType?: AccountSuggestionRuleFlowType;
  active?: boolean;
}

interface RuleRow {
  id: string;
  tenant_id: string;
  chart: 'SKR03' | 'SKR04';
  priority: number;
  field: AccountSuggestionRuleField;
  operator: AccountSuggestionRuleOperator;
  value: string;
  target_account_number: string;
  flow_type: AccountSuggestionRuleFlowType;
  active: number;
  created_at: string;
  updated_at: string;
}

const mapRow = (row: RuleRow): AccountSuggestionRule => ({
  id: row.id,
  tenantId: row.tenant_id,
  chart: row.chart,
  priority: row.priority,
  field: row.field,
  operator: row.operator,
  value: row.value,
  targetAccountNumber: row.target_account_number,
  flowType: row.flow_type,
  active: row.active === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listAccountSuggestionRules = (
  db: Database.Database,
  args: { chart?: 'SKR03' | 'SKR04'; activeOnly?: boolean } = {},
  tenantId = 'default',
): AccountSuggestionRule[] => {
  const where = ['tenant_id = @tenantId'];
  const params: Record<string, unknown> = { tenantId };

  if (args.chart) {
    where.push('chart = @chart');
    params.chart = args.chart;
  }
  if (args.activeOnly) {
    where.push('active = 1');
  }

  const rows = db.prepare(
    `
      SELECT id, tenant_id, chart, priority, field, operator, value, target_account_number, flow_type, active, created_at, updated_at
      FROM account_suggestion_rules
      WHERE ${where.join(' AND ')}
      ORDER BY chart ASC, priority ASC, created_at ASC
    `,
  ).all(params) as RuleRow[];

  return rows.map(mapRow);
};

export const upsertAccountSuggestionRule = (
  db: Database.Database,
  input: UpsertAccountSuggestionRuleInput,
): AccountSuggestionRule => {
  const now = new Date().toISOString();
  const id = input.id ?? randomUUID();
  const tenantId = input.tenantId ?? 'default';
  const active = input.active !== false;
  const flowType = input.flowType ?? 'any';

  db.prepare(
    `
      INSERT INTO account_suggestion_rules
        (id, tenant_id, chart, priority, field, operator, value, target_account_number, flow_type, active, created_at, updated_at)
      VALUES
        (@id, @tenantId, @chart, @priority, @field, @operator, @value, @targetAccountNumber, @flowType, @active, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        chart = excluded.chart,
        priority = excluded.priority,
        field = excluded.field,
        operator = excluded.operator,
        value = excluded.value,
        target_account_number = excluded.target_account_number,
        flow_type = excluded.flow_type,
        active = excluded.active,
        updated_at = excluded.updated_at
    `,
  ).run({
    id,
    tenantId,
    chart: input.chart,
    priority: input.priority,
    field: input.field,
    operator: input.operator,
    value: input.value.trim(),
    targetAccountNumber: input.targetAccountNumber.trim(),
    flowType,
    active: active ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });

  const row = db.prepare(
    `
      SELECT id, tenant_id, chart, priority, field, operator, value, target_account_number, flow_type, active, created_at, updated_at
      FROM account_suggestion_rules
      WHERE id = ?
    `,
  ).get(id) as RuleRow | undefined;

  if (!row) {
    throw new Error('Failed to upsert account suggestion rule');
  }
  return mapRow(row);
};

export const deleteAccountSuggestionRule = (db: Database.Database, id: string): void => {
  db.prepare('DELETE FROM account_suggestion_rules WHERE id = ?').run(id);
};
