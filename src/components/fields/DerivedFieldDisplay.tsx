import { useState } from 'react';
import { cn } from '../../lib/utils';

/** Props for {@link DerivedFieldDisplay}. `override` is `null` when the computed value is in effect. */
export interface DerivedFieldDisplayProps {
  label: string;
  computedValue: number | string;
  override: number | null;
  onOverride: (value: number) => void;
  onReset: () => void;
  editable: boolean;
}

/**
 * One derived-stat row that shows the engine-computed value but allows a manual
 * override.
 *
 * @remarks
 * When an `override` is set it wins over `computedValue` and a reset control appears
 * to drop back to the computed number. Editing commits on Enter or blur and ignores
 * non-numeric input; Escape cancels. This is how a table can hand-tune a derived
 * value the formula got "wrong" for their game without losing the formula.
 */
export function DerivedFieldDisplay({ label, computedValue, override, onOverride, onReset, editable }: DerivedFieldDisplayProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const isOverridden = override !== null;
  const effectiveValue = isOverridden ? override : computedValue;

  function handleStartEdit() {
    if (!editable) return;
    setEditValue(String(effectiveValue));
    setEditing(true);
  }

  function handleCommit() {
    // A blank field must NOT commit: `Number('') === 0`, and an override of 0
    // silently disables the derived stat (e.g. an encumbrance limit of 0 turns
    // off carry tracking entirely). Treat empty as "no change" — use Reset to
    // clear an override. Only commit a real, finite number.
    const trimmed = editValue.trim();
    const parsed = Number(trimmed);
    if (trimmed !== '' && Number.isFinite(parsed)) {
      onOverride(parsed);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCommit();
    if (e.key === 'Escape') setEditing(false);
  }

  return (
    <div className="flex items-center justify-between gap-[var(--space-sm)] py-[var(--space-sm)]">
      <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] font-bold min-w-[120px]">
        {label}
      </span>

      <div className="flex items-center gap-[var(--space-sm)]">
        {editing ? (
          <input
            type="number"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-16 h-9 text-center text-[length:var(--font-size-md)] border border-[var(--color-primary)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]"
          />
        ) : (
          <span
            onClick={handleStartEdit}
            className={cn(
              "text-[length:var(--font-size-md)] font-bold min-w-12 text-center px-[var(--space-sm)] py-[var(--space-xs)] rounded-[var(--radius-sm)]",
              isOverridden ? "text-[var(--color-primary)]" : "text-[var(--color-text)]",
              editable ? "cursor-pointer border border-dashed border-[var(--color-border)]" : "cursor-default border border-transparent",
            )}
          >
            {effectiveValue}
          </span>
        )}

        {isOverridden && (
          <span className="text-[length:var(--font-size-xs,10px)] text-[var(--color-primary)] italic">
            (overridden)
          </span>
        )}

        {isOverridden && editable && (
          <button
            onClick={onReset}
            className="text-[length:var(--font-size-xs,10px)] text-[var(--color-text-muted)] bg-transparent border border-[var(--color-border)] rounded-[var(--radius-sm)] px-1.5 py-0.5 cursor-pointer min-h-7 min-w-11"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
