import { useState } from 'react';
import { cn } from '../../lib/utils';

/** Props for {@link DerivedFieldDisplay}. `override` is `null` when the computed value is in effect. */
export interface DerivedFieldDisplayProps {
  label: string;
  /** The engine's value with no temporary modifiers applied. */
  computedValue: number | string;
  /**
   * The value after temporary modifiers, when any are active. Shown as the
   * headline number but never used to seed the override input — an override
   * seeded from a buffed value persists the buff. Omit when no modifier applies.
   */
  modifiedValue?: number | string;
  override: number | null;
  onOverride: (value: number) => void;
  onReset: () => void;
  editable: boolean;
}

/**
 * Splits a derived row into the value the user *edits* and the value they *see*.
 *
 * @remarks
 * Extracted and exported so the rule can be tested without a DOM: the stored
 * value (override, else computed) is the only thing an edit may start from,
 * while the modified value is display-only. Seeding the input from the modified
 * value is how a scene-long buff gets written into `derivedOverrides`
 * permanently — the case CLAUDE.md warns about under "bind editable inputs to
 * the stored value, never the effective one".
 */
export function splitDerivedValues(
  computedValue: number | string,
  modifiedValue: number | string | undefined,
  override: number | null,
): { stored: number | string; shown: number | string; isModified: boolean } {
  const stored = override !== null ? override : computedValue;
  const isModified = modifiedValue !== undefined && modifiedValue !== stored;
  return { stored, shown: isModified ? (modifiedValue as number | string) : stored, isModified };
}

/**
 * Decides whether a committed edit should be written as an override.
 *
 * @remarks
 * Returns `null` for "no change". Blank is rejected because `Number('') === 0`
 * and an override of 0 silently disables the stat (an encumbrance limit of 0
 * turns off carry tracking); a value equal to the seed is rejected so that
 * tapping a field and tapping away does not pin the stat to today's number.
 */
export function commitOverrideValue(raw: string, stored: number | string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  if (parsed === Number(stored)) return null;
  return parsed;
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
export function DerivedFieldDisplay({ label, computedValue, modifiedValue, override, onOverride, onReset, editable }: DerivedFieldDisplayProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const isOverridden = override !== null;
  // `stored` is what an edit starts from and what a no-op edit is compared
  // against. Never the modified value — see splitDerivedValues.
  const { stored: effectiveValue, shown: shownValue, isModified } = splitDerivedValues(
    computedValue,
    modifiedValue,
    override,
  );

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
    //
    // Committing the seed unchanged must also be a no-op: a tap-and-tap-away
    // would otherwise mint an override pinning the stat to today's computed
    // number, which then stops tracking the formula.
    const next = commitOverrideValue(editValue, effectiveValue);
    if (next !== null) onOverride(next);
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
            aria-label={`${label} override`}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-16 h-9 text-center text-[length:var(--font-size-md)] border border-[var(--color-primary)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]"
          />
        ) : (
          <span
            onClick={handleStartEdit}
            role={editable ? 'button' : undefined}
            tabIndex={editable ? 0 : undefined}
            aria-label={editable ? `Edit ${label}` : undefined}
            onKeyDown={e => {
              if (!editable) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleStartEdit();
              }
            }}
            className={cn(
              "text-[length:var(--font-size-md)] font-bold min-w-12 text-center px-[var(--space-sm)] py-[var(--space-xs)] rounded-[var(--radius-sm)]",
              isOverridden ? "text-[var(--color-primary)]" : "text-[var(--color-text)]",
              editable ? "cursor-pointer border border-dashed border-[var(--color-border)]" : "cursor-default border border-transparent",
            )}
          >
            {shownValue}
          </span>
        )}

        {isModified && !editing && (
          <span className="text-[length:var(--font-size-xs,10px)] text-[var(--color-text-muted)] italic">
            (base {effectiveValue})
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
