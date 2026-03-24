interface ReportTabSwitchProps {
  activeTab: 'susa' | 'guv' | 'bilanz';
  onChange: (tab: 'susa' | 'guv' | 'bilanz') => void;
}

const tabs: Array<{ id: 'susa' | 'guv' | 'bilanz'; label: string }> = [
  { id: 'susa', label: 'SuSa' },
  { id: 'guv', label: 'GuV' },
  { id: 'bilanz', label: 'Bilanz (Preview)' },
];

export default function ReportTabSwitch({ activeTab, onChange }: ReportTabSwitchProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 rounded-full text-sm font-bold border ${
            activeTab === tab.id ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

