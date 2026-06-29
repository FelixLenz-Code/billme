import type { AppSettings, Invoice } from '../types';

export interface EmailVariable {
  key: string;
  label: string;
}

// Verfügbare Platzhalter für den E-Mail-Standardtext.
export const EMAIL_VARIABLES: EmailVariable[] = [
  { key: 'document.type', label: 'Dokumenttyp (Rechnung/Angebot)' },
  { key: 'document.number', label: 'Rechnungs-/Angebotsnummer' },
  { key: 'document.date', label: 'Datum' },
  { key: 'document.dueDate', label: 'Fälligkeit' },
  { key: 'document.total', label: 'Gesamtbetrag (brutto)' },
  { key: 'client.name', label: 'Kundenname' },
  { key: 'client.contact', label: 'Ansprechpartner (voller Name)' },
  { key: 'client.contactFirstName', label: 'Ansprechpartner – Vorname' },
  { key: 'client.contactLastName', label: 'Ansprechpartner – Nachname' },
  { key: 'client.number', label: 'Kundennummer' },
  { key: 'company.name', label: 'Eigener Firmenname' },
  { key: 'company.owner', label: 'Ansprechpartner / Inhaber' },
];

// Standardwerte, falls in den Einstellungen nichts hinterlegt ist.
export const DEFAULT_EMAIL_SUBJECT = '{{document.type}} {{document.number}}';
export const DEFAULT_EMAIL_BODY =
  'Sehr geehrte Damen und Herren,\n\n' +
  'anbei erhalten Sie {{document.type}} {{document.number}}.\n\n' +
  'Mit freundlichen Grüßen,\n{{company.owner}}\n{{company.name}}';

const formatDate = (value?: string): string => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount || 0);

// Splits a combined contact name into first/last (last whitespace-separated token = last name).
// Used as a fallback for clients that only have the legacy combined name.
export const splitContactName = (full?: string): { firstName: string; lastName: string } => {
  const trimmed = (full ?? '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: '', lastName: parts[0]! };
  const lastName = parts.pop()!;
  return { firstName: parts.join(' '), lastName };
};

export interface EmailClientContact {
  person?: string;
  firstName?: string;
  lastName?: string;
}

// Baut die Werte für die Platzhalter aus Dokument und Einstellungen.
export const buildEmailContext = (
  doc: Invoice,
  documentType: 'invoice' | 'offer',
  settings: AppSettings,
  contact?: EmailClientContact,
): Record<string, string> => {
  const gross = Number(doc.taxSnapshot?.grossAmount ?? doc.amount) || 0;
  const fullContact = contact?.person ?? '';
  const fallback = splitContactName(fullContact);
  const firstName = (contact?.firstName ?? '').trim() || fallback.firstName;
  const lastName = (contact?.lastName ?? '').trim() || fallback.lastName;
  return {
    'document.type': documentType === 'invoice' ? 'Rechnung' : 'Angebot',
    'document.number': doc.number ?? '',
    'document.date': formatDate(doc.date),
    'document.dueDate': formatDate(doc.dueDate),
    'document.total': formatCurrency(gross),
    'client.name': doc.client ?? '',
    'client.contact': fullContact,
    'client.contactFirstName': firstName,
    'client.contactLastName': lastName,
    'client.number': doc.clientNumber ?? '',
    'company.name': settings.company?.name ?? '',
    'company.owner': settings.company?.owner ?? '',
  };
};

// Ersetzt {{platzhalter}} im Text. Unbekannte Platzhalter bleiben unverändert.
export const resolveEmailPlaceholders = (template: string, ctx: Record<string, string>): string =>
  template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) =>
    Object.prototype.hasOwnProperty.call(ctx, key) ? ctx[key]! : `{{${key}}}`,
  );
