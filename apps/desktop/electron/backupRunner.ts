import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type Database from 'better-sqlite3';
import { backupSqlite, ensureDir } from '../db/backup';
import type { AppSettings } from '../types';
import type { BackupRunStatus } from '../db/settingsRepo';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

export type BackupSettings = NonNullable<AppSettings['backup']>;

export const BACKUP_PREFIX = 'billme-backup';
const OFFSITE_TIMEOUT_MS = 20_000;

const errMsg = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// Absolute directory backups are written to ('' = userData/backups).
export const resolveBackupDir = (userDataPath: string, settings: BackupSettings): string => {
  const custom = settings.directory?.trim();
  return custom ? path.resolve(custom) : path.resolve(path.join(userDataPath, 'backups'));
};

const backupFileName = (): string =>
  `${BACKUP_PREFIX}-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;

export const createLocalBackup = async (db: Database.Database, dir: string): Promise<string> => {
  ensureDir(dir);
  const dest = path.join(dir, backupFileName());
  await backupSqlite(db, dest);
  return dest;
};

// Keep only the newest `keep` backups in `dir`; delete older ones. Never throws.
export const pruneBackups = (dir: string, keep: number): void => {
  if (!Number.isFinite(keep) || keep <= 0) return;
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return;
  }
  const files = entries
    .filter((name) => name.startsWith(BACKUP_PREFIX) && /\.sqlite$/i.test(name))
    .map((name) => {
      const full = path.join(dir, name);
      let mtime = 0;
      try {
        mtime = fs.statSync(full).mtimeMs;
      } catch {
        mtime = 0;
      }
      return { name, full, mtime };
    })
    .sort((a, b) => b.mtime - a.mtime); // newest first

  for (const old of files.slice(keep)) {
    try {
      fs.unlinkSync(old.full);
    } catch (error) {
      logger.warn('Backup', 'Failed to prune old backup', { file: old.full, error: errMsg(error) });
    }
  }
};

// True when the last automatic backup is more recent than minIntervalHours.
export const withinMinInterval = (settings: BackupSettings, now = Date.now()): boolean => {
  const hours = settings.minIntervalHours ?? 0;
  if (!Number.isFinite(hours) || hours <= 0) return false;
  const last = settings.lastRun ? Date.parse(settings.lastRun) : NaN;
  if (!Number.isFinite(last)) return false;
  return now - last < hours * 3_600_000;
};

const joinUrl = (base: string, segment: string): string => {
  const b = base.replace(/\/+$/, '');
  const s = segment.replace(/^\/+/, '');
  return s ? `${b}/${s}` : b;
};

const assertSafeWebdavUrl = (urlStr: string): URL => {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new Error('Ungültige WebDAV-URL');
  }
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalhost)) {
    throw new Error('WebDAV erfordert https (außer localhost)');
  }
  return url;
};

interface WebdavRequestResult {
  status: number;
  body: string;
}

const webdavRequest = (
  method: string,
  urlStr: string,
  headers: Record<string, string>,
  body?: Buffer,
): Promise<WebdavRequestResult> => {
  const url = assertSafeWebdavUrl(urlStr);
  const transport = url.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      { method, headers, timeout: OFFSITE_TIMEOUT_MS },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }),
        );
      },
    );
    req.on('timeout', () => req.destroy(new Error('WebDAV-Zeitüberschreitung')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
};

export interface WebdavConfig {
  url: string;
  username: string;
  remoteDir: string;
  password: string;
}

// Uploads a file to a WebDAV collection (e.g. Nextcloud). Creates the remote
// directory if needed. Throws with a readable message on failure.
export const uploadWebdav = async (filePath: string, config: WebdavConfig): Promise<void> => {
  const authHeader = 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64');
  const collectionUrl = joinUrl(config.url, config.remoteDir ?? '');

  // Best-effort create the collection (idempotent: 201 created, 405/301 already exists).
  if (config.remoteDir?.trim()) {
    const mkcol = await webdavRequest('MKCOL', collectionUrl, { Authorization: authHeader });
    if (mkcol.status === 401 || mkcol.status === 403) {
      throw new Error('WebDAV-Authentifizierung fehlgeschlagen');
    }
    if (mkcol.status >= 400 && mkcol.status !== 405 && mkcol.status !== 301 && mkcol.status !== 409) {
      // 409 can mean parent missing; surface but continue to PUT attempt below.
      logger.warn('Backup', 'WebDAV MKCOL returned unexpected status', { status: mkcol.status });
    }
  }

  const fileUrl = joinUrl(collectionUrl, path.basename(filePath));
  const data = fs.readFileSync(filePath);
  const put = await webdavRequest(
    'PUT',
    fileUrl,
    { Authorization: authHeader, 'Content-Type': 'application/octet-stream', 'Content-Length': String(data.length) },
    data,
  );
  if (put.status === 401 || put.status === 403) {
    throw new Error('WebDAV-Authentifizierung fehlgeschlagen');
  }
  if (put.status < 200 || put.status >= 300) {
    throw new Error(`WebDAV-Upload fehlgeschlagen (HTTP ${put.status})`);
  }
};

const uploadRclone = async (
  filePath: string,
  config: NonNullable<BackupSettings['rclone']>,
): Promise<void> => {
  const bin = config.binaryPath?.trim() || 'rclone';
  const remote = config.remote?.trim();
  if (!remote) throw new Error('rclone-Remote ist nicht konfiguriert');
  const dest = `${remote.replace(/\/+$/, '')}/${path.basename(filePath)}`;
  try {
    await execFileAsync(bin, ['copyto', filePath, dest], { timeout: OFFSITE_TIMEOUT_MS });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      throw new Error('rclone wurde nicht gefunden. Bitte rclone installieren oder den Pfad angeben.');
    }
    throw new Error(`rclone-Upload fehlgeschlagen: ${errMsg(error)}`);
  }
};

// Transfers a local backup file to the configured offsite target.
export const uploadOffsite = async (
  filePath: string,
  settings: BackupSettings,
  webdavPassword: string,
): Promise<void> => {
  if (settings.target === 'webdav') {
    const w = settings.webdav;
    if (!w?.url?.trim()) throw new Error('WebDAV-URL ist nicht konfiguriert');
    await uploadWebdav(filePath, {
      url: w.url,
      username: w.username ?? '',
      remoteDir: w.remoteDir ?? '',
      password: webdavPassword,
    });
    return;
  }
  if (settings.target === 'rclone') {
    if (!settings.rclone) throw new Error('rclone ist nicht konfiguriert');
    await uploadRclone(filePath, settings.rclone);
    return;
  }
  // 'local': nothing to upload.
};

export interface BackupRunResult {
  status: BackupRunStatus;
  pendingOffsiteFile: string | null;
}

// Full pipeline: local snapshot -> prune -> offsite (best effort). The local
// backup succeeding is reported as ok even if the offsite transfer fails; a
// failed transfer leaves a pending file for a later retry.
export const runBackup = async (
  db: Database.Database,
  userDataPath: string,
  settings: BackupSettings,
  opts: { webdavPassword?: string } = {},
): Promise<BackupRunResult> => {
  const at = new Date().toISOString();
  const dir = resolveBackupDir(userDataPath, settings);

  let localPath: string;
  try {
    localPath = await createLocalBackup(db, dir);
  } catch (error) {
    return {
      status: { ok: false, at, error: `Lokales Backup fehlgeschlagen: ${errMsg(error)}` },
      pendingOffsiteFile: null,
    };
  }

  pruneBackups(dir, settings.retentionCount ?? 10);

  if (settings.target === 'local') {
    return { status: { ok: true, at, path: localPath, offsite: 'skipped' }, pendingOffsiteFile: null };
  }

  try {
    await uploadOffsite(localPath, settings, opts.webdavPassword ?? '');
    return { status: { ok: true, at, path: localPath, offsite: 'ok' }, pendingOffsiteFile: null };
  } catch (error) {
    return {
      status: { ok: true, at, path: localPath, offsite: 'failed', error: errMsg(error) },
      pendingOffsiteFile: localPath,
    };
  }
};

// Retries the offsite transfer for a previously-created local backup (startup catch-up).
export const retryOffsite = async (
  filePath: string,
  settings: BackupSettings,
  opts: { webdavPassword?: string } = {},
): Promise<BackupRunResult> => {
  const at = new Date().toISOString();
  if (settings.target === 'local' || !fs.existsSync(filePath)) {
    return { status: { ok: true, at, path: filePath, offsite: 'skipped' }, pendingOffsiteFile: null };
  }
  try {
    await uploadOffsite(filePath, settings, opts.webdavPassword ?? '');
    return { status: { ok: true, at, path: filePath, offsite: 'ok' }, pendingOffsiteFile: null };
  } catch (error) {
    return {
      status: { ok: true, at, path: filePath, offsite: 'failed', error: errMsg(error) },
      pendingOffsiteFile: filePath,
    };
  }
};

// Validates an offsite target configuration without writing a real backup.
export const testTarget = async (
  userDataPath: string,
  settings: BackupSettings,
  opts: { webdavPassword?: string } = {},
): Promise<{ ok: boolean; error?: string }> => {
  try {
    if (settings.target === 'webdav') {
      const w = settings.webdav;
      if (!w?.url?.trim()) throw new Error('WebDAV-URL ist nicht konfiguriert');
      const authHeader =
        'Basic ' + Buffer.from(`${w.username ?? ''}:${opts.webdavPassword ?? ''}`).toString('base64');
      const res = await webdavRequest('PROPFIND', joinUrl(w.url, w.remoteDir ?? ''), {
        Authorization: authHeader,
        Depth: '0',
      });
      if (res.status === 401 || res.status === 403) throw new Error('Authentifizierung fehlgeschlagen');
      if (res.status >= 400 && res.status !== 404) throw new Error(`WebDAV antwortete mit HTTP ${res.status}`);
      return { ok: true };
    }
    if (settings.target === 'rclone') {
      if (!settings.rclone?.remote?.trim()) throw new Error('rclone-Remote ist nicht konfiguriert');
      const bin = settings.rclone.binaryPath?.trim() || 'rclone';
      try {
        await execFileAsync(bin, ['lsd', settings.rclone.remote], { timeout: OFFSITE_TIMEOUT_MS });
      } catch (error) {
        const code = (error as NodeJS.ErrnoException)?.code;
        if (code === 'ENOENT') throw new Error('rclone wurde nicht gefunden');
        throw new Error(errMsg(error));
      }
      return { ok: true };
    }
    // 'local': verify the directory is writable.
    const dir = resolveBackupDir(userDataPath, settings);
    ensureDir(dir);
    const probe = path.join(dir, `.write-test-${Date.now()}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errMsg(error) };
  }
};
