import type Database from 'better-sqlite3';
import type { DunningRunResult, DunningSettings, InvoiceDunningStatus } from '@billme/server-core/domain';
import { shouldRunScheduledDunning } from '@billme/server-core/services';
import { getInvoiceDunningStatus as getSharedInvoiceDunningStatus, processDunningRun as processSharedDunningRun } from '@billme/desktop-data/dunning';
import { getSettings, setSettings } from '../db/settingsRepo';
import { sendEmail } from './emailService';
import { logger } from '../utils/logger';
import { isRetryableEmailError } from '../utils/retry';

const PRODUCT = 'lite' as const;

const createLoggerBridge = () => ({
  debug: (message: string, meta?: Record<string, unknown>) => logger.debug('DunningService', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => logger.info('DunningService', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => logger.warn('DunningService', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => logger.error('DunningService', message, undefined, meta),
});

export { shouldRunScheduledDunning };
export type { DunningRunResult, InvoiceDunningStatus };

export const processDunningRun = async (
  db: Database.Database,
  secrets: {
    get: (key: 'smtp.password' | 'resend.apiKey') => Promise<string | null>;
  },
): Promise<DunningRunResult> => {
  return processSharedDunningRun(db, PRODUCT, {
    getSettings: (database) => getSettings(database) as DunningSettings | null,
    setSettings: (database, settings) => setSettings(database, settings as Parameters<typeof setSettings>[1]),
    secretStore: secrets,
    sendEmail,
    logger: createLoggerBridge(),
    isRetryableError: isRetryableEmailError,
  });
};

export const getInvoiceDunningStatus = (db: Database.Database, invoiceId: string): InvoiceDunningStatus => {
  return getSharedInvoiceDunningStatus(db, PRODUCT, invoiceId);
};
