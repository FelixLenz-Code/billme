import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import type { AddressInfo } from 'net';
import { afterEach, describe, expect, it } from 'vitest';
import { appSettingsSchema } from '../ipc/schemas';
import {
  BACKUP_PREFIX,
  pruneBackups,
  uploadWebdav,
  withinMinInterval,
  type BackupSettings,
} from './backupRunner';

const tmpDirs: string[] = [];
const makeTmpDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'billme-backup-test-'));
  tmpDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

const baseSettings = (patch: Partial<BackupSettings> = {}): BackupSettings => ({
  enabled: true,
  onExit: true,
  directory: '',
  retentionCount: 10,
  minIntervalHours: 0,
  target: 'local',
  ...patch,
});

describe('withinMinInterval', () => {
  it('is false when interval is 0 (always back up)', () => {
    expect(withinMinInterval(baseSettings({ minIntervalHours: 0, lastRun: new Date().toISOString() }))).toBe(false);
  });

  it('is false when there is no previous run', () => {
    expect(withinMinInterval(baseSettings({ minIntervalHours: 12 }))).toBe(false);
  });

  it('is true when the last run is within the interval', () => {
    const now = Date.now();
    const lastRun = new Date(now - 60 * 60 * 1000).toISOString(); // 1h ago
    expect(withinMinInterval(baseSettings({ minIntervalHours: 12, lastRun }), now)).toBe(true);
  });

  it('is false when the last run is older than the interval', () => {
    const now = Date.now();
    const lastRun = new Date(now - 13 * 60 * 60 * 1000).toISOString(); // 13h ago
    expect(withinMinInterval(baseSettings({ minIntervalHours: 12, lastRun }), now)).toBe(false);
  });
});

describe('pruneBackups', () => {
  it('keeps only the newest N matching backups', () => {
    const dir = makeTmpDir();
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      const file = path.join(dir, `${BACKUP_PREFIX}-2026-01-0${i + 1}.sqlite`);
      fs.writeFileSync(file, `backup ${i}`);
      const t = new Date(base + i * 1000); // increasing mtimes; i=4 is newest
      fs.utimesSync(file, t, t);
    }
    // An unrelated file must never be deleted.
    fs.writeFileSync(path.join(dir, 'keep-me.txt'), 'x');

    pruneBackups(dir, 2);

    const remaining = fs.readdirSync(dir).sort();
    expect(remaining).toContain('keep-me.txt');
    const backups = remaining.filter((f) => f.startsWith(BACKUP_PREFIX));
    expect(backups).toEqual(['billme-backup-2026-01-04.sqlite', 'billme-backup-2026-01-05.sqlite']);
  });

  it('does nothing for keep <= 0 or a missing directory', () => {
    const dir = makeTmpDir();
    const file = path.join(dir, `${BACKUP_PREFIX}-x.sqlite`);
    fs.writeFileSync(file, 'x');
    pruneBackups(dir, 0);
    expect(fs.existsSync(file)).toBe(true);
    expect(() => pruneBackups(path.join(dir, 'nope'), 3)).not.toThrow();
  });
});

describe('uploadWebdav', () => {
  it('creates the collection and PUTs the file with basic auth', async () => {
    const received: { method?: string; url?: string; auth?: string; body?: string } = {};
    const server = http.createServer((req, res) => {
      if (req.method === 'PUT') {
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(c as Buffer));
        req.on('end', () => {
          received.method = req.method;
          received.url = req.url;
          received.auth = req.headers.authorization;
          received.body = Buffer.concat(chunks).toString('utf8');
          res.statusCode = 201;
          res.end();
        });
      } else {
        // MKCOL etc.
        res.statusCode = 201;
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;

    const dir = makeTmpDir();
    const file = path.join(dir, 'billme-backup-test.sqlite');
    fs.writeFileSync(file, 'SQLITE-CONTENT');

    try {
      await uploadWebdav(file, {
        url: `http://127.0.0.1:${port}/dav/`,
        username: 'user',
        password: 'pass',
        remoteDir: 'billme-backups',
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    expect(received.method).toBe('PUT');
    expect(received.url).toBe('/dav/billme-backups/billme-backup-test.sqlite');
    expect(received.auth).toBe('Basic ' + Buffer.from('user:pass').toString('base64'));
    expect(received.body).toBe('SQLITE-CONTENT');
  });

  it('rejects non-https remote (except localhost)', async () => {
    const dir = makeTmpDir();
    const file = path.join(dir, 'b.sqlite');
    fs.writeFileSync(file, 'x');
    await expect(
      uploadWebdav(file, { url: 'http://example.com/dav/', username: 'u', password: 'p', remoteDir: '' }),
    ).rejects.toThrow(/https/i);
  });
});

describe('appSettingsSchema backup round-trip', () => {
  it('preserves the backup section through IPC validation', () => {
    const parsed = appSettingsSchema.parse({
      company: { name: '', owner: '', street: '', zip: '', city: '', email: '', phone: '', website: '' },
      finance: { bankName: '', iban: '', bic: '', taxId: '', vatId: '', registerCourt: '' },
      numbers: { invoicePrefix: 'RE-', nextInvoiceNumber: 1, numberLength: 3, offerPrefix: 'AN-', nextOfferNumber: 1 },
      dunning: { levels: [] },
      legal: {
        smallBusinessRule: false,
        defaultVatRate: 19,
        paymentTermsDays: 14,
        defaultIntroText: '',
        defaultFooterText: '',
      },
      backup: {
        enabled: true,
        onExit: true,
        directory: '/tmp/backups',
        retentionCount: 5,
        minIntervalHours: 6,
        target: 'webdav',
        webdav: { url: 'https://cloud.example.com/dav/', username: 'u', remoteDir: 'billme' },
      },
    });
    expect(parsed.backup?.enabled).toBe(true);
    expect(parsed.backup?.target).toBe('webdav');
    expect(parsed.backup?.directory).toBe('/tmp/backups');
    expect(parsed.backup?.webdav?.url).toBe('https://cloud.example.com/dav/');
  });
});
