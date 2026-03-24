import { ActivityEvent } from '../types';

interface ActivityTimelineProps {
  events: ActivityEvent[];
}

export default function ActivityTimeline({ events }: ActivityTimelineProps) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-800">
        Aktivität
      </div>
      <div className="max-h-64 overflow-auto divide-y divide-gray-100">
        {events.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500">Noch keine Aktivität.</div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="px-4 py-3">
              <div className="text-sm font-bold text-gray-800">{event.label}</div>
              {event.details && <div className="text-xs text-gray-600 mt-0.5">{event.details}</div>}
              <div className="text-xs text-gray-400 mt-1">
                {new Date(event.at).toLocaleString('de-DE')} • {event.actorName}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

