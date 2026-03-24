import { InboxQueueKey, inboxQueueLabels } from '../domain/selectors';

interface InboxQueueTabsProps {
  activeQueue: InboxQueueKey;
  counts: Record<InboxQueueKey, number>;
  onChange: (queue: InboxQueueKey) => void;
}

export default function InboxQueueTabs({ activeQueue, counts, onChange }: InboxQueueTabsProps) {
  const mainQueues: InboxQueueKey[] = ['all', 'incomplete', 'review', 'approval', 'posted', 'errors'];

  return (
    <div className="flex flex-wrap gap-2">
      {mainQueues.map((queue) => (
        <button
          key={queue}
          onClick={() => onChange(queue)}
          className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
            activeQueue === queue
              ? 'bg-black text-white border-black'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          {inboxQueueLabels[queue]} <span className="opacity-80">{counts[queue] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

