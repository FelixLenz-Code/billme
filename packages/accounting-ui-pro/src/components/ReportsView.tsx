import { useEffect, useMemo, useState } from 'react';
import { Download, FileBarChart2, RefreshCw } from 'lucide-react';
import {
  BalanceSheetPreview,
  BalanceSheetPreviewLine,
  GuvLine,
  GuvReport,
  ReportDrilldownEntry,
  ReportDrilldownSelection,
  ReportFilterState,
  SusaReport,
  SusaRow,
} from '../domain/reportTypes';
import {
  getBalanceSheetPreview,
  getGuvReport,
  getReportDrilldownEntries,
  getSusaReport,
} from '../services/mockReportService';
import ReportToolbar from './reports/ReportToolbar';
import ReportTabSwitch from './reports/ReportTabSwitch';
import SusaTable from './reports/SusaTable';
import GuvView from './reports/GuvView';
import BalanceSheetPreviewView from './reports/BalanceSheetPreviewView';
import ReportDrilldownPanel from './reports/ReportDrilldownPanel';

const BILANZ_ACCOUNT_MAP: Record<string, string[]> = {
  'a-1-1': ['0440', '0480'],
  'a-1-2': ['0670'],
  'a-2-1': ['1000', '1200'],
  'a-2-2': ['1576'],
  'p-1-2': ['9000', '4400', '4930'],
  'p-2-1': ['1600'],
  'p-2-2': ['1740', '1800'],
};

function buildDefaultFilters(): ReportFilterState {
  const now = new Date();
  return {
    chart: 'SKR03',
    mandantId: 'demo-gmbh',
    asOfDate: now.toISOString().slice(0, 10),
    periodFrom: `${now.getFullYear()}-01`,
    periodTo: `${now.getFullYear()}-12`,
    compareMode: 'none',
    includeDrafts: false,
  };
}

interface ReportsViewProps {
  onOpenTransaction?: (transactionId: string) => void;
  onOpenReceipt?: (transactionId: string) => void;
}

export default function ReportsView({ onOpenTransaction, onOpenReceipt }: ReportsViewProps) {
  const [activeTab, setActiveTab] = useState<'susa' | 'guv' | 'bilanz'>('susa');
  const [filters, setFilters] = useState<ReportFilterState>(() => buildDefaultFilters());
  const [susaReport, setSusaReport] = useState<SusaReport | null>(null);
  const [guvReport, setGuvReport] = useState<GuvReport | null>(null);
  const [balanceSheetPreview, setBalanceSheetPreview] = useState<BalanceSheetPreview | null>(null);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);

  const [drilldownSelection, setDrilldownSelection] = useState<ReportDrilldownSelection | null>(null);
  const [drilldownEntries, setDrilldownEntries] = useState<ReportDrilldownEntry[]>([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReportsLoading(true);
    setReportsError(null);

    Promise.all([
      getSusaReport(filters),
      getGuvReport(filters),
      getBalanceSheetPreview(filters),
    ])
      .then(([susa, guv, bilanz]) => {
        if (cancelled) return;
        setSusaReport(susa);
        setGuvReport(guv);
        setBalanceSheetPreview(bilanz);
      })
      .catch((error) => {
        if (cancelled) return;
        setReportsError(error instanceof Error ? error.message : 'Auswertungen konnten nicht geladen werden.');
      })
      .finally(() => {
        if (!cancelled) setReportsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters]);

  useEffect(() => {
    if (!drilldownSelection) {
      setDrilldownEntries([]);
      return;
    }

    let cancelled = false;
    setDrilldownLoading(true);

    getReportDrilldownEntries(drilldownSelection)
      .then((rows) => {
        if (!cancelled) setDrilldownEntries(rows);
      })
      .finally(() => {
        if (!cancelled) setDrilldownLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [drilldownSelection]);

  const activeReportLabel = useMemo(() => {
    if (activeTab === 'susa') return 'Summen- und Saldenliste';
    if (activeTab === 'guv') return 'Gewinn- und Verlustrechnung';
    return 'Bilanz Preview';
  }, [activeTab]);

  const handleSusaSelect = (row: SusaRow) => {
    setDrilldownSelection({
      reportType: 'susa',
      targetId: row.accountNumber,
      targetLabel: `${row.accountNumber} · ${row.accountName}`,
      accountNumbers: [row.accountNumber],
    });
  };

  const handleGuvSelect = (line: GuvLine) => {
    setDrilldownSelection({
      reportType: 'guv',
      targetId: line.id,
      targetLabel: `${line.code} · ${line.label}`,
      accountNumbers: line.accountRefs ?? [],
    });
  };

  const handleBilanzSelect = (line: BalanceSheetPreviewLine) => {
    setDrilldownSelection({
      reportType: 'bilanz',
      targetId: line.id,
      targetLabel: `${line.code} · ${line.label}`,
      accountNumbers: BILANZ_ACCOUNT_MAP[line.id] ?? [],
    });
  };

  return (
    <div className="flex flex-col bg-gray-50">
      <div className="px-6 py-5 border-b border-gray-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
              <span className="w-6 h-6 rounded-full bg-[#ccff00] text-black flex items-center justify-center">
                <FileBarChart2 size={14} />
              </span>
              Auswertungen
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-gray-900">SuSa, GuV und Bilanz-Preview</h1>
            <p className="mt-1 text-sm text-gray-500">
              Prototypische Reporting-UI mit Drilldown-Struktur, vorbereitet für spätere SQLite-/Ledger-Anbindung.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 h-10 rounded-full border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2 transition-colors">
              <Download size={14} /> Export (Mock)
            </button>
            <button className="px-4 h-10 rounded-full border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2 transition-colors">
              <RefreshCw size={14} /> Snapshot (Mock)
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <ReportToolbar filters={filters} onChange={setFilters} />
        <div className="flex items-center justify-between gap-3">
          <ReportTabSwitch activeTab={activeTab} onChange={setActiveTab} />
          <div className="text-xs text-gray-500 hidden md:block">Aktive Ansicht: {activeReportLabel}</div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4">
            <div className="flex-1 min-w-0 overflow-y-auto max-h-[56vh] pr-1">
              {reportsLoading ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
                  Lade Auswertungen…
                </div>
              ) : reportsError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">
                  {reportsError}
                </div>
              ) : activeTab === 'susa' ? (
                <SusaTable report={susaReport} onSelectRow={handleSusaSelect} />
              ) : activeTab === 'guv' ? (
                <GuvView report={guvReport} compareMode={filters.compareMode} onSelectLine={handleGuvSelect} />
              ) : (
                <BalanceSheetPreviewView report={balanceSheetPreview} onSelectLine={handleBilanzSelect} />
              )}
            </div>

            <div className={`transition-all duration-200 ${drilldownSelection ? 'xl:w-[25rem] w-full' : 'xl:w-0 w-full'}`}>
              {drilldownSelection ? (
                <ReportDrilldownPanel
                  selection={drilldownSelection}
                  entries={drilldownEntries}
                  loading={drilldownLoading}
                  onClose={() => setDrilldownSelection(null)}
                  onOpenJournalEntry={onOpenTransaction}
                  onOpenReceipt={onOpenReceipt}
                />
              ) : (
                <div className="hidden xl:flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white/70 text-sm text-gray-400 px-6 text-center">
                  Konto- oder Reportzeile anklicken, um Drilldown zu sehen.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}
