import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { bootstrapSql } from './bootstrap';
import { MOCK_SETTINGS } from '../data/mockData';
import { runMigrations } from './migrate';
import { getSettings, setSettings } from './settingsRepo';
import { formatDocumentNumber, reserveNumber } from './numberingRepo';

const createDb = (): Database.Database => {
  const db = new Database(':memory:');
  db.exec(bootstrapSql);
  return db;
};

const canRunNativeSqlite = (() => {
  try {
    const probe = new Database(':memory:');
    probe.close();
    return true;
  } catch {
    return false;
  }
})();

const insertClient = (db: Database.Database, id: string, customerNumber: string): void => {
  db.prepare(
    `
      INSERT INTO clients (
        id, customer_number, company, contact_person, email, phone, address, status, avatar, tags_json, notes
      ) VALUES (
        @id, @customerNumber, 'Test GmbH', '', '', '', '', 'active', NULL, '[]', ''
      )
    `,
  ).run({
    id,
    customerNumber,
  });
};

describe('numberingRepo.formatDocumentNumber', () => {
  it('formats invoice number with year token and zero padding', () => {
    const settings = {
      ...MOCK_SETTINGS,
      numbers: {
        ...MOCK_SETTINGS.numbers,
        invoicePrefix: 'RE-%Y-',
        numberLength: 4,
      },
    };
    const now = new Date('2026-01-03T00:00:00.000Z');
    const number = formatDocumentNumber(settings as any, 'invoice', 7, now);
    expect(number).toBe('RE-2026-0007');
  });

  it('formats offer number with same padding rules', () => {
    const settings = {
      ...MOCK_SETTINGS,
      numbers: {
        ...MOCK_SETTINGS.numbers,
        offerPrefix: 'ANG-%Y-',
        numberLength: 3,
      },
    };
    const now = new Date('2026-12-31T00:00:00.000Z');
    const number = formatDocumentNumber(settings as any, 'offer', 42, now);
    expect(number).toBe('ANG-2026-042');
  });

  it('formats customer number with dedicated customer length', () => {
    const settings = {
      ...MOCK_SETTINGS,
      numbers: {
        ...MOCK_SETTINGS.numbers,
        customerPrefix: 'KD-%Y-',
        customerNumberLength: 5,
      },
    };
    const now = new Date('2026-12-31T00:00:00.000Z');
    const number = formatDocumentNumber(settings as any, 'customer', 42, now);
    expect(number).toBe('KD-2026-00042');
  });

  it('falls back to safe counter when counter is invalid', () => {
    const settings = {
      ...MOCK_SETTINGS,
      numbers: {
        ...MOCK_SETTINGS.numbers,
        invoicePrefix: 'RE-%Y-',
        numberLength: 4,
      },
    };
    const now = new Date('2026-01-03T00:00:00.000Z');
    const number = formatDocumentNumber(settings as any, 'invoice', Number.NaN, now);
    expect(number).toBe('RE-2026-0001');
  });
});

describe.skipIf(!canRunNativeSqlite)('numberingRepo customer reservations', () => {
  it('skips already used customer numbers when the next counter is stale', () => {
    const db = createDb();
    runMigrations(db);
    setSettings(db, {
      ...MOCK_SETTINGS,
      numbers: {
        ...MOCK_SETTINGS.numbers,
        customerPrefix: 'KD-',
        customerNumberLength: 4,
        nextCustomerNumber: 4,
      },
    });
    insertClient(db, 'client-1', 'KD-0004');

    const reservation = reserveNumber(db, 'customer');
    const settings = getSettings(db);

    expect(reservation.number).toBe('KD-0005');
    expect(settings?.numbers.nextCustomerNumber).toBe(6);
  });

  it('repairs a stale next customer counter during migrations', () => {
    const db = createDb();
    setSettings(db, {
      ...MOCK_SETTINGS,
      numbers: {
        ...MOCK_SETTINGS.numbers,
        customerPrefix: 'KD-',
        customerNumberLength: 4,
        nextCustomerNumber: 2,
      },
    });
    insertClient(db, 'client-1', 'KD-0001');
    insertClient(db, 'client-2', 'KD-0002');
    insertClient(db, 'client-3', 'KD-0003');
    insertClient(db, 'client-4', 'KD-0004');

    runMigrations(db);

    expect(getSettings(db)?.numbers.nextCustomerNumber).toBe(5);
  });
});
