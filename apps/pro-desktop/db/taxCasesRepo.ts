import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';

export type TaxMechanism = 'standard_vat' | 'reverse_charge' | 'zero_rate' | 'exempt';

export type TaxCaseKey =
  | 'DE_STD_19'
  | 'DE_STD_7'
  | 'DE_ZERO_EXEMPT'
  | 'DE_KU19'
  | 'DE_RC_13B_DOMESTIC'
  | 'EU_B2C_OSS'
  | 'DE_MARGIN_25A'
  | 'DE_BAUABZUG_48'
  | 'DE_TRIANGULAR_25B'
  | 'EU_B2B_SERVICE_RC'
  | 'EU_IGL_GOODS_0'
  | 'EU_IGE_GOODS_RC'
  | 'NON_EU_EXPORT_0'
  | 'NON_EU_SERVICE_RC';

export interface TaxCaseDefinition {
  key: TaxCaseKey;
  label: string;
  mechanism: TaxMechanism;
  defaultRate: number;
  requiresCounterpartyVatId: boolean;
  requiresCountry: boolean;
  requiresEvidence: boolean;
  active: boolean;
}

export type TaxMappingRole =
  | 'output_tax'
  | 'input_tax'
  | 'datev_bu';

export interface TaxCaseAccountMapping {
  id: string;
  chart: 'SKR03' | 'SKR04';
  taxCaseKey: TaxCaseKey;
  role: TaxMappingRole;
  accountNumber: string;
  datevBuKey?: string;
  validFrom?: string;
  validTo?: string;
  updatedAt: string;
}

const TAX_CASE_DEFINITIONS: TaxCaseDefinition[] = [
  {
    key: 'DE_STD_19',
    label: 'Inland steuerpflichtig 19%',
    mechanism: 'standard_vat',
    defaultRate: 19,
    requiresCounterpartyVatId: false,
    requiresCountry: false,
    requiresEvidence: false,
    active: true,
  },
  {
    key: 'DE_STD_7',
    label: 'Inland steuerpflichtig 7%',
    mechanism: 'standard_vat',
    defaultRate: 7,
    requiresCounterpartyVatId: false,
    requiresCountry: false,
    requiresEvidence: false,
    active: true,
  },
  {
    key: 'DE_ZERO_EXEMPT',
    label: 'Inland steuerfrei / nicht steuerbar',
    mechanism: 'exempt',
    defaultRate: 0,
    requiresCounterpartyVatId: false,
    requiresCountry: false,
    requiresEvidence: true,
    active: true,
  },
  {
    key: 'DE_KU19',
    label: 'Kleinunternehmer §19 UStG',
    mechanism: 'exempt',
    defaultRate: 0,
    requiresCounterpartyVatId: false,
    requiresCountry: false,
    requiresEvidence: true,
    active: true,
  },
  {
    key: 'DE_RC_13B_DOMESTIC',
    label: 'Reverse Charge §13b Inland',
    mechanism: 'reverse_charge',
    defaultRate: 19,
    requiresCounterpartyVatId: false,
    requiresCountry: false,
    requiresEvidence: true,
    active: true,
  },
  {
    key: 'EU_B2C_OSS',
    label: 'EU B2C OSS (One-Stop-Shop)',
    mechanism: 'standard_vat',
    defaultRate: 19,
    requiresCounterpartyVatId: false,
    requiresCountry: true,
    requiresEvidence: true,
    active: true,
  },
  {
    key: 'DE_MARGIN_25A',
    label: 'Differenzbesteuerung §25a UStG',
    mechanism: 'exempt',
    defaultRate: 0,
    requiresCounterpartyVatId: false,
    requiresCountry: false,
    requiresEvidence: true,
    active: true,
  },
  {
    key: 'DE_BAUABZUG_48',
    label: 'Bauabzugsteuer §48 EStG',
    mechanism: 'exempt',
    defaultRate: 0,
    requiresCounterpartyVatId: false,
    requiresCountry: false,
    requiresEvidence: true,
    active: true,
  },
  {
    key: 'DE_TRIANGULAR_25B',
    label: 'Innergemeinschaftliches Dreiecksgeschäft §25b',
    mechanism: 'zero_rate',
    defaultRate: 0,
    requiresCounterpartyVatId: true,
    requiresCountry: true,
    requiresEvidence: true,
    active: true,
  },
  {
    key: 'EU_B2B_SERVICE_RC',
    label: 'EU B2B Dienstleistung RC',
    mechanism: 'reverse_charge',
    defaultRate: 19,
    requiresCounterpartyVatId: true,
    requiresCountry: true,
    requiresEvidence: true,
    active: true,
  },
  {
    key: 'EU_IGL_GOODS_0',
    label: 'Innergemeinschaftliche Lieferung 0%',
    mechanism: 'zero_rate',
    defaultRate: 0,
    requiresCounterpartyVatId: true,
    requiresCountry: true,
    requiresEvidence: true,
    active: true,
  },
  {
    key: 'EU_IGE_GOODS_RC',
    label: 'Innergemeinschaftlicher Erwerb RC',
    mechanism: 'reverse_charge',
    defaultRate: 19,
    requiresCounterpartyVatId: true,
    requiresCountry: true,
    requiresEvidence: true,
    active: true,
  },
  {
    key: 'NON_EU_EXPORT_0',
    label: 'Ausfuhrlieferung Drittland 0%',
    mechanism: 'zero_rate',
    defaultRate: 0,
    requiresCounterpartyVatId: false,
    requiresCountry: true,
    requiresEvidence: true,
    active: true,
  },
  {
    key: 'NON_EU_SERVICE_RC',
    label: 'Drittland Dienstleistungsbezug RC',
    mechanism: 'reverse_charge',
    defaultRate: 19,
    requiresCounterpartyVatId: false,
    requiresCountry: true,
    requiresEvidence: true,
    active: true,
  },
];

const DEFAULT_TAX_MAPPINGS: Array<Omit<TaxCaseAccountMapping, 'id' | 'updatedAt'>> = [
  // SKR03 standard VAT
  { chart: 'SKR03', taxCaseKey: 'DE_STD_19', role: 'output_tax', accountNumber: '1776', datevBuKey: '1' },
  { chart: 'SKR03', taxCaseKey: 'DE_STD_19', role: 'input_tax', accountNumber: '1576', datevBuKey: '1' },
  { chart: 'SKR03', taxCaseKey: 'DE_STD_19', role: 'datev_bu', accountNumber: '1776', datevBuKey: '1' },
  { chart: 'SKR03', taxCaseKey: 'DE_STD_7', role: 'output_tax', accountNumber: '1771', datevBuKey: '2' },
  { chart: 'SKR03', taxCaseKey: 'DE_STD_7', role: 'input_tax', accountNumber: '1571', datevBuKey: '2' },
  { chart: 'SKR03', taxCaseKey: 'DE_STD_7', role: 'datev_bu', accountNumber: '1771', datevBuKey: '2' },
  { chart: 'SKR03', taxCaseKey: 'EU_B2C_OSS', role: 'output_tax', accountNumber: '1776', datevBuKey: '1' },
  { chart: 'SKR03', taxCaseKey: 'EU_B2C_OSS', role: 'input_tax', accountNumber: '1576', datevBuKey: '1' },
  { chart: 'SKR03', taxCaseKey: 'EU_B2C_OSS', role: 'datev_bu', accountNumber: '1776', datevBuKey: '1' },
  // SKR03 reverse charge
  { chart: 'SKR03', taxCaseKey: 'DE_RC_13B_DOMESTIC', role: 'output_tax', accountNumber: '1774', datevBuKey: '94' },
  { chart: 'SKR03', taxCaseKey: 'DE_RC_13B_DOMESTIC', role: 'input_tax', accountNumber: '1574', datevBuKey: '94' },
  { chart: 'SKR03', taxCaseKey: 'DE_RC_13B_DOMESTIC', role: 'datev_bu', accountNumber: '1774', datevBuKey: '94' },
  { chart: 'SKR03', taxCaseKey: 'EU_B2B_SERVICE_RC', role: 'output_tax', accountNumber: '1774', datevBuKey: '94' },
  { chart: 'SKR03', taxCaseKey: 'EU_B2B_SERVICE_RC', role: 'input_tax', accountNumber: '1574', datevBuKey: '94' },
  { chart: 'SKR03', taxCaseKey: 'EU_B2B_SERVICE_RC', role: 'datev_bu', accountNumber: '1774', datevBuKey: '94' },
  { chart: 'SKR03', taxCaseKey: 'EU_IGE_GOODS_RC', role: 'output_tax', accountNumber: '1774', datevBuKey: '89' },
  { chart: 'SKR03', taxCaseKey: 'EU_IGE_GOODS_RC', role: 'input_tax', accountNumber: '1574', datevBuKey: '89' },
  { chart: 'SKR03', taxCaseKey: 'EU_IGE_GOODS_RC', role: 'datev_bu', accountNumber: '1774', datevBuKey: '89' },
  { chart: 'SKR03', taxCaseKey: 'NON_EU_SERVICE_RC', role: 'output_tax', accountNumber: '1774', datevBuKey: '95' },
  { chart: 'SKR03', taxCaseKey: 'NON_EU_SERVICE_RC', role: 'input_tax', accountNumber: '1574', datevBuKey: '95' },
  { chart: 'SKR03', taxCaseKey: 'NON_EU_SERVICE_RC', role: 'datev_bu', accountNumber: '1774', datevBuKey: '95' },
  // SKR03 0/exempt
  { chart: 'SKR03', taxCaseKey: 'DE_ZERO_EXEMPT', role: 'datev_bu', accountNumber: '8400', datevBuKey: '0' },
  { chart: 'SKR03', taxCaseKey: 'DE_KU19', role: 'datev_bu', accountNumber: '8400', datevBuKey: '0' },
  { chart: 'SKR03', taxCaseKey: 'DE_MARGIN_25A', role: 'datev_bu', accountNumber: '8400', datevBuKey: '0' },
  { chart: 'SKR03', taxCaseKey: 'DE_BAUABZUG_48', role: 'datev_bu', accountNumber: '8400', datevBuKey: '0' },
  { chart: 'SKR03', taxCaseKey: 'DE_TRIANGULAR_25B', role: 'datev_bu', accountNumber: '8125', datevBuKey: '42' },
  { chart: 'SKR03', taxCaseKey: 'EU_IGL_GOODS_0', role: 'datev_bu', accountNumber: '8125', datevBuKey: '41' },
  { chart: 'SKR03', taxCaseKey: 'NON_EU_EXPORT_0', role: 'datev_bu', accountNumber: '8120', datevBuKey: '43' },
  // SKR04 standard VAT
  { chart: 'SKR04', taxCaseKey: 'DE_STD_19', role: 'output_tax', accountNumber: '3806', datevBuKey: '1' },
  { chart: 'SKR04', taxCaseKey: 'DE_STD_19', role: 'input_tax', accountNumber: '1406', datevBuKey: '1' },
  { chart: 'SKR04', taxCaseKey: 'DE_STD_19', role: 'datev_bu', accountNumber: '3806', datevBuKey: '1' },
  { chart: 'SKR04', taxCaseKey: 'DE_STD_7', role: 'output_tax', accountNumber: '3801', datevBuKey: '2' },
  { chart: 'SKR04', taxCaseKey: 'DE_STD_7', role: 'input_tax', accountNumber: '1401', datevBuKey: '2' },
  { chart: 'SKR04', taxCaseKey: 'DE_STD_7', role: 'datev_bu', accountNumber: '3801', datevBuKey: '2' },
  { chart: 'SKR04', taxCaseKey: 'EU_B2C_OSS', role: 'output_tax', accountNumber: '3806', datevBuKey: '1' },
  { chart: 'SKR04', taxCaseKey: 'EU_B2C_OSS', role: 'input_tax', accountNumber: '1406', datevBuKey: '1' },
  { chart: 'SKR04', taxCaseKey: 'EU_B2C_OSS', role: 'datev_bu', accountNumber: '3806', datevBuKey: '1' },
  // SKR04 reverse charge
  { chart: 'SKR04', taxCaseKey: 'DE_RC_13B_DOMESTIC', role: 'output_tax', accountNumber: '3804', datevBuKey: '94' },
  { chart: 'SKR04', taxCaseKey: 'DE_RC_13B_DOMESTIC', role: 'input_tax', accountNumber: '1404', datevBuKey: '94' },
  { chart: 'SKR04', taxCaseKey: 'DE_RC_13B_DOMESTIC', role: 'datev_bu', accountNumber: '3804', datevBuKey: '94' },
  { chart: 'SKR04', taxCaseKey: 'EU_B2B_SERVICE_RC', role: 'output_tax', accountNumber: '3804', datevBuKey: '94' },
  { chart: 'SKR04', taxCaseKey: 'EU_B2B_SERVICE_RC', role: 'input_tax', accountNumber: '1404', datevBuKey: '94' },
  { chart: 'SKR04', taxCaseKey: 'EU_B2B_SERVICE_RC', role: 'datev_bu', accountNumber: '3804', datevBuKey: '94' },
  { chart: 'SKR04', taxCaseKey: 'EU_IGE_GOODS_RC', role: 'output_tax', accountNumber: '3804', datevBuKey: '89' },
  { chart: 'SKR04', taxCaseKey: 'EU_IGE_GOODS_RC', role: 'input_tax', accountNumber: '1404', datevBuKey: '89' },
  { chart: 'SKR04', taxCaseKey: 'EU_IGE_GOODS_RC', role: 'datev_bu', accountNumber: '3804', datevBuKey: '89' },
  { chart: 'SKR04', taxCaseKey: 'NON_EU_SERVICE_RC', role: 'output_tax', accountNumber: '3804', datevBuKey: '95' },
  { chart: 'SKR04', taxCaseKey: 'NON_EU_SERVICE_RC', role: 'input_tax', accountNumber: '1404', datevBuKey: '95' },
  { chart: 'SKR04', taxCaseKey: 'NON_EU_SERVICE_RC', role: 'datev_bu', accountNumber: '3804', datevBuKey: '95' },
  // SKR04 0/exempt
  { chart: 'SKR04', taxCaseKey: 'DE_ZERO_EXEMPT', role: 'datev_bu', accountNumber: '4400', datevBuKey: '0' },
  { chart: 'SKR04', taxCaseKey: 'DE_KU19', role: 'datev_bu', accountNumber: '4400', datevBuKey: '0' },
  { chart: 'SKR04', taxCaseKey: 'DE_MARGIN_25A', role: 'datev_bu', accountNumber: '4400', datevBuKey: '0' },
  { chart: 'SKR04', taxCaseKey: 'DE_BAUABZUG_48', role: 'datev_bu', accountNumber: '4400', datevBuKey: '0' },
  { chart: 'SKR04', taxCaseKey: 'DE_TRIANGULAR_25B', role: 'datev_bu', accountNumber: '4125', datevBuKey: '42' },
  { chart: 'SKR04', taxCaseKey: 'EU_IGL_GOODS_0', role: 'datev_bu', accountNumber: '4125', datevBuKey: '41' },
  { chart: 'SKR04', taxCaseKey: 'NON_EU_EXPORT_0', role: 'datev_bu', accountNumber: '4120', datevBuKey: '43' },
];

const normalizeTaxCaseKeyAliases = (value?: string): TaxCaseKey | undefined => {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  if (raw === 'USt19' || raw === 'VSt19') return 'DE_STD_19';
  if (raw === 'USt7' || raw === 'VSt7') return 'DE_STD_7';
  const upper = raw.toUpperCase();
  return TAX_CASE_DEFINITIONS.some((item) => item.key === upper) ? (upper as TaxCaseKey) : undefined;
};

export const normalizeTaxCaseKey = (value?: string): TaxCaseKey | undefined =>
  normalizeTaxCaseKeyAliases(value);

export const listTaxCases = (db: Database.Database, args: { activeOnly?: boolean } = {}): TaxCaseDefinition[] => {
  const rows = db
    .prepare(
      `
      SELECT key, label, mechanism, default_rate, requires_counterparty_vat_id, requires_country, requires_evidence, active
      FROM tax_cases
      ${args.activeOnly ? 'WHERE active = 1' : ''}
      ORDER BY key ASC
      `,
    )
    .all() as Array<{
    key: string;
    label: string;
    mechanism: TaxMechanism;
    default_rate: number;
    requires_counterparty_vat_id: number;
    requires_country: number;
    requires_evidence: number;
    active: number;
  }>;
  return rows.map((row) => ({
    key: row.key as TaxCaseKey,
    label: row.label,
    mechanism: row.mechanism,
    defaultRate: Number(row.default_rate || 0),
    requiresCounterpartyVatId: Number(row.requires_counterparty_vat_id || 0) === 1,
    requiresCountry: Number(row.requires_country || 0) === 1,
    requiresEvidence: Number(row.requires_evidence || 0) === 1,
    active: Number(row.active || 0) === 1,
  }));
};

export const getTaxCaseByKey = (db: Database.Database, key?: string): TaxCaseDefinition | undefined => {
  const normalized = normalizeTaxCaseKey(key);
  if (!normalized) return undefined;
  const row = db
    .prepare(
      `
      SELECT key, label, mechanism, default_rate, requires_counterparty_vat_id, requires_country, requires_evidence, active
      FROM tax_cases
      WHERE key = ?
      LIMIT 1
      `,
    )
    .get(normalized) as {
    key: string;
    label: string;
    mechanism: TaxMechanism;
    default_rate: number;
    requires_counterparty_vat_id: number;
    requires_country: number;
    requires_evidence: number;
    active: number;
  } | undefined;
  if (!row) return undefined;
  return {
    key: row.key as TaxCaseKey,
    label: row.label,
    mechanism: row.mechanism,
    defaultRate: Number(row.default_rate || 0),
    requiresCounterpartyVatId: Number(row.requires_counterparty_vat_id || 0) === 1,
    requiresCountry: Number(row.requires_country || 0) === 1,
    requiresEvidence: Number(row.requires_evidence || 0) === 1,
    active: Number(row.active || 0) === 1,
  };
};

export const listTaxCaseAccountMappings = (
  db: Database.Database,
  args: { chart?: 'SKR03' | 'SKR04'; taxCaseKey?: TaxCaseKey } = {},
): TaxCaseAccountMapping[] => {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (args.chart) {
    where.push('chart = @chart');
    params.chart = args.chart;
  }
  if (args.taxCaseKey) {
    where.push('tax_case_key = @taxCaseKey');
    params.taxCaseKey = args.taxCaseKey;
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `
      SELECT id, chart, tax_case_key, role, account_number, datev_bu_key, valid_from, valid_to, updated_at
      FROM tax_case_account_mappings
      ${whereSql}
      ORDER BY chart ASC, tax_case_key ASC, role ASC
      `,
    )
    .all(params) as Array<{
    id: string;
    chart: 'SKR03' | 'SKR04';
    tax_case_key: TaxCaseKey;
    role: TaxMappingRole;
    account_number: string;
    datev_bu_key: string | null;
    valid_from: string | null;
    valid_to: string | null;
    updated_at: string;
  }>;

  return rows.map((row) => ({
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
};

export const upsertTaxCaseAccountMapping = (
  db: Database.Database,
  payload: {
    id?: string;
    chart: 'SKR03' | 'SKR04';
    taxCaseKey: TaxCaseKey;
    role: TaxMappingRole;
    accountNumber: string;
    datevBuKey?: string;
    validFrom?: string;
    validTo?: string;
  },
): TaxCaseAccountMapping => {
  const now = new Date().toISOString();
  const id = payload.id ?? randomUUID();
  db.prepare(
    `
      INSERT INTO tax_case_account_mappings
        (id, chart, tax_case_key, role, account_number, datev_bu_key, valid_from, valid_to, updated_at)
      VALUES
        (@id, @chart, @taxCaseKey, @role, @accountNumber, @datevBuKey, @validFrom, @validTo, @updatedAt)
      ON CONFLICT(chart, tax_case_key, role) DO UPDATE SET
        account_number = excluded.account_number,
        datev_bu_key = excluded.datev_bu_key,
        valid_from = excluded.valid_from,
        valid_to = excluded.valid_to,
        updated_at = excluded.updated_at
      `,
  ).run({
    id,
    chart: payload.chart,
    taxCaseKey: payload.taxCaseKey,
    role: payload.role,
    accountNumber: payload.accountNumber,
    datevBuKey: payload.datevBuKey ?? null,
    validFrom: payload.validFrom ?? null,
    validTo: payload.validTo ?? null,
    updatedAt: now,
  });

  const row = db
    .prepare(
      `
      SELECT id, chart, tax_case_key, role, account_number, datev_bu_key, valid_from, valid_to, updated_at
      FROM tax_case_account_mappings
      WHERE chart = ? AND tax_case_key = ? AND role = ?
      LIMIT 1
      `,
    )
    .get(payload.chart, payload.taxCaseKey, payload.role) as {
    id: string;
    chart: 'SKR03' | 'SKR04';
    tax_case_key: TaxCaseKey;
    role: TaxMappingRole;
    account_number: string;
    datev_bu_key: string | null;
    valid_from: string | null;
    valid_to: string | null;
    updated_at: string;
  };

  return {
    id: row.id,
    chart: row.chart,
    taxCaseKey: row.tax_case_key,
    role: row.role,
    accountNumber: row.account_number,
    datevBuKey: row.datev_bu_key ?? undefined,
    validFrom: row.valid_from ?? undefined,
    validTo: row.valid_to ?? undefined,
    updatedAt: row.updated_at,
  };
};

export const resolveTaxAccountsForCase = (
  db: Database.Database,
  chart: 'SKR03' | 'SKR04',
  taxCaseKey?: string,
): { outputTaxAccount?: string; inputTaxAccount?: string; datevBuKey?: string } => {
  const normalized = normalizeTaxCaseKey(taxCaseKey);
  if (!normalized) return {};
  const rows = listTaxCaseAccountMappings(db, { chart, taxCaseKey: normalized });
  const byRole = new Map(rows.map((row) => [row.role, row]));
  return {
    outputTaxAccount: byRole.get('output_tax')?.accountNumber,
    inputTaxAccount: byRole.get('input_tax')?.accountNumber,
    datevBuKey: byRole.get('datev_bu')?.datevBuKey,
  };
};

export const resolveDatevBuKeyForTaxCase = (
  db: Database.Database,
  chart: 'SKR03' | 'SKR04',
  taxCaseKey?: string,
): string | undefined => resolveTaxAccountsForCase(db, chart, taxCaseKey).datevBuKey;

export const ensureTaxCaseSeedData = (db: Database.Database): void => {
  const now = new Date().toISOString();
  const insertCase = db.prepare(
    `
      INSERT INTO tax_cases
        (key, label, mechanism, default_rate, requires_counterparty_vat_id, requires_country, requires_evidence, active, updated_at)
      VALUES
        (@key, @label, @mechanism, @defaultRate, @requiresCounterpartyVatId, @requiresCountry, @requiresEvidence, @active, @updatedAt)
      ON CONFLICT(key) DO UPDATE SET
        label = excluded.label,
        mechanism = excluded.mechanism,
        default_rate = excluded.default_rate,
        requires_counterparty_vat_id = excluded.requires_counterparty_vat_id,
        requires_country = excluded.requires_country,
        requires_evidence = excluded.requires_evidence,
        active = excluded.active,
        updated_at = excluded.updated_at
      `,
  );

  const tx = db.transaction(() => {
    for (const def of TAX_CASE_DEFINITIONS) {
      insertCase.run({
        key: def.key,
        label: def.label,
        mechanism: def.mechanism,
        defaultRate: def.defaultRate,
        requiresCounterpartyVatId: def.requiresCounterpartyVatId ? 1 : 0,
        requiresCountry: def.requiresCountry ? 1 : 0,
        requiresEvidence: def.requiresEvidence ? 1 : 0,
        active: def.active ? 1 : 0,
        updatedAt: now,
      });
    }

    const countRow = db
      .prepare('SELECT COUNT(*) as c FROM tax_case_account_mappings')
      .get() as { c: number };
    if ((countRow.c ?? 0) > 0) return;

    for (const mapping of DEFAULT_TAX_MAPPINGS) {
      upsertTaxCaseAccountMapping(db, mapping);
    }
  });

  tx();
};
