import { describe, expect, it } from 'vitest';
import { buildDatevBuchungsstapelCsv, validateDatevRows } from './datevExport';

describe('datevExport', () => {
  it('validates mandatory DATEV row fields', () => {
    expect(() =>
      validateDatevRows([
        {
          date: '2026-03-03',
          belegfeld1: '1001',
          buchungstext: 'Eingang Rechnung 1001',
          konto: '1200',
          gegenkonto: '8400',
          umsatz: 100,
        },
      ]),
    ).not.toThrow();
  });

  it('rejects malformed rows', () => {
    expect(() =>
      validateDatevRows([
        {
          date: '03.03.2026',
          belegfeld1: '',
          buchungstext: '',
          konto: '12',
          gegenkonto: 'x',
          umsatz: 0,
        },
      ]),
    ).toThrow(/Validierung fehlgeschlagen/);
  });

  it('builds EXTF csv payload with bom', () => {
    const buf = buildDatevBuchungsstapelCsv([
      {
        date: '2026-03-03',
        belegfeld1: '1001',
        buchungstext: 'Eingang Rechnung 1001',
        konto: '1200',
        gegenkonto: '8400',
        umsatz: 100,
      },
    ]);

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
  });
});
