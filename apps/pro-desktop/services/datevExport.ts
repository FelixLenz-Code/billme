import iconv from 'iconv-lite';

export interface DatevBuchungsstapelRow {
  date: string;
  belegfeld1: string;
  buchungstext: string;
  konto: string;
  gegenkonto: string;
  sollHabenKennzeichen?: 'S' | 'H';
  buSchluessel?: string;
  umsatz: number;
}

const DATEV_COLUMNS = [
  'Umsatz (ohne Soll/Haben-Kz)',
  'Soll/Haben-Kennzeichen',
  'WKZ Umsatz',
  'Kurs',
  'Basis-Umsatz',
  'WKZ Basis-Umsatz',
  'Konto',
  'Gegenkonto (ohne BU-Schlüssel)',
  'BU-Schlüssel',
  'Belegdatum',
  'Belegfeld 1',
  'Buchungstext',
] as const;

const escapeCsvField = (value: string): string => {
  if (!/[;"\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
};

const toDatevDate = (isoDate: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return '';
  return `${m[3]}${m[2]}${m[1]}`;
};

const normalizeText = (value: string, maxLen: number): string => {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen);
};

export const validateDatevRows = (rows: DatevBuchungsstapelRow[]): void => {
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const rowNo = idx + 1;
    if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(row.date)) {
      errors.push(`Zeile ${rowNo}: Belegdatum muss YYYY-MM-DD sein.`);
    }
    if (!/^\d{3,8}$/.test(String(row.konto))) {
      errors.push(`Zeile ${rowNo}: Konto muss 3-8 Ziffern haben.`);
    }
    if (!/^\d{3,8}$/.test(String(row.gegenkonto))) {
      errors.push(`Zeile ${rowNo}: Gegenkonto muss 3-8 Ziffern haben.`);
    }
    if (row.sollHabenKennzeichen && !['S', 'H'].includes(row.sollHabenKennzeichen)) {
      errors.push(`Zeile ${rowNo}: Soll/Haben-Kennzeichen muss S oder H sein.`);
    }
    if (row.buSchluessel && !/^\d{1,3}$/.test(row.buSchluessel)) {
      errors.push(`Zeile ${rowNo}: BU-Schlüssel muss 1-3 Ziffern haben.`);
    }
    if (!Number.isFinite(row.umsatz) || row.umsatz <= 0) {
      errors.push(`Zeile ${rowNo}: Umsatz muss > 0 sein.`);
    }
    if (!row.belegfeld1 || !row.belegfeld1.trim()) {
      errors.push(`Zeile ${rowNo}: Belegfeld 1 ist Pflicht.`);
    }
    if (!row.buchungstext || !row.buchungstext.trim()) {
      errors.push(`Zeile ${rowNo}: Buchungstext ist Pflicht.`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`DATEV Buchungsstapel Validierung fehlgeschlagen:\n${errors.join('\n')}`);
  }
};

export const buildDatevBuchungsstapelCsv = (rows: DatevBuchungsstapelRow[]): Buffer => {
  validateDatevRows(rows);

  const lines: string[] = [];
  lines.push(
    [
      'EXTF',
      '700',
      '21',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ].join(';'),
  );
  lines.push(DATEV_COLUMNS.join(';'));

  for (const row of rows) {
    const formatted = [
      row.umsatz.toFixed(2).replace('.', ','),
      row.sollHabenKennzeichen ?? 'S',
      'EUR',
      '',
      '',
      '',
      String(row.konto),
      String(row.gegenkonto),
      row.buSchluessel ?? '',
      toDatevDate(row.date),
      normalizeText(row.belegfeld1, 36),
      normalizeText(row.buchungstext, 60),
    ].map((value) => escapeCsvField(String(value)));

    lines.push(formatted.join(';'));
  }

  const cp1252 = iconv.encode(lines.join('\r\n'), 'win1252');
  const utf8Bom = Buffer.from([0xef, 0xbb, 0xbf]);
  return Buffer.concat([utf8Bom, cp1252]);
};
