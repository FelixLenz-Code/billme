import { useCallback, useEffect, useMemo, useState } from 'react';
import InboxView from './components/InboxView';
import BookingEditor from './components/BookingEditor';
import ReconciliationWorkbench from './components/ReconciliationWorkbench';
import ExceptionCenter from './components/ExceptionCenter';
import AssetManagementView from './components/AssetManagementView';
import ReportsView from './components/ReportsView';
import {
  configureStoreAdapter,
  configureStorePersistence,
  hydrateMockStore,
  listTransactions,
  type ProAccountingDataAdapter,
} from './services/mockBookingStore';
import { Account, BookingDraft, Transaction, UserRole } from './types';

type AppView = 'inbox' | 'editor' | 'reconciliation' | 'exceptions' | 'assets' | 'reports';

export interface ProAccountingSeed {
  transactions?: Transaction[];
  accounts?: Account[];
  drafts?: BookingDraft[];
  chartFramework?: 'SKR03' | 'SKR04';
  seedVersion?: string | number;
}

export interface ProAccountingWorkspaceProps {
  seed?: ProAccountingSeed;
  dataAdapter?: ProAccountingDataAdapter;
  onPersistEntry?: (entry: { transaction: Transaction; draft: BookingDraft }) => void | Promise<void>;
}

export default function App({ seed, dataAdapter, onPersistEntry }: ProAccountingWorkspaceProps) {
  const [currentView, setCurrentView] = useState<AppView>('inbox');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [inboxPreviewTransactionId, setInboxPreviewTransactionId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>('bookkeeper');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!seed) return;
    hydrateMockStore({
      transactions: seed.transactions,
      drafts: seed.drafts,
      accounts: seed.accounts,
      chartFramework: seed.chartFramework,
    });
    setVersion((v) => v + 1);
  }, [seed?.seedVersion, seed?.transactions, seed?.drafts, seed?.accounts, seed?.chartFramework]);

  useEffect(() => {
    configureStorePersistence({
      onPersistEntry,
    });
    return () => {
      configureStorePersistence({});
    };
  }, [onPersistEntry]);

  useEffect(() => {
    configureStoreAdapter(dataAdapter);
    return () => configureStoreAdapter(undefined);
  }, [dataAdapter]);

  const transactions = useMemo(() => listTransactions(), [version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const handleOpenTransaction = (transactionId: string) => {
    setInboxPreviewTransactionId(null);
    setSelectedTransactionId(transactionId);
    setCurrentView('editor');
  };

  const handleOpenInboxTransaction = (transactionId: string) => {
    setSelectedTransactionId(null);
    setInboxPreviewTransactionId(transactionId);
    setCurrentView('inbox');
    refresh();
  };

  const handleBackToInbox = () => {
    setCurrentView('inbox');
    setSelectedTransactionId(null);
    refresh();
  };

  return (
    <div className="flex flex-col h-full w-full text-gray-900">
      <div className="flex items-center gap-2 px-6 pt-4 pb-2 shrink-0 border-b border-gray-100">
        <nav className="flex items-center space-x-1 bg-gray-100 rounded-full p-1 border border-gray-200 shadow-sm">
          <button
            onClick={() => setCurrentView('inbox')}
            className={`px-5 py-1.5 rounded-full text-sm font-bold transition-colors ${
              currentView === 'inbox' ? 'bg-black text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-gray-900'
            }`}
          >
            Inbox
          </button>
          <button
            onClick={() => setCurrentView('reconciliation')}
            className={`px-5 py-1.5 rounded-full text-sm font-bold transition-colors ${
              currentView === 'reconciliation' ? 'bg-black text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-gray-900'
            }`}
          >
            Abgleich
          </button>
          <button
            onClick={() => setCurrentView('exceptions')}
            className={`px-5 py-1.5 rounded-full text-sm font-bold transition-colors ${
              currentView === 'exceptions' ? 'bg-black text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-gray-900'
            }`}
          >
            Exceptions
          </button>
          <button
            onClick={() => setCurrentView('assets')}
            className={`px-5 py-1.5 rounded-full text-sm font-bold transition-colors ${
              currentView === 'assets' ? 'bg-black text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-gray-900'
            }`}
          >
            Anlagen
          </button>
          <button
            onClick={() => setCurrentView('reports')}
            className={`px-5 py-1.5 rounded-full text-sm font-bold transition-colors ${
              currentView === 'reports' ? 'bg-black text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-gray-900'
            }`}
          >
            Auswertungen
          </button>
        </nav>
        <div className="ml-auto">
          <select
            aria-label="Demo Rolle"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700"
          >
            <option value="bookkeeper">Bookkeeper</option>
            <option value="reviewer">Reviewer</option>
            <option value="accountant">Accountant</option>
            <option value="admin">Admin</option>
            <option value="auditor">Auditor</option>
          </select>
        </div>
      </div>

      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-hidden flex flex-col">
          {currentView === 'inbox' ? (
            <InboxView
              role={role}
              transactions={transactions}
              onOpenTransaction={handleOpenTransaction}
              onRefresh={refresh}
              forcedPreviewTransactionId={inboxPreviewTransactionId}
            />
          ) : currentView === 'editor' ? (
            <BookingEditor
              transactionId={selectedTransactionId}
              role={role}
              onBack={handleBackToInbox}
              onStoreChange={refresh}
            />
          ) : currentView === 'reconciliation' ? (
            <ReconciliationWorkbench
              role={role}
              transactions={transactions}
              onOpenTransaction={handleOpenTransaction}
              onRefresh={refresh}
            />
          ) : currentView === 'exceptions' ? (
            <ExceptionCenter
              role={role}
              transactions={transactions}
              onOpenTransaction={handleOpenTransaction}
              onRefresh={refresh}
            />
          ) : currentView === 'reports' ? (
            <ReportsView
              onOpenTransaction={handleOpenTransaction}
              onOpenReceipt={handleOpenInboxTransaction}
            />
          ) : (
            <AssetManagementView />
          )}
        </div>
      </main>
    </div>
  );
}
