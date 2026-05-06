import type Database from 'better-sqlite3';
import {
  normalizeGermanText,
  normalizeLooseText,
  predictNaiveBayes as predictSharedNaiveBayes,
  trainNaiveBayes as trainSharedNaiveBayes,
  type NaiveBayesModel as SharedNaiveBayesModel,
} from '@billme/finance-intelligence';
import type { AccountSuggestionRule } from '@billme/accounting-shared';

type FlowType = 'income' | 'expense';

export type AccountSuggestionLayer = 'rule' | 'counterparty' | 'bayes' | 'keyword' | 'fallback';

export interface AccountSuggestion {
  accountNumber?: string;
  reason?: string;
  layer?: AccountSuggestionLayer;
  confidence?: number;
}

interface AccountKeywordRow {
  account_number: string;
  keyword: string;
}

type BayesModel = SharedNaiveBayesModel;

export interface AccountSuggestionContext {
  chart: 'SKR03' | 'SKR04';
  rules: AccountSuggestionRule[];
  keywordMap: Map<string, string[]>;
  counterpartyMemory: Map<string, string>;
  bayesModel: BayesModel | null;
  fallbackIncomeAccount?: string;
  fallbackExpenseAccount?: string;
}

const MIN_TRAINING_EXAMPLES = 20;
const MIN_CONFIDENCE = 0.6;

const normalize = (value: string): string => normalizeLooseText(normalizeGermanText(value));

const loadKeywords = (
  db: Database.Database,
  chart: 'SKR03' | 'SKR04',
  tenantId: string,
): Map<string, string[]> => {
  const rows = db.prepare(
    `
      SELECT account_number, keyword
      FROM account_keywords
      WHERE tenant_id = ? AND chart = ? AND active = 1
    `,
  ).all(tenantId, chart) as AccountKeywordRow[];

  const out = new Map<string, string[]>();
  for (const row of rows) {
    const key = normalize(row.keyword);
    if (!key) continue;
    const list = out.get(key) ?? [];
    if (!list.includes(row.account_number)) {
      list.push(row.account_number);
    }
    out.set(key, list);
  }
  return out;
};

const loadCounterpartyMemory = (
  db: Database.Database,
  chart: 'SKR03' | 'SKR04',
  tenantId: string,
): Map<string, string> => {
  const rows = db.prepare(
    `
      SELECT bt.counterparty AS counterparty, jl.account_number AS account_number, MAX(je.created_at) AS latest_at
      FROM journal_entries je
      INNER JOIN journal_lines jl ON jl.entry_id = je.id AND jl.tenant_id = je.tenant_id
      INNER JOIN booking_drafts bd ON bd.id = je.source_draft_id AND bd.tenant_id = je.tenant_id
      INNER JOIN bank_transactions bt ON bt.id = bd.transaction_id AND bt.tenant_id = bd.tenant_id
      INNER JOIN ledger_accounts la ON la.chart = ? AND la.account_number = jl.account_number
      WHERE je.tenant_id = ?
        AND je.status = 'posted'
        AND bt.counterparty IS NOT NULL
        AND TRIM(bt.counterparty) <> ''
        AND substr(jl.account_number, 1, 1) NOT IN ('0', '1')
      GROUP BY LOWER(TRIM(bt.counterparty))
      ORDER BY latest_at DESC
    `,
  ).all(chart, tenantId) as Array<{ counterparty: string; account_number: string }>;

  const out = new Map<string, string>();
  for (const row of rows) {
    const key = normalize(row.counterparty);
    if (!key || out.has(key)) continue;
    out.set(key, row.account_number);
  }
  return out;
};

const loadBayesTraining = (
  db: Database.Database,
  chart: 'SKR03' | 'SKR04',
  tenantId: string,
): Array<{ text: string; classId: string }> => {
  const rows = db.prepare(
    `
      SELECT bt.counterparty AS counterparty, bt.purpose AS purpose, jl.account_number AS account_number
      FROM journal_entries je
      INNER JOIN journal_lines jl ON jl.entry_id = je.id AND jl.tenant_id = je.tenant_id
      INNER JOIN booking_drafts bd ON bd.id = je.source_draft_id AND bd.tenant_id = je.tenant_id
      INNER JOIN bank_transactions bt ON bt.id = bd.transaction_id AND bt.tenant_id = bd.tenant_id
      INNER JOIN ledger_accounts la ON la.chart = ? AND la.account_number = jl.account_number
      WHERE je.tenant_id = ?
        AND je.status = 'posted'
        AND substr(jl.account_number, 1, 1) NOT IN ('0', '1')
    `,
  ).all(chart, tenantId) as Array<{ counterparty: string; purpose: string; account_number: string }>;

  return rows.map((row) => ({
    text: `${row.counterparty || ''} ${row.purpose || ''}`.trim(),
    classId: row.account_number,
  }));
};

const loadFallbackAccount = (
  db: Database.Database,
  chart: 'SKR03' | 'SKR04',
  startsWith: string[],
): string | undefined => {
  if (startsWith.length === 0) return undefined;
  const clause = startsWith.map(() => 'substr(account_number, 1, 1) = ?').join(' OR ');
  const row = db.prepare(
    `
      SELECT account_number
      FROM ledger_accounts
      WHERE chart = ? AND (${clause})
      ORDER BY account_number ASC
      LIMIT 1
    `,
  ).get(chart, ...startsWith) as { account_number: string } | undefined;
  return row?.account_number;
};

export const buildAccountSuggestionContext = (
  db: Database.Database,
  args: {
    chart: 'SKR03' | 'SKR04';
    rules: AccountSuggestionRule[];
    tenantId?: string;
  },
): AccountSuggestionContext => {
  const tenantId = args.tenantId ?? 'default';
  const training = loadBayesTraining(db, args.chart, tenantId);

  return {
    chart: args.chart,
    rules: args.rules
      .filter((rule) => rule.active && rule.chart === args.chart)
      .sort((a, b) => a.priority - b.priority),
    keywordMap: loadKeywords(db, args.chart, tenantId),
    counterpartyMemory: loadCounterpartyMemory(db, args.chart, tenantId),
    bayesModel: trainSharedNaiveBayes(training, MIN_TRAINING_EXAMPLES),
    fallbackIncomeAccount: loadFallbackAccount(db, args.chart, ['8', '9']),
    fallbackExpenseAccount: loadFallbackAccount(db, args.chart, ['4', '5', '6', '7']),
  };
};

const byRule = (
  ctx: AccountSuggestionContext,
  item: { flowType: FlowType; counterparty: string; purpose: string },
): AccountSuggestion => {
  for (const rule of ctx.rules) {
    if (rule.flowType !== 'any' && rule.flowType !== item.flowType) continue;
    const fields: string[] = [];
    if (rule.field === 'counterparty' || rule.field === 'any') fields.push(item.counterparty);
    if (rule.field === 'purpose' || rule.field === 'any') fields.push(item.purpose);
    const needle = normalize(rule.value);
    const matched = fields.some((fieldValue) => {
      const hay = normalize(fieldValue);
      if (rule.operator === 'contains') return hay.includes(needle);
      if (rule.operator === 'equals') return hay === needle;
      return hay.startsWith(needle);
    });
    if (matched) {
      return {
        accountNumber: rule.targetAccountNumber,
        reason: `Regel: "${rule.value}"`,
        layer: 'rule',
        confidence: 0.99,
      };
    }
  }
  return {};
};

const byCounterpartyMemory = (
  ctx: AccountSuggestionContext,
  counterparty: string,
): AccountSuggestion => {
  const key = normalize(counterparty);
  const accountNumber = ctx.counterpartyMemory.get(key);
  if (!accountNumber) return {};
  return {
    accountNumber,
    reason: `Gemerkte Gegenpartei: "${counterparty}"`,
    layer: 'counterparty',
    confidence: 0.9,
  };
};

const byBayes = (
  ctx: AccountSuggestionContext,
  item: { counterparty: string; purpose: string },
): AccountSuggestion => {
  if (!ctx.bayesModel) return {};
  const result = predictSharedNaiveBayes(
    ctx.bayesModel,
    `${item.counterparty || ''} ${item.purpose || ''}`.trim(),
    MIN_CONFIDENCE,
  );
  if (!result) return {};
  return {
    accountNumber: result.classId,
    reason: `KI-Vorschlag (${Math.round(result.confidence * 100)}%)`,
    layer: 'bayes',
    confidence: result.confidence,
  };
};

const byKeyword = (
  ctx: AccountSuggestionContext,
  item: { counterparty: string; purpose: string },
): AccountSuggestion => {
  const text = normalize(`${item.counterparty || ''} ${item.purpose || ''}`);
  if (!text) return {};
  const hits = new Map<string, number>();
  for (const [keyword, accounts] of ctx.keywordMap.entries()) {
    if (!text.includes(keyword)) continue;
    for (const acc of accounts) {
      hits.set(acc, (hits.get(acc) ?? 0) + 1);
    }
  }
  if (hits.size === 0) return {};
  const best = Array.from(hits.entries()).sort((a, b) => {
    if (a[1] !== b[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  })[0];
  if (!best) return {};
  return {
    accountNumber: best[0],
    reason: `Stichworttreffer (${best[1]})`,
    layer: 'keyword',
    confidence: Math.min(0.85, 0.45 + best[1] * 0.1),
  };
};

const byFallback = (
  ctx: AccountSuggestionContext,
  flowType: FlowType,
): AccountSuggestion => {
  const accountNumber = flowType === 'income' ? ctx.fallbackIncomeAccount : ctx.fallbackExpenseAccount;
  if (!accountNumber) return {};
  return {
    accountNumber,
    reason: 'Fallback nach Buchungstyp',
    layer: 'fallback',
    confidence: 0.3,
  };
};

export const suggestAccountForTransaction = (
  ctx: AccountSuggestionContext,
  item: { flowType: FlowType; counterparty: string; purpose: string },
): AccountSuggestion => {
  const fromRule = byRule(ctx, item);
  if (fromRule.accountNumber) return fromRule;
  const fromMemory = byCounterpartyMemory(ctx, item.counterparty);
  if (fromMemory.accountNumber) return fromMemory;
  const fromBayes = byBayes(ctx, item);
  if (fromBayes.accountNumber) return fromBayes;
  const fromKeyword = byKeyword(ctx, item);
  if (fromKeyword.accountNumber) return fromKeyword;
  return byFallback(ctx, item.flowType);
};
