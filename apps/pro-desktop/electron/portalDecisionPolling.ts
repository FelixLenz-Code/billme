import type Database from 'better-sqlite3';
import { portalClient } from '../services/portalClient';
import { syncPublishedOfferDecisionsFromPortal } from '../db/offersRepo';
import { getSettings } from '../db/settingsRepo';
import { pushNotification } from './notifications';

type DbProvider = () => Database.Database;

export const startPortalDecisionPolling = (params: {
  requireDb: DbProvider;
  intervalMs?: number;
  logger?: Pick<Console, 'warn' | 'error'>;
}) => {
  const intervalMs = params.intervalMs ?? 60_000;
  const logger = params.logger ?? console;

  let inFlight = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const db = params.requireDb();
      const settings = getSettings(db);
      const baseUrl = settings?.portal?.baseUrl?.trim();
      if (!baseUrl) return;

      await syncPublishedOfferDecisionsFromPortal(db, {
        portalGateway: {
          getOfferStatus: (shareToken) => portalClient.getOfferStatus(baseUrl, shareToken),
        },
        logger,
        onDecisionApplied: (_offer, decision) => {
          pushNotification({
            type: 'portal',
            title: decision.decision === 'accepted' ? 'Angebot angenommen' : 'Angebot abgelehnt',
            message: `Ein Angebot wurde ${decision.decision === 'accepted' ? 'vom Kunden angenommen' : 'abgelehnt'}${decision.acceptedName ? ` (${decision.acceptedName})` : ''}`,
          });
        },
      });
    } catch (e) {
      logger.error('[portal-sync] tick failed', e);
    } finally {
      inFlight = false;
    }
  };

  void tick();
  timer = setInterval(() => void tick(), intervalMs);

  return {
    stop: () => {
      if (timer) clearInterval(timer);
      timer = null;
    },
    tick,
  };
};
