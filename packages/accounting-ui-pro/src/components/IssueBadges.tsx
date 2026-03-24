import { getFlagLabel } from '../domain/selectors';
import { Transaction } from '../types';

interface IssueBadgesProps {
  transaction: Transaction;
}

export default function IssueBadges({ transaction }: IssueBadgesProps) {
  const { issueCounts, flags } = transaction;
  if (issueCounts.errors + issueCounts.warnings + issueCounts.infos === 0 && flags.length === 0) {
    return <span className="text-gray-300">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {issueCounts.errors > 0 && (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">
          {issueCounts.errors} Fehler
        </span>
      )}
      {issueCounts.warnings > 0 && (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">
          {issueCounts.warnings} Warn.
        </span>
      )}
      {flags.slice(0, 2).map((flag) => (
        <span key={flag} className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
          {getFlagLabel(flag)}
        </span>
      ))}
    </div>
  );
}

