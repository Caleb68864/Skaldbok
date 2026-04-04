import { useState } from 'react';
import { cn } from '../../lib/utils';

interface DerivedFieldDisplayProps {
  label: string;
  computedValue: number | string;
  override: number | null;
  onOverride: (value: number) => void;
  onReset: () => void;
  editable: boolean;
}

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
    const parsed = Number(editValue);
    if (!isNaN(parsed)) {
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
