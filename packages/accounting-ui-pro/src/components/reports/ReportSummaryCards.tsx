interface ReportSummaryCardsProps {
  cards: Array<{
    label: string;
    value: string;
    sublabel?: string;
    tone?: 'default' | 'ok' | 'warning' | 'danger';
  }>;
}

export default function ReportSummaryCards({ cards }: ReportSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="text-[10px] uppercase tracking-wide font-bold text-gray-400">{card.label}</div>
          <div
            className={`text-lg font-bold mt-1 ${
              card.tone === 'ok'
                ? 'text-emerald-700'
                : card.tone === 'warning'
                  ? 'text-amber-700'
                  : card.tone === 'danger'
                    ? 'text-red-700'
                    : 'text-gray-900'
            }`}
          >
            {card.value}
          </div>
          {card.sublabel && <div className="text-xs text-gray-500 mt-0.5">{card.sublabel}</div>}
        </div>
      ))}
    </div>
  );
}

