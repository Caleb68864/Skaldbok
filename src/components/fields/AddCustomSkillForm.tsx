import { cn } from '../../lib/utils';
import type { AttributeDefinition, SkillCategory } from '../../types/system';

/** The in-progress custom skill. `null` upstream means the form is closed. */
export interface CustomSkillDraft {
  name: string;
  categoryId: string;
  linkedAttributeId: string;
}

export interface AddCustomSkillFormProps {
  draft: CustomSkillDraft | null;
  onDraftChange: (draft: CustomSkillDraft) => void;
  onOpen: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  categories: SkillCategory[];
  attributes: AttributeDefinition[];
  /** False disables Add and shows the collision message. */
  nameAvailable: boolean;
}

/**
 * Adds a skill the system definition does not declare — "Language (Zhodani)",
 * a new Profession.
 *
 * @remarks
 * Presentational: it owns no state and makes no decision about whether a name
 * is free. The availability check needs the character *and* the system, both of
 * which belong to the screen, so it arrives as a prop.
 *
 * Collapses to a single button until opened, because on a phone this sits above
 * a 103-row list and an always-open three-field form would push the list off
 * screen.
 */
export function AddCustomSkillForm({
  draft,
  onDraftChange,
  onOpen,
  onCancel,
  onSubmit,
  categories,
  attributes,
  nameAvailable,
}: AddCustomSkillFormProps) {
  if (draft === null) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="min-h-[var(--touch-target-min)] px-[var(--space-md)] rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] font-semibold cursor-pointer"
      >
        + Add a skill
      </button>
    );
  }

  const trimmed = draft.name.trim();

  return (
    <div className="flex flex-col gap-[var(--space-sm)] p-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
      <input
        type="text"
        value={draft.name}
        onChange={e => onDraftChange({ ...draft, name: e.target.value })}
        placeholder="Skill name, e.g. Language (Zhodani)"
        aria-label="New skill name"
        autoFocus
        className="min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
      />
      <div className="flex gap-[var(--space-sm)] flex-wrap">
        <select
          value={draft.categoryId}
          onChange={e => onDraftChange({ ...draft, categoryId: e.target.value })}
          aria-label="New skill category"
          className="flex-1 min-w-[8rem] min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
        >
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={draft.linkedAttributeId}
          onChange={e => onDraftChange({ ...draft, linkedAttributeId: e.target.value })}
          aria-label="New skill linked characteristic"
          className="flex-1 min-w-[8rem] min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
        >
          <option value="">No characteristic</option>
          {attributes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      {trimmed !== '' && !nameAvailable && (
        <p className="m-0 text-[length:var(--font-size-sm)] text-red-400" role="alert">
          A skill called “{trimmed}” already exists.
        </p>
      )}
      <div className="flex gap-[var(--space-sm)]">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!nameAvailable}
          className={cn(
            'min-h-[var(--touch-target-min)] px-[var(--space-md)] rounded-[var(--radius-sm)] border-none font-semibold',
            nameAvailable
              ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] cursor-pointer'
              : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] opacity-50 cursor-default',
          )}
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[var(--touch-target-min)] px-[var(--space-md)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent text-[var(--color-text)] cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
