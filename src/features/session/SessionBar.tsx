import { useSessionEncounterContext } from './SessionEncounterContext';

interface SessionBarProps {
  /** Called when the user clicks the active encounter chip (opens EncounterScreen). */
  onActiveEncounterClick?: (encounterId: string) => void;
}

export function SessionBar({ onActiveEncounterClick }: SessionBarProps) {
  const { activeEncounter, recentEnded, reopenEncounter, loading } = useSessionEncounterContext();

  if (loading) {
    return <div className="text-sm text-neutral-500 px-4 py-2">Loading session…</div>;
  }

  return (
    <div className="flex flex-col gap-1 px-4 py-2 border-b border-neutral-200 bg-neutral-50">
      {/* Active encounter chip */}
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-neutral-500">Active:</span>
        {activeEncounter ? (
          <button
            type="button"
            onClick={() => onActiveEncounterClick?.(activeEncounter.id)}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-sm font-medium hover:bg-blue-200"
          >
            <span>{activeEncounter.title}</span>
            <span className="text-xs text-blue-700">({activeEncounter.type})</span>
          </button>
        ) : (
          <span className="text-sm text-neutral-400">no encounter active</span>
        )}
      </div>

      {/* Recently ended — hidden entirely when empty */}
      {recentEnded.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Recently ended:</span>
          {recentEnded.map((enc) => (
            <button
              key={enc.id}
              type="button"
              onClick={() => reopenEncounter(enc.id)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 text-xs hover:bg-neutral-300"
              title={`Reopen ${enc.title}`}
            >
              ↺ {enc.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
