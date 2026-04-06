import type { Encounter } from '../../types/encounter';
import { cn } from '../../lib/utils';

interface EncounterListItemProps {
  encounter: Encounter;
  onClick: () => void;
}

const typeColors: Record<string, string> = {
  combat: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  social: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  exploration: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

/**
 * Compact list-item for an encounter in the session's encounter history.
 */
export function EncounterListItem({ encounter, onClick }: EncounterListItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-3 cursor-pointer hover:border-[var(--color-accent)] transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[var(--color-text)] font-semibold text-sm truncate">
          {encounter.title}
        </span>
        <div className="flex gap-1.5 shrink-0">
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
              typeColors[encounter.type] ?? 'bg-gray-100 text-gray-700'
            )}
          >
            {encounter.type}
          </span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
              encounter.status === 'active'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400'
            )}
          >
            {encounter.status}
          </span>
        </div>
      </div>
      <div className="text-[var(--color-text-muted)] text-xs">
        {encounter.participants.length} participant{encounter.participants.length !== 1 ? 's' : ''}
        {encounter.startedAt && (
          <span> &middot; {new Date(encounter.startedAt).toLocaleTimeString()}</span>
        )}
      </div>
    </button>
  );
}
