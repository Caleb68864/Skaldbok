import { cn } from '../../lib/utils';

export interface SkillGroupHeaderProps {
  name: string;
  /** Hides the group action outside Edit Mode — it writes to the record. */
  editable: boolean;
  /** True when every speciality already has an entry, so the action is a no-op. */
  complete: boolean;
  onTrainAll: () => void;
}

/**
 * Opens a run of specialities belonging to one skill group, with the action
 * that grants the group's level-0 baseline.
 *
 * @remarks
 * Traveller gives level 0 in *every* speciality of a group when you gain it at
 * 0. Without the action that is one hand-entered row per speciality — five for
 * Drive, eighteen for Science — and each omission shows up at the table as a −3
 * unskilled DM the character should not be taking.
 *
 * Disabled rather than hidden once the group is complete, so the control does
 * not appear and vanish as the character fills in; the title says why.
 */
export function SkillGroupHeader({ name, editable, complete, onTrainAll }: SkillGroupHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 pt-[var(--space-sm)] pb-[var(--space-2xs,2px)]">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] opacity-70">
        {name}
      </span>
      {editable && (
        <button
          type="button"
          onClick={onTrainAll}
          disabled={complete}
          title={complete
            ? `Every ${name} speciality is already on the sheet`
            : `Add every missing ${name} speciality at level 0`}
          className={cn(
            'shrink-0 min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] text-xs font-semibold',
            complete
              ? 'bg-transparent text-[var(--color-text-muted)] opacity-40 cursor-default'
              : 'bg-[var(--color-surface-raised)] text-[var(--color-text)] cursor-pointer',
          )}
        >
          All at 0
        </button>
      )}
    </div>
  );
}
