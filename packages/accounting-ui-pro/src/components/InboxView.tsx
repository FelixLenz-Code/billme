import { useEffect, useMemo, useState } from 'react';
import { Filter, Inbox, Eye, Play, CheckCircle2, CheckSquare, Wand2, FileText, Upload, ChevronDown, ChevronRight } from 'lucide-react';
import { getQueueCounts, getStatusPresentation, InboxQueueKey, txMatchesQueue } from '../domain/selectors';
import { normalizeTaxCaseKey, TAX_CASE_OPTIONS, toLegacyTaxCode } from '../domain/taxCases';
import { getAllowedActions } from '../domain/workflow';
import { mockAccounts } from '../mocks/accounts';
import { permissionContextForRole } from '../mocks/users';
import {
  dispatchBookingAction,
  getBookingDraftByTransactionId,
  saveDraft,
  setTransactionReceiptStatus,
} from '../services/mockBookingStore';
import AccountCombobox from './AccountCombobox';
import { BookingAction, Transaction, UserRole } from '../types';
import InboxQueueTabs from './InboxQueueTabs';
import IssueBadges from './IssueBadges';

interface InboxViewProps {
  role: UserRole;
  transactions: Transaction[];
  onOpenTransaction: (transactionId: string) => void;
  onRefresh: () => void;
  forcedPreviewTransactionId?: string | null;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount);
}

function nextActionLabel(action: BookingAction | undefined) {
  switch (action) {
    case 'approve':
      return 'Freigeben';
    case 'post':
      return 'Buchen';
    case 'submit_for_review':
      return 'Einreichen';
    default:
      return 'Bearbeiten';
  }
}

export default function InboxView({
  role,
  transactions,
  onOpenTransaction,
  onRefresh,
  forcedPreviewTransactionId,
}: InboxViewProps) {
  const [activeQueue, setActiveQueue] = useState<InboxQueueKey>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchMessage, setBatchMessage] = useState<string>('');
  const [batchAccountSelection, setBatchAccountSelection] = useState<{ id: string; name: string } | null>(null);
  const [bookingTextEdits, setBookingTextEdits] = useState<Record<string, string>>({});
  const [expandedInlineRows, setExpandedInlineRows] = useState<string[]>([]);

  const permissionCtx = permissionContextForRole(role);
  const queueCounts = useMemo(() => getQueueCounts(transactions), [transactions]);
  const filtered = useMemo(
    () => transactions.filter((tx) => txMatchesQueue(tx, activeQueue)),
    [transactions, activeQueue],
  );

  const previewTx = previewId ? filtered.find((tx) => tx.id === previewId) ?? null : null;
  const previewDraft = previewTx ? getBookingDraftByTransactionId(previewTx.id) : undefined;
  const selectedSet = new Set(selectedIds);
  const allVisibleSelected = filtered.length > 0 && filtered.every((tx) => selectedSet.has(tx.id));

  useEffect(() => {
    if (!forcedPreviewTransactionId) return;
    setPreviewId(forcedPreviewTransactionId);
  }, [forcedPreviewTransactionId]);

  const toggleRowSelection = (txId: string) => {
    setSelectedIds((prev) => (prev.includes(txId) ? prev.filter((id) => id !== txId) : [...prev, txId]));
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const prevSet = new Set(prev);
      if (filtered.length > 0 && filtered.every((tx) => prevSet.has(tx.id))) {
        return prev.filter((id) => !filtered.some((tx) => tx.id === id));
      }
      const merged = new Set(prev);
      filtered.forEach((tx) => merged.add(tx.id));
      return Array.from(merged);
    });
  };

  const selectSimilarToPreview = () => {
    if (!previewTx) return;
    const similar = filtered.filter(
      (tx) =>
        tx.id !== previewTx.id &&
        tx.amount * previewTx.amount > 0 &&
        (tx.payee === previewTx.payee || tx.suggestion === previewTx.suggestion),
    );
    setSelectedIds([previewTx.id, ...similar.map((tx) => tx.id)]);
  };

  const handleInlineAction = (tx: Transaction) => {
    const draft = getBookingDraftByTransactionId(tx.id);
    if (!draft) return;
    const allowed = getAllowedActions(draft.workflowStatus, permissionCtx, draft.validationIssues);
    const primary = allowed.find((a) => ['approve', 'post', 'submit_for_review'].includes(a));
    if (!primary) {
      onOpenTransaction(tx.id);
      return;
    }

    try {
      dispatchBookingAction(tx.id, primary, { role, actorName: role });
      onRefresh();
    } catch {
      onOpenTransaction(tx.id);
    }
  };

  const runBatchAction = (preferredAction: BookingAction) => {
    const ids = filtered.filter((tx) => selectedSet.has(tx.id)).map((tx) => tx.id);
    if (ids.length === 0) return;

    let success = 0;
    let skipped = 0;

    ids.forEach((id) => {
      const draft = getBookingDraftByTransactionId(id);
      if (!draft) {
        skipped += 1;
        return;
      }
      const allowed = getAllowedActions(draft.workflowStatus, permissionCtx, draft.validationIssues);
      if (!allowed.includes(preferredAction)) {
        skipped += 1;
        return;
      }
      try {
        dispatchBookingAction(id, preferredAction, { role, actorName: role });
        success += 1;
      } catch {
        skipped += 1;
      }
    });

    setBatchMessage(`Sammelaktion '${preferredAction}': ${success} erfolgreich, ${skipped} übersprungen.`);
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    onRefresh();
  };

  const assignBatchAccount = () => {
    if (!batchAccountSelection) {
      setBatchMessage('Bitte wählen Sie zuerst ein Konto für die Sammelzuweisung.');
      return;
    }

    const ids = filtered.filter((tx) => selectedSet.has(tx.id)).map((tx) => tx.id);
    if (ids.length === 0) return;

    const account = mockAccounts.find((acc) => acc.number === batchAccountSelection.id);
    if (!account) {
      setBatchMessage('Gewähltes Konto wurde nicht gefunden.');
      return;
    }

    let success = 0;
    let skipped = 0;
    ids.forEach((id) => {
      const draft = getBookingDraftByTransactionId(id);
      if (!draft || ['posted', 'reversed'].includes(draft.workflowStatus)) {
        skipped += 1;
        return;
      }
      try {
        const nextLines = [...draft.lines];
        const targetIndex = nextLines.findIndex((line) => line.accountId !== '1200');
        const fallbackIndex = nextLines.findIndex((line) => line.accountId === '');
        const index = targetIndex >= 0 ? targetIndex : fallbackIndex >= 0 ? fallbackIndex : 0;
        if (index < 0) {
          skipped += 1;
          return;
        }
        nextLines[index] = {
          ...nextLines[index],
          accountId: account.number,
          accountName: account.name,
          taxCaseKey: normalizeTaxCaseKey(nextLines[index].taxCaseKey ?? nextLines[index].taxCode ?? account.defaultTaxCode),
          taxCode:
            toLegacyTaxCode(normalizeTaxCaseKey(nextLines[index].taxCaseKey ?? nextLines[index].taxCode ?? account.defaultTaxCode))
            ?? nextLines[index].taxCode
            ?? account.defaultTaxCode
            ?? '',
        };
        saveDraft({ ...draft, lines: nextLines }, role);
        success += 1;
      } catch {
        skipped += 1;
      }
    });

    setBatchMessage(`Sammel-Kontozuweisung (${account.number}): ${success} aktualisiert, ${skipped} übersprungen.`);
    onRefresh();
  };

  const updateInboxAccount = (txId: string, accountNumber: string, accountName: string, defaultTaxCode?: string) => {
    const draft = getBookingDraftByTransactionId(txId);
    if (!draft) return;

    const nextLines = [...draft.lines];
    const targetIndex = nextLines.findIndex((line) => line.accountId !== '1200');
    const fallbackIndex = nextLines.findIndex((line) => line.accountId === '');
    const index = targetIndex >= 0 ? targetIndex : fallbackIndex >= 0 ? fallbackIndex : 0;
    if (index < 0) return;

    nextLines[index] = {
      ...nextLines[index],
      accountId: accountNumber,
      accountName,
      taxCaseKey: normalizeTaxCaseKey(nextLines[index].taxCaseKey ?? nextLines[index].taxCode ?? defaultTaxCode),
      taxCode:
        toLegacyTaxCode(normalizeTaxCaseKey(nextLines[index].taxCaseKey ?? nextLines[index].taxCode ?? defaultTaxCode))
        ?? nextLines[index].taxCode
        ?? defaultTaxCode
        ?? '',
    };

    saveDraft({ ...draft, lines: nextLines }, role);
    onRefresh();
  };

  const updateInboxTaxCase = (txId: string, taxCaseValue: string) => {
    const draft = getBookingDraftByTransactionId(txId);
    if (!draft) return;

    const nextLines = [...draft.lines];
    const targetIndex = nextLines.findIndex((line) => line.accountId !== '1200');
    const fallbackIndex = nextLines.findIndex((line) => line.accountId === '');
    const index = targetIndex >= 0 ? targetIndex : fallbackIndex >= 0 ? fallbackIndex : 0;
    if (index < 0) return;

    const taxCaseKey = normalizeTaxCaseKey(taxCaseValue);
    nextLines[index] = {
      ...nextLines[index],
      taxCaseKey,
      taxCode: toLegacyTaxCode(taxCaseKey) ?? (taxCaseKey ?? ''),
    };

    saveDraft({ ...draft, lines: nextLines }, role);
    onRefresh();
  };

  const commitInboxBookingText = (txId: string) => {
    const draft = getBookingDraftByTransactionId(txId);
    if (!draft) return;
    const edited = bookingTextEdits[txId];
    if (edited === undefined || edited === draft.bookingText) return;
    saveDraft({ ...draft, bookingText: edited }, role);
    onRefresh();
  };

  const updateReceiptInline = (txId: string, hasReceipt: boolean) => {
    setTransactionReceiptStatus(txId, hasReceipt, role);
    onRefresh();
  };

  const updateInboxDates = (txId: string, patch: { postingDate?: string; documentDate?: string }) => {
    const draft = getBookingDraftByTransactionId(txId);
    if (!draft) return;
    saveDraft(
      {
        ...draft,
        postingDate: patch.postingDate ?? draft.postingDate,
        documentDate: patch.documentDate ?? draft.documentDate,
      },
      role,
    );
    onRefresh();
  };

  const toggleInlineRowExpanded = (txId: string) => {
    setExpandedInlineRows((prev) => (prev.includes(txId) ? prev.filter((id) => id !== txId) : [...prev, txId]));
  };

  return (
    <div className="flex h-full">
      <div className="flex flex-col h-full flex-1 min-w-0 border-r border-gray-100">
        <div className="p-6 border-b border-gray-100 shrink-0 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-[#ccff00]">
                <Inbox size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Buchungs-Inbox</h1>
                <p className="text-gray-500 text-sm mt-0.5 font-medium">
                  Workflow-Queues, Validierungen und Freigaben (Mockup mit Prozesslogik).
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button className="h-10 flex items-center space-x-2 px-4 bg-white border border-gray-200 rounded-full text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                <Filter size={16} />
                <span>Filter</span>
              </button>
              <button className="h-10 px-5 bg-black rounded-full text-sm font-bold text-white shadow-sm hover:bg-gray-900 transition-colors">
                Bankabgleich (n/a)
              </button>
            </div>
          </div>

          <InboxQueueTabs activeQueue={activeQueue} counts={queueCounts} onChange={setActiveQueue} />

          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleSelectAllVisible}
              className="h-9 px-3 rounded-full border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1 transition-colors"
            >
              <CheckSquare size={13} />
              {allVisibleSelected ? 'Auswahl aufheben' : 'Sichtbare markieren'}
            </button>
            <button
              onClick={selectSimilarToPreview}
              disabled={!previewTx}
              className="h-9 px-3 rounded-full border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1 transition-colors"
            >
              <Wand2 size={13} />
              Ähnliche markieren
            </button>
          </div>

          {selectedIds.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium text-gray-700">
                <span className="font-bold">{selectedIds.length}</span> Vorgänge markiert für Sammelverarbeitung
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="min-w-[16rem] max-w-[18rem]">
                  <AccountCombobox
                    accounts={mockAccounts}
                    valueAccountId={batchAccountSelection?.id ?? ''}
                    valueAccountName={batchAccountSelection?.name ?? ''}
                    placeholder="Sammel-Konto wählen..."
                    onSelect={(account) => setBatchAccountSelection({ id: account.number, name: account.name })}
                  />
                </div>
                <button
                  onClick={assignBatchAccount}
                  className="h-9 px-3 rounded-full border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Konto zuweisen
                </button>
                <button
                  onClick={() => runBatchAction('request_receipt')}
                  className="h-9 px-3 rounded-full border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Beleg anfordern
                </button>
                <button
                  onClick={() => runBatchAction('submit_for_review')}
                  className="h-9 px-3 rounded-full border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Zur Prüfung
                </button>
                <button
                  onClick={() => runBatchAction('approve')}
                  className="h-9 px-3 rounded-full border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Freigeben
                </button>
                <button
                  onClick={() => runBatchAction('post')}
                  className="h-9 px-3 rounded-full bg-black text-white text-xs font-bold hover:bg-gray-900 transition-colors"
                >
                  Sammel-Buchen
                </button>
              </div>
            </div>
          )}

          {batchMessage && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
              {batchMessage}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-gray-400 font-bold border-b border-gray-100">
                <th scope="col" className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label="Alle sichtbaren Vorgänge markieren"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="rounded border-gray-300"
                  />
                </th>
                <th scope="col" className="px-3 py-3 w-[128px]">Workflow</th>
                <th scope="col" className="px-3 py-3 w-[108px]">Datum</th>
                <th scope="col" className="px-3 py-3 w-[180px]">Empfänger / Absender</th>
                <th scope="col" className="px-3 py-3 w-[360px]">Transaktionsdetails & Text</th>
                <th scope="col" className="px-3 py-3 w-[400px]">Schnellbuchung (Inline)</th>
                <th scope="col" className="px-3 py-3 w-[130px] text-right">Betrag</th>
                <th scope="col" className="px-3 py-3 w-[150px] text-right">Issues</th>
                <th scope="col" className="px-3 py-3 w-[140px] text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12">
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                      <div className="text-sm font-bold text-gray-700">Keine Vorgänge in dieser Queue</div>
                      <div className="mt-1 text-sm text-gray-500">Passe Filter oder Queue an, um Vorgänge anzuzeigen.</div>
                    </div>
                  </td>
                </tr>
              ) : null}
              {filtered.map((tx) => {
                const draft = getBookingDraftByTransactionId(tx.id);
                const allowed = draft ? getAllowedActions(draft.workflowStatus, permissionCtx, draft.validationIssues) : [];
                const status = getStatusPresentation(tx.workflowStatus);
                const primary = allowed.find((a) => ['approve', 'post', 'submit_for_review'].includes(a));
                const counterLine = draft?.lines.find((line) => line.accountId !== '1200') ?? draft?.lines[0];
                const accountEditable = !!draft && !['posted', 'reversed'].includes(draft.workflowStatus);
                const inlineIssues = draft?.validationIssues.slice(0, 3) ?? [];
                const isExpanded = expandedInlineRows.includes(tx.id);
                const blockerCount = draft?.validationIssues.filter((issue) => issue.blocking).length ?? 0;
                const warningCount = draft?.validationIssues.filter((issue) => issue.severity === 'warning').length ?? 0;
                const isSelectedPreview = previewTx?.id === tx.id;
                const hasUnsavedTextEdit =
                  bookingTextEdits[tx.id] !== undefined && bookingTextEdits[tx.id] !== (draft?.bookingText ?? '');
                const readiness =
                  !draft
                    ? { label: 'Kein Entwurf', className: 'bg-gray-100 text-gray-600' }
                    : blockerCount > 0
                      ? { label: `Blockiert (${blockerCount})`, className: 'bg-red-100 text-red-700' }
                      : warningCount > 0
                        ? { label: `Prüfbar (${warningCount} Warn.)`, className: 'bg-amber-100 text-amber-700' }
                        : { label: 'Bereit zum Buchen', className: 'bg-emerald-100 text-emerald-700' };

                return (
                  <tr
                    key={tx.id}
                    className={`hover:bg-gray-50/60 transition-colors cursor-pointer ${
                      isSelectedPreview ? 'bg-gray-50/90 shadow-[inset_3px_0_0_0_#111827]' : ''
                    } ${
                      blockerCount > 0 ? 'shadow-[inset_1px_0_0_0_#fecaca]' : ''
                    }`}
                    onClick={() => setPreviewId((current) => (current === tx.id ? null : tx.id))}
                  >
                    <td className="px-3 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`${tx.payee} markieren`}
                        checked={selectedSet.has(tx.id)}
                        onChange={() => toggleRowSelection(tx.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap align-top">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 font-medium align-top">
                      {new Date(tx.date).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-gray-900 align-top">{tx.payee}</td>
                    <td className="px-3 py-4 align-top min-w-[20rem]">
                      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 space-y-3">
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Verwendungszweck</div>
                          <div className="text-sm text-gray-700 leading-snug line-clamp-3">{tx.description}</div>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
                            Buchungstext
                          </label>
                          <input
                            type="text"
                            value={bookingTextEdits[tx.id] ?? draft?.bookingText ?? ''}
                            disabled={!draft || !accountEditable}
                            onChange={(e) =>
                              setBookingTextEdits((prev) => ({
                                ...prev,
                                [tx.id]: e.target.value,
                              }))
                            }
                            onBlur={() => commitInboxBookingText(tx.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            placeholder="Buchungstext direkt in Inbox"
                            className={`h-10 w-full border rounded-xl px-3 py-2 text-sm bg-white disabled:bg-gray-50 ${
                              hasUnsavedTextEdit ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'
                            }`}
                          />
                          {hasUnsavedTextEdit ? (
                            <div className="mt-1 text-[11px] font-medium text-amber-700">Ungespeichert – Enter oder Fokuswechsel speichert.</div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 align-top min-w-[22rem]" onClick={(e) => e.stopPropagation()}>
                      {draft ? (
                        <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
                              Konto
                            </label>
                            <AccountCombobox
                              accounts={mockAccounts}
                              valueAccountId={counterLine?.accountId ?? ''}
                              valueAccountName={counterLine?.accountName ?? ''}
                              disabled={!accountEditable}
                              placeholder="Konto (Inbox)"
                              onSelect={(account) =>
                                updateInboxAccount(tx.id, account.number, account.name, account.defaultTaxCode)
                              }
                            />
                          </div>

                          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
                                Steuerfall
                              </label>
                              <select
                                aria-label={`${tx.payee} Steuerschlüssel`}
                                value={normalizeTaxCaseKey(counterLine?.taxCaseKey ?? counterLine?.taxCode) ?? ''}
                                disabled={!accountEditable}
                                onChange={(e) => updateInboxTaxCase(tx.id, e.target.value)}
                                className="h-10 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white disabled:bg-gray-50"
                              >
                                <option value="">Keine</option>
                                {TAX_CASE_OPTIONS.map((option) => (
                                  <option key={option.key} value={option.key}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
                                Beleg
                              </label>
                              {tx.hasReceipt ? (
                                <button
                                  onClick={() => updateReceiptInline(tx.id, false)}
                                  disabled={!accountEditable}
                                  className="h-10 min-w-[112px] px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                                >
                                  <FileText size={13} />
                                  Vorhanden
                                </button>
                              ) : (
                                <button
                                  onClick={() => updateReceiptInline(tx.id, true)}
                                  disabled={!accountEditable}
                                  className="h-10 min-w-[112px] px-3 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                                >
                                  <Upload size={13} />
                                  Hinzufügen
                                </button>
                              )}
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
                                  Buchungsdatum
                                </label>
                                <input
                                  type="date"
                                  value={draft.postingDate ?? ''}
                                  disabled={!accountEditable}
                                  onChange={(e) => updateInboxDates(tx.id, { postingDate: e.target.value })}
                                  className="h-10 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white disabled:bg-gray-50"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
                                  Belegdatum
                                </label>
                                <input
                                  type="date"
                                  value={draft.documentDate ?? ''}
                                  disabled={!accountEditable}
                                  onChange={(e) => updateInboxDates(tx.id, { documentDate: e.target.value })}
                                  className="h-10 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white disabled:bg-gray-50"
                                />
                              </div>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                              Schnellbuchung
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${readiness.className}`}>
                                {readiness.label}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleInlineRowExpanded(tx.id)}
                                className="h-7 px-2 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide"
                                aria-label={isExpanded ? 'Inline-Schnellbuchung einklappen' : 'Inline-Schnellbuchung ausklappen'}
                              >
                                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                {isExpanded ? 'Weniger' : 'Mehr'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                      {inlineIssues.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {inlineIssues.map((issue) => (
                            <span
                              key={issue.id}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                issue.severity === 'error'
                                  ? 'bg-red-100 text-red-700'
                                  : issue.severity === 'warning'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-700'
                              }`}
                              title={issue.message}
                            >
                              {issue.code}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={`px-3 py-4 whitespace-nowrap text-sm font-bold text-right align-top ${tx.amount < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {formatCurrency(tx.amount, tx.currency)}
                    </td>
                    <td className="px-3 py-4 text-right align-top">
                      <div className="flex flex-col items-end gap-2 pt-0.5">
                        <IssueBadges transaction={tx} />
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-right align-top">
                      <div className="flex flex-col items-end gap-2 mt-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenTransaction(tx.id);
                          }}
                          className="w-[122px] h-9 px-3 rounded-full border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 text-center transition-colors"
                        >
                          {tx.workflowStatus === 'posted' ? 'Ansehen' : 'Bearbeiten'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInlineAction(tx);
                          }}
                          className="w-[122px] h-9 px-3 rounded-full bg-black text-white text-sm font-bold hover:bg-gray-900 text-center transition-colors"
                        >
                          {nextActionLabel(primary)}
                        </button>
                        {draft && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleInlineRowExpanded(tx.id);
                            }}
                            className="w-[122px] h-8 px-3 rounded-full border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 inline-flex items-center justify-center gap-1 transition-colors"
                          >
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {isExpanded ? 'Kompakt' : 'Erweitern'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <aside
        className={`hidden xl:flex shrink-0 bg-gray-50/50 border-l border-gray-100 flex-col gap-4 overflow-hidden transition-all duration-300 ${
          previewTx ? 'w-[24rem] p-6 opacity-100 translate-x-0' : 'w-0 p-0 opacity-0 translate-x-4 pointer-events-none'
        }`}
        aria-hidden={!previewTx}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Quick Preview</h2>
          {previewTx && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewId(null)}
                className="text-xs font-bold text-gray-500 hover:text-gray-800"
              >
                Schließen
              </button>
              <button
                onClick={() => onOpenTransaction(previewTx.id)}
                className="text-sm font-bold text-black hover:underline inline-flex items-center gap-1"
              >
                <Eye size={14} />
                Öffnen
              </button>
            </div>
          )}
        </div>

        {!previewTx || !previewDraft ? (
          <div className="border border-gray-200 rounded-xl bg-white p-4 text-sm text-gray-500">
            Keine Transaktion in der aktuellen Queue.
          </div>
        ) : (
          <>
            <div className="border border-gray-200 rounded-xl bg-white p-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
                {getStatusPresentation(previewTx.workflowStatus).label}
              </div>
              <div>
                <div className="font-bold text-gray-900">{previewTx.payee}</div>
                <div className="text-sm text-gray-500">{previewTx.description}</div>
              </div>
              <div className={`text-xl font-bold ${previewTx.amount < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {formatCurrency(previewTx.amount, previewTx.currency)}
              </div>
              <div className="text-sm text-gray-600">
                Vorschlag: <span className="font-medium">{previewTx.suggestion ?? 'Kein Vorschlag'}</span>
                {typeof previewTx.suggestionConfidence === 'number' && (
                  <span className="ml-2 text-xs text-gray-400">
                    ({Math.round(previewTx.suggestionConfidence * 100)}%)
                  </span>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl bg-white p-4">
              <div className="text-sm font-bold text-gray-800 mb-2">Top-Probleme</div>
              {previewDraft.validationIssues.slice(0, 4).length === 0 ? (
                <div className="text-sm text-emerald-700">Keine offenen Validierungsprobleme.</div>
              ) : (
                <ul className="space-y-2">
                  {previewDraft.validationIssues.slice(0, 4).map((issue) => (
                    <li key={issue.id} className="text-sm text-gray-700">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${issue.severity === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              onClick={() => handleInlineAction(previewTx)}
              className="w-full px-4 py-3 rounded-xl bg-black text-white font-bold hover:bg-gray-900 inline-flex items-center justify-center gap-2"
            >
              {previewDraft.workflowStatus === 'pending_approval' ? <CheckCircle2 size={16} /> : <Play size={16} />}
              <span>Primäraktion ausführen</span>
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
