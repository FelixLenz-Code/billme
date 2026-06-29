import { describe, expect, it } from 'vitest';
import type { AppSettings, Invoice } from '../types';
import { buildEmailContext, resolveEmailPlaceholders, splitContactName } from './emailTemplate';

const doc = {
  number: 'RE-2026-001',
  client: 'Acme GmbH',
  clientNumber: 'KD-0001',
  date: '2026-01-15',
  dueDate: '2026-01-29',
  amount: 119,
} as unknown as Invoice;

const settings = { company: { name: 'Billme', owner: 'Owner' } } as unknown as AppSettings;

describe('splitContactName', () => {
  it('splits first and last name', () => {
    expect(splitContactName('Max Müller')).toEqual({ firstName: 'Max', lastName: 'Müller' });
  });
  it('treats a single token as the last name', () => {
    expect(splitContactName('Müller')).toEqual({ firstName: '', lastName: 'Müller' });
  });
  it('keeps multiple given names with the first name', () => {
    expect(splitContactName('Anna Maria Schmidt')).toEqual({ firstName: 'Anna Maria', lastName: 'Schmidt' });
  });
  it('returns empty for blank input', () => {
    expect(splitContactName('  ')).toEqual({ firstName: '', lastName: '' });
  });
});

describe('buildEmailContext contact variables', () => {
  it('uses explicit first/last name when provided', () => {
    const ctx = buildEmailContext(doc, 'invoice', settings, {
      person: 'Max Müller',
      firstName: 'Max',
      lastName: 'Müller',
    });
    expect(ctx['client.contactLastName']).toBe('Müller');
    expect(ctx['client.contactFirstName']).toBe('Max');
    expect(ctx['client.contact']).toBe('Max Müller');
  });

  it('falls back to splitting the combined name for legacy clients', () => {
    const ctx = buildEmailContext(doc, 'invoice', settings, { person: 'Erika Mustermann' });
    expect(ctx['client.contactLastName']).toBe('Mustermann');
    expect(ctx['client.contactFirstName']).toBe('Erika');
  });

  it('resolves the last-name placeholder in a template', () => {
    const ctx = buildEmailContext(doc, 'invoice', settings, { lastName: 'Müller' });
    expect(resolveEmailPlaceholders('Sehr geehrter Herr {{client.contactLastName}},', ctx)).toBe(
      'Sehr geehrter Herr Müller,',
    );
  });
});
