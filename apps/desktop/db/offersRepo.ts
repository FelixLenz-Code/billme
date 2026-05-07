import type Database from 'better-sqlite3';
import type { Invoice } from '../types';
import {
  applyOfferDecision as applySharedOfferDecision,
  deleteOffer as deleteSharedOffer,
  getOffer as getSharedOffer,
  listOffers as listSharedOffers,
  listOffersPendingPortalSync as listSharedPendingOffers,
  markOfferPublished as markSharedOfferPublished,
  publishOfferToPortal as publishSharedOfferToPortal,
  syncPublishedOfferDecisionFromPortal as syncSharedOfferDecisionFromPortal,
  syncPublishedOfferDecisions as syncSharedOfferDecisions,
  syncPublishedOfferDecisionsFromPortal as syncSharedOfferDecisionsFromPortal,
  upsertOffer as upsertSharedOffer,
} from '@billme/desktop-data/offersRepo';
import type { OfferPortalDecisionStatus, OfferPortalGateway } from '@billme/server-core';

const PRODUCT = 'lite' as const;

export const listOffers = (db: Database.Database): Invoice[] => {
  return listSharedOffers(db, PRODUCT) as Invoice[];
};

export const getOffer = (db: Database.Database, id: string): Invoice | null => {
  return getSharedOffer(db, PRODUCT, id) as Invoice | null;
};

export const upsertOffer = (
  db: Database.Database,
  offer: Invoice,
  reason: string,
): Invoice => {
  return upsertSharedOffer(db, PRODUCT, offer, reason) as Invoice;
};

export const deleteOffer = (db: Database.Database, id: string, reason: string) => {
  return deleteSharedOffer(db, PRODUCT, id, reason);
};

export const markOfferPublished = (
  db: Database.Database,
  offerId: string,
  params: { token: string; publishedAt?: string },
): Invoice => {
  return markSharedOfferPublished(db, PRODUCT, offerId, params) as Invoice;
};

export const publishOfferToPortal = (
  db: Database.Database,
  params: {
    offerId: string;
    expiresAt?: string;
    portalGateway: Pick<OfferPortalGateway, 'publishOffer'>;
  },
): Promise<{
  offer: Invoice;
  token: string;
  publicUrl: string;
  publishedAt: string;
}> => {
  return publishSharedOfferToPortal(db, PRODUCT, params).then((result) => ({
    ...result,
    offer: result.offer as Invoice,
  }));
};

export const applyOfferDecision = (
  db: Database.Database,
  offerId: string,
  params: {
    decidedAt: string;
    decision: 'accepted' | 'declined';
    acceptedName: string;
    acceptedEmail: string;
    decisionTextVersion: string;
    acceptedUserAgent?: string;
  },
): Invoice => {
  return applySharedOfferDecision(db, PRODUCT, offerId, params) as Invoice;
};

export const syncPublishedOfferDecisionFromPortal = (
  db: Database.Database,
  params: {
    offerId: string;
    portalGateway: Pick<OfferPortalGateway, 'getOfferStatus'>;
  },
): Promise<{
  offer: Invoice;
  decision: OfferPortalDecisionStatus | null;
  updated: boolean;
}> => {
  return syncSharedOfferDecisionFromPortal(db, PRODUCT, params).then((result) => ({
    ...result,
    offer: result.offer as Invoice,
  }));
};

export const listOffersPendingPortalSync = (
  db: Database.Database,
): Array<{ id: string; shareToken: string }> => {
  return listSharedPendingOffers(db, PRODUCT);
};

export const syncPublishedOfferDecisions = (
  db: Database.Database,
  params: {
    getOfferStatus(shareToken: string): Promise<{
      decision?:
        | {
            decidedAt: string;
            decision: 'accepted' | 'declined';
            acceptedName: string;
            acceptedEmail: string;
            decisionTextVersion: string;
            acceptedUserAgent?: string;
          }
        | null;
    }>;
    logger?: Pick<Console, 'warn'>;
    onDecisionApplied?(offer: Invoice, decision: {
      decidedAt: string;
      decision: 'accepted' | 'declined';
      acceptedName: string;
      acceptedEmail: string;
      decisionTextVersion: string;
      acceptedUserAgent?: string;
    }): void;
  },
): Promise<number> => {
  return syncSharedOfferDecisions(db, PRODUCT, {
    ...params,
    onDecisionApplied: params.onDecisionApplied
      ? (offer, decision) => {
          params.onDecisionApplied?.(offer as Invoice, decision);
        }
      : undefined,
  });
};

export const syncPublishedOfferDecisionsFromPortal = (
  db: Database.Database,
  params: {
    portalGateway: Pick<OfferPortalGateway, 'getOfferStatus'>;
    logger?: Pick<Console, 'warn'>;
    onDecisionApplied?(offer: Invoice, decision: OfferPortalDecisionStatus): void;
  },
): Promise<number> => {
  return syncSharedOfferDecisionsFromPortal(db, PRODUCT, {
    ...params,
    onDecisionApplied: params.onDecisionApplied
      ? (offer, decision) => {
          params.onDecisionApplied?.(offer as Invoice, decision);
        }
      : undefined,
  });
};
