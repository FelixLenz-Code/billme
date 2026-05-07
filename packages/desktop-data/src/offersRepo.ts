import type Database from 'better-sqlite3';
import {
  applyOfferDecision as applyDomainOfferDecision,
  deleteOffer as deleteDomainOffer,
  getOffer as getDomainOffer,
  listOffers as listDomainOffers,
  listOffersPendingPortalSync as listPendingPortalOffers,
  publishOffer as publishDomainOffer,
  publishOfferToPortal as publishDomainOfferToPortal,
  syncPublishedOfferDecisionFromPortal as syncDomainOfferDecisionFromPortal,
  syncPublishedOfferDecisions as syncDomainOfferDecisions,
  syncPublishedOfferDecisionsFromPortal as syncDomainOfferDecisionsFromPortal,
  upsertOffer as upsertDomainOffer,
  type OfferPortalStatusSnapshot,
} from '../../server-core/src/services/invoice-offer';
import type { OfferPortalDecisionStatus, OfferPortalGateway, ServerProduct } from '../../server-core/src';
import {
  createBillingScope,
  createSqliteBillingDependencies,
  toDomainOffer,
  toLegacyOffer,
  type LegacyInvoiceDocument,
  withSqliteTransaction,
} from './billingDomainCompat';

export type { LegacyInvoiceDocument } from './billingDomainCompat';

export const listOffers = (db: Database.Database, product: ServerProduct): LegacyInvoiceDocument[] => {
  const scope = createBillingScope(product);
  const dependencies = createSqliteBillingDependencies(db);
  return listDomainOffers(scope, dependencies).map(toLegacyOffer);
};

export const getOffer = (
  db: Database.Database,
  product: ServerProduct,
  id: string,
): LegacyInvoiceDocument | null => {
  const scope = createBillingScope(product);
  const dependencies = createSqliteBillingDependencies(db);
  const offer = getDomainOffer(scope, dependencies, id);
  return offer ? toLegacyOffer(offer) : null;
};

export const upsertOffer = (
  db: Database.Database,
  product: ServerProduct,
  offer: LegacyInvoiceDocument,
  reason: string,
): LegacyInvoiceDocument => {
  const scope = createBillingScope(product);
  return withSqliteTransaction(db, () => {
    const dependencies = createSqliteBillingDependencies(db);
    return toLegacyOffer(
      upsertDomainOffer(scope, dependencies, {
        offer: toDomainOffer(scope, offer),
        reason,
      }),
    );
  });
};

export const deleteOffer = (
  db: Database.Database,
  product: ServerProduct,
  id: string,
  reason: string,
): { ok: true } => {
  const scope = createBillingScope(product);
  return withSqliteTransaction(db, () => {
    const dependencies = createSqliteBillingDependencies(db);
    return deleteDomainOffer(scope, dependencies, { id, reason });
  });
};

export const markOfferPublished = (
  db: Database.Database,
  product: ServerProduct,
  offerId: string,
  params: { token: string; publishedAt?: string },
): LegacyInvoiceDocument => {
  const scope = createBillingScope(product);
  return withSqliteTransaction(db, () => {
    const dependencies = createSqliteBillingDependencies(db);
    return toLegacyOffer(
      publishDomainOffer(scope, dependencies, {
        offerId,
        token: params.token,
        publishedAt: params.publishedAt,
      }),
    );
  });
};

export const publishOfferToPortal = async (
  db: Database.Database,
  product: ServerProduct,
  params: {
    offerId: string;
    expiresAt?: string;
    portalGateway: Pick<OfferPortalGateway, 'publishOffer'>;
  },
): Promise<{
  offer: LegacyInvoiceDocument;
  token: string;
  publicUrl: string;
  publishedAt: string;
}> => {
  const scope = createBillingScope(product);
  const dependencies = createSqliteBillingDependencies(db);
  const result = await publishDomainOfferToPortal(scope, {
    ...dependencies,
    portalGateway: params.portalGateway,
  }, {
    offerId: params.offerId,
    expiresAt: params.expiresAt,
  });

  return {
    ...result,
    offer: toLegacyOffer(result.offer),
  };
};

export const applyOfferDecision = (
  db: Database.Database,
  product: ServerProduct,
  offerId: string,
  params: {
    decidedAt: string;
    decision: 'accepted' | 'declined';
    acceptedName: string;
    acceptedEmail: string;
    decisionTextVersion: string;
    acceptedUserAgent?: string;
  },
): LegacyInvoiceDocument => {
  const scope = createBillingScope(product);
  return withSqliteTransaction(db, () => {
    const dependencies = createSqliteBillingDependencies(db);
    return toLegacyOffer(
      applyDomainOfferDecision(scope, dependencies, {
        offerId,
        decidedAt: params.decidedAt,
        decision: params.decision,
        acceptedName: params.acceptedName,
        acceptedEmail: params.acceptedEmail,
        decisionTextVersion: params.decisionTextVersion,
        acceptedUserAgent: params.acceptedUserAgent,
      }),
    );
  });
};

export const syncPublishedOfferDecisionFromPortal = async (
  db: Database.Database,
  product: ServerProduct,
  params: {
    offerId: string;
    portalGateway: Pick<OfferPortalGateway, 'getOfferStatus'>;
  },
): Promise<{
  offer: LegacyInvoiceDocument;
  decision: OfferPortalDecisionStatus | null;
  updated: boolean;
}> => {
  const scope = createBillingScope(product);
  const dependencies = createSqliteBillingDependencies(db);
  const result = await syncDomainOfferDecisionFromPortal(scope, {
    ...dependencies,
    portalGateway: params.portalGateway,
  }, {
    offerId: params.offerId,
  });

  return {
    ...result,
    offer: toLegacyOffer(result.offer),
  };
};

export const listOffersPendingPortalSync = (
  db: Database.Database,
  product: ServerProduct,
): Array<{ id: string; shareToken: string }> => {
  const scope = createBillingScope(product);
  const dependencies = createSqliteBillingDependencies(db);
  return listPendingPortalOffers(scope, dependencies);
};

export const syncPublishedOfferDecisions = async (
  db: Database.Database,
  product: ServerProduct,
  params: {
    getOfferStatus(shareToken: string): Promise<OfferPortalStatusSnapshot>;
    logger?: Pick<Console, 'warn'>;
    onDecisionApplied?(offer: LegacyInvoiceDocument, status: NonNullable<OfferPortalStatusSnapshot['decision']>): void;
  },
): Promise<number> => {
  const scope = createBillingScope(product);
  const dependencies = createSqliteBillingDependencies(db);
  return syncDomainOfferDecisions(scope, dependencies, {
    getOfferStatus: params.getOfferStatus,
    logger: params.logger,
    onDecisionApplied: params.onDecisionApplied
      ? ({ offer, decision }) => {
          params.onDecisionApplied?.(toLegacyOffer(offer), decision);
        }
      : undefined,
  });
};

export const syncPublishedOfferDecisionsFromPortal = async (
  db: Database.Database,
  product: ServerProduct,
  params: {
    portalGateway: Pick<OfferPortalGateway, 'getOfferStatus'>;
    logger?: Pick<Console, 'warn'>;
    onDecisionApplied?(offer: LegacyInvoiceDocument, status: OfferPortalDecisionStatus): void;
  },
): Promise<number> => {
  const scope = createBillingScope(product);
  const dependencies = createSqliteBillingDependencies(db);
  return syncDomainOfferDecisionsFromPortal(scope, {
    ...dependencies,
    portalGateway: params.portalGateway,
  }, {
    logger: params.logger,
    onDecisionApplied: params.onDecisionApplied
      ? ({ offer, decision }) => {
          params.onDecisionApplied?.(toLegacyOffer(offer), decision);
        }
      : undefined,
  });
};
