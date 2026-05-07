import assert from 'node:assert/strict';
import test from 'node:test';
import type { PostgresQueryable } from './connection.js';
import {
  applyServerModeLiteTenantSeed,
  applyServerModeProTenantSeed,
  buildServerModeLiteTenantSeed,
  buildServerModeProTenantSeed,
} from './e2eSeeding.js';

test('buildServerModeLiteTenantSeed is deterministic for a namespace', () => {
  const first = buildServerModeLiteTenantSeed({
    tenantId: 'tenant-lite',
    namespace: 'smoke-lite',
    now: '2026-03-20T09:00:00.000Z',
  });
  const second = buildServerModeLiteTenantSeed({
    tenantId: 'tenant-lite',
    namespace: 'smoke-lite',
    now: '2026-03-20T09:00:00.000Z',
  });

  assert.deepEqual(first, second);
  assert.equal(first.clients.length, 2);
  assert.equal(first.invoices.length, 2);
  assert.equal(first.offers.length, 1);
  assert.equal(first.recurringProfiles.length, 1);
  assert.match(first.invoices[0]?.number ?? '', /^RE-SMOKLITE-101$/);
});

test('buildServerModeProTenantSeed adds accounting fixtures', () => {
  const seed = buildServerModeProTenantSeed({
    tenantId: 'tenant-pro',
    namespace: 'pro-smoke',
    now: '2026-03-20T09:00:00.000Z',
  });

  assert.equal(seed.ledgerAccounts.length, 3);
  assert.equal(seed.taxCases.length, 2);
  assert.equal(seed.accountKeywords.length, 1);
  assert.equal(seed.articles.length, 2);
  assert.equal(seed.bankAccounts.length, 1);
  assert.equal(seed.bankTransactions.length, 2);
  assert.equal(seed.templates.length, 2);
  assert.equal(seed.workflowEntries.length, 1);
  assert.equal(seed.taxCaseAccountMappings.length, 2);
  assert.equal(seed.accountSuggestionRules.length, 1);
  assert.equal(seed.activeTemplates.invoiceTemplateId, 'pro-smoke-template-invoice');
});

test('applyServerModeLiteTenantSeed persists settings and billing fixtures', async () => {
  const queries: string[] = [];
  const db = {
    async query(sql: string) {
      queries.push(sql);
      return {
        rowCount: 1,
        rows: [],
      };
    },
  } as PostgresQueryable;

  await applyServerModeLiteTenantSeed(
    db,
    buildServerModeLiteTenantSeed({
      tenantId: 'tenant-lite',
      namespace: 'lite-seed',
      now: '2026-03-20T09:00:00.000Z',
    }),
  );

  assert.equal(queries.length, 7);
  assert.match(queries[0] ?? '', /INSERT INTO server_settings/);
  assert.match(queries[1] ?? '', /INSERT INTO clients/);
  assert.match(queries[3] ?? '', /INSERT INTO invoices/);
  assert.match(queries[5] ?? '', /INSERT INTO offers/);
  assert.match(queries[6] ?? '', /INSERT INTO recurring_profiles/);
});

test('applyServerModeProTenantSeed persists accounting fixtures after billing data', async () => {
  const queries: string[] = [];
  const db = {
    async query(sql: string) {
      queries.push(sql);
      return {
        rowCount: 1,
        rows: [],
      };
    },
  } as PostgresQueryable;

  await applyServerModeProTenantSeed(
    db,
    buildServerModeProTenantSeed({
      tenantId: 'tenant-pro',
      namespace: 'pro-seed',
      now: '2026-03-20T09:00:00.000Z',
    }),
  );

  assert.equal(queries.length, 25);
  assert.match(queries[0] ?? '', /INSERT INTO server_settings/);
  assert.match(queries[7] ?? '', /INSERT INTO ledger_accounts/);
  assert.match(queries[10] ?? '', /INSERT INTO tax_cases/);
  assert.match(queries[15] ?? '', /INSERT INTO accounts/);
  assert.match(queries[18] ?? '', /INSERT INTO templates/);
  assert.match(queries[20] ?? '', /INSERT INTO active_templates/);
  assert.match(queries[21] ?? '', /INSERT INTO pro_workflow_entries/);
  assert.match(queries[22] ?? '', /INSERT INTO tax_case_account_mappings/);
  assert.match(queries[24] ?? '', /INSERT INTO account_suggestion_rules/);
});
