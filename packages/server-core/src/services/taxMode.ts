import type {
  BillingLineItem,
  InvoiceTaxMeta,
  InvoiceTaxMode,
  InvoiceTaxSnapshot,
} from '../domain/foundations.js';

export type TaxSettingsShape = {
  legal: {
    smallBusinessRule?: boolean;
    defaultVatRate?: number;
  };
};

export type TaxableDocumentInput = {
  items?: BillingLineItem[];
  taxMode?: InvoiceTaxMode;
  taxMeta?: InvoiceTaxMeta;
};

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const resolveInvoiceTaxMode = (
  taxMode: InvoiceTaxMode | undefined,
  settings: TaxSettingsShape,
): InvoiceTaxMode => {
  if (taxMode === 'custom') return 'custom';
  if (settings.legal.smallBusinessRule) return 'small_business_19_ustg';
  return taxMode === 'small_business_19_ustg' ? 'standard_vat' : (taxMode ?? 'standard_vat');
};

export const calculateInvoiceTaxSnapshot = (
  input: TaxableDocumentInput,
  settings: TaxSettingsShape,
): InvoiceTaxSnapshot => {
  const netAmount = round2((input.items ?? []).reduce((sum, item) => sum + (Number(item.total) || 0), 0));
  const resolvedTaxMode = resolveInvoiceTaxMode(input.taxMode, settings);

  if (resolvedTaxMode === 'small_business_19_ustg') {
    return {
      netAmount,
      taxAmount: 0,
      grossAmount: netAmount,
      taxRate: 0,
      taxLabel: input.taxMeta?.label?.trim() || 'Keine Umsatzsteuer',
      taxNote:
        input.taxMeta?.note?.trim() || 'Gem. § 19 UStG wird keine Umsatzsteuer berechnet.',
    };
  }

  const taxRate =
    resolvedTaxMode === 'custom'
      ? Number(input.taxMeta?.rate) || 0
      : Number(settings.legal.defaultVatRate) || 0;
  const taxAmount = round2(netAmount * (taxRate / 100));

  return {
    netAmount,
    taxAmount,
    grossAmount: round2(netAmount + taxAmount),
    taxRate,
    taxLabel:
      input.taxMeta?.label?.trim() ||
      (resolvedTaxMode === 'custom' ? 'Steuer' : `MwSt. ${taxRate.toFixed(0)}%`),
    taxNote: input.taxMeta?.note?.trim() || undefined,
  };
};
