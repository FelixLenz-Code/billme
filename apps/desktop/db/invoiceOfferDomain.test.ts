import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { Invoice } from '../types';
import { bootstrapSql } from './bootstrap';
import { runMigrations } from './migrate';
import { createInvoiceFromOffer, getInvoice } from './invoicesRepo';
import {
  applyOfferDecision,
  getOffer,
  listOffersPendingPortalSync,
  markOfferPublished,
  publishOfferToPortal,
  syncPublishedOfferDecisionFromPortal,
  upsertOffer,
} from './offersRepo';
import { setSettings } from './settingsRepo';

const createDb = () => {
  const db = new Database(':memory:');
  db.exec(bootstrapSql);
  setSettings(db, {
    company: {
      name: 'Billme',
      owner: 'Owner',
      street: 'Street 1',
      zip: '12345',
      city: 'Berlin',
      email: 'owner@example.com',
      phone: '',
      website: '',
    },
    catalog: { categories: [] },
    finance: {
      bankName: '',
      iban: '',
      bic: '',
      taxId: '',
      vatId: '',
      registerCourt: '',
    },
    numbers: {
      invoicePrefix: 'RE-%Y-',
      nextInvoiceNumber: 1,
      numberLength: 3,
      offerPrefix: 'ANG-%Y-',
      nextOfferNumber: 1,
      customerPrefix: 'KD-',
      nextCustomerNumber: 1,
      customerNumberLength: 4,
    },
    dunning: { levels: [] },
    legal: {
      smallBusinessRule: false,
      defaultVatRate: 19,
      taxAccountingMethod: 'soll',
      paymentTermsDays: 14,
      defaultIntroText: '',
      defaultFooterText: '',
    },
    portal: { baseUrl: 'https://portal.example.test' },
    eInvoice: {
      enabled: false,
      standard: 'zugferd-en16931',
      profile: 'EN16931',
      version: '2.3',
    },
    email: {
      provider: 'none',
      smtpHost: '',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: '',
      fromName: '',
      fromEmail: '',
    },
    automation: {
      dunningEnabled: false,
      dunningRunTime: '09:00',
      recurringEnabled: false,
      recurringRunTime: '03:00',
    },
    dashboard: {
      monthlyRevenueGoal: 0,
      dueSoonDays: 7,
      topCategoriesLimit: 5,
      recentPaymentsLimit: 5,
      topClientsLimit: 5,
    },
  });
  runMigrations(db);
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

const baseOffer: Invoice = {
  id: 'offer-1',
  clientId: 'client-1',
  clientNumber: 'KD-0001',
  projectId: 'project-1',
  number: 'ANG-2025-001',
  client: 'ACME GmbH',
  clientEmail: 'billing@acme.test',
  clientAddress: 'Main Street 1',
  billingAddressJson: { company: 'ACME GmbH', street: 'Main Street 1', zip: '12345', city: 'Berlin' },
  shippingAddressJson: { company: 'ACME GmbH', street: 'Delivery Street 2', zip: '12345', city: 'Berlin' },
  date: '2025-01-10',
  dueDate: '2025-01-24',
  amount: 119,
  status: 'draft' as Invoice['status'],
  items: [
    {
      description: 'Consulting',
      quantity: 1,
      price: 100,
      total: 100,
      articleId: 'article-1',
      category: 'Services',
    },
  ],
  payments: [],
  history: [],
};

describe.skipIf(!canRunNativeSqlite)('invoice/offer shared domain wrappers', () => {
  it('publishes offers, tracks pending sync, and applies portal decisions with audit history', () => {
    const db = createDb();

    upsertOffer(db, { ...baseOffer }, 'initial offer');
    markOfferPublished(db, baseOffer.id, {
      token: 'share-token-1',
      publishedAt: '2025-01-11T10:00:00.000Z',
    });

    expect(listOffersPendingPortalSync(db)).toEqual([{ id: baseOffer.id, shareToken: 'share-token-1' }]);

    applyOfferDecision(db, baseOffer.id, {
      decidedAt: '2025-01-12T08:30:00.000Z',
      decision: 'accepted',
      acceptedName: 'Jane Customer',
      acceptedEmail: 'jane@example.test',
      decisionTextVersion: 'v1',
    });

    const offer = getOffer(db, baseOffer.id);
    expect(offer?.shareToken).toBe('share-token-1');
    expect(offer?.status).toBe('accepted');
    expect(offer?.shareDecision).toBe('accepted');
    expect(offer?.acceptedBy).toBe('Jane Customer');
    expect(offer?.acceptedEmail).toBe('jane@example.test');
    expect(listOffersPendingPortalSync(db)).toEqual([]);
    expect(offer?.history?.map((entry) => entry.action)).toEqual([
      'offer.portal_decision',
      'offer.publish',
      'offer.create (initial offer)',
    ]);
  });

  it('publishes and syncs offers through the shared portal gateway wrappers', async () => {
    const db = createDb();

    upsertOffer(db, { ...baseOffer }, 'initial offer');

    const published = await publishOfferToPortal(db, {
      offerId: baseOffer.id,
      portalGateway: {
        publishOffer: async ({ offer, expiresAt }) => {
          expect(offer.id).toBe(baseOffer.id);
          expect(expiresAt).toBe(baseOffer.dueDate);
          return {
            token: 'share-token-2',
            publicUrl: 'https://portal.example.test/offers/share-token-2',
            publishedAt: '2025-01-11T10:00:00.000Z',
          };
        },
      },
    });

    expect(published.token).toBe('share-token-2');
    expect(published.offer.shareToken).toBe('share-token-2');

    const synced = await syncPublishedOfferDecisionFromPortal(db, {
      offerId: baseOffer.id,
      portalGateway: {
        getOfferStatus: async () => ({
          decision: {
            decidedAt: '2025-01-12T08:30:00.000Z',
            decision: 'accepted',
            acceptedName: 'Jane Customer',
            acceptedEmail: 'jane@example.test',
            decisionTextVersion: 'v1',
          },
        }),
      },
    });

    expect(synced.updated).toBe(true);
    expect(synced.offer.shareDecision).toBe('accepted');
    expect(synced.offer.acceptedBy).toBe('Jane Customer');
  });

  it('creates invoices from offers through the shared domain flow', () => {
    const db = createDb();
    upsertOffer(db, { ...baseOffer }, 'initial offer');

    const invoice = createInvoiceFromOffer(db, baseOffer.id, 'invoice-1');
    const stored = getInvoice(db, invoice.id);

    expect(invoice.id).toBe('invoice-1');
    expect(invoice.client).toBe(baseOffer.client);
    expect(invoice.items).toEqual(baseOffer.items);
    expect(invoice.payments).toEqual([]);
    expect(invoice.status).toBe('draft');
    expect(stored?.number).toBe(invoice.number);
    expect(stored?.history?.[0]?.action).toContain('Converted from offer ANG-2025-001');
  });
});
