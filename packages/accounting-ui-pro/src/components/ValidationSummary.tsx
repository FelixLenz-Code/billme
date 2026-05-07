import { ValidationIssue } from '../types';

interface ValidationSummaryProps {
  issues: ValidationIssue[];
}

export default function ValidationSummary({ issues }: ValidationSummaryProps) {
  if (issues.length === 0) {
    return (
      <div className="mb-4 border border-emerald-100 bg-emerald-50 rounded-xl p-4 text-sm font-medium text-emerald-800">
        Keine Validierungsprobleme. Buchung ist prüfbar.
      </div>
    );
  }

  const groups = {
    error: issues.filter((issue) => issue.severity === 'error'),
    warning: issues.filter((issue) => issue.severity === 'warning'),
    info: issues.filter((issue) => issue.severity === 'info'),
  };

  return (
    <div aria-live="polite" className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-800">
        Validierung ({issues.length})
      </div>
      <div className="p-4 space-y-3">
        {(['error', 'warning', 'info'] as const).map((severity) => {
          if (groups[severity].length === 0) return null;
          return (
            <div key={severity}>
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                {severity === 'error' ? 'Fehler' : severity === 'warning' ? 'Warnungen' : 'Hinweise'}
              </div>
              <ul className="space-y-1">
                {groups[severity].map((issue) => (
                  <li key={issue.id} className="text-sm text-gray-700 flex items-start gap-2">
                    <span
                      className={`mt-1 h-2 w-2 rounded-full ${
                        severity === 'error'
                          ? 'bg-red-500'
                          : severity === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-gray-400'
                      }`}
                    />
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

