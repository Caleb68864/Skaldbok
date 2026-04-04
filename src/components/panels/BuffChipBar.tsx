import { useState } from 'react';
import { cn } from '../../lib/utils';
import type { TempModifier } from '../../types/character';

interface BuffChipBarProps {
  modifiers: TempModifier[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onAdd: () => void;
}

const DURATION_ABBREV: Record<TempModifier['duration'], string> = {
  round: 'RND',
  stretch: 'STR',
  shift: 'SHI',
  scene: 'SCN',
  permanent: '\u221E',
};

function formatDelta(n: number): string {
  if (n >= 0) return `+${n}`;
  return `${n}`;
}

function sumDelta(mod: TempModifier): number {
  return mod.effects.reduce((sum, e) => sum + e.delta, 0);
}

function formatEffectsList(mod: TempModifier): string {
  return mod.effects
    .map((e) => `${e.stat.toUpperCase()} ${formatDelta(e.delta)}`)
    .join(', ');
}

export function BuffChipBar({
  modifiers,
  onRemove,
  onClearAll,
  onAdd,
}: BuffChipBarProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-wrap gap-[var(--space-2)] items-start">
      {modifiers.map((mod) => {
        const delta = sumDelta(mod);
        const isExpanded = expandedId === mod.id;

        return (
          <div key={mod.id} className="flex flex-col">
            <button
              type="button"
              onClick={() => toggleExpanded(mod.id)}
              className={cn(
                "inline-flex items-center gap-[var(--space-1)] min-h-[var(--touch-target-min)] px-[var(--space-3)] text-white border-none rounded-[var(--radius-full,9999px)] text-[length:var(--font-size-sm)] font-semibold cursor-pointer",
                delta >= 0 ? "bg-[var(--color-accent)]" : "bg-[var(--color-danger)]"
              )}
            >
              <span>{mod.label}</span>
              <span className="opacity-85">{formatDelta(delta)}</span>
              <span className="text-[length:var(--font-size-xs)] opacity-70 ml-[var(--space-1)] bg-black/20 rounded-[var(--radius-sm)] px-[var(--space-1)] py-px">
                {DURATION_ABBREV[mod.duration]}
              </span>
            </button>

            {isExpanded && (
              <div className="mt-[var(--space-1)] p-[var(--space-2)] bg-[var(--color-surface,#1a1a1a)] rounded-[var(--radius-md)] text-[length:var(--font-size-xs)] text-[var(--color-text-secondary,#aaa)]">
                <div className="mb-[var(--space-1)]">
                  {formatEffectsList(mod)}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(mod.id)}
                  className="min-h-[var(--touch-target-min)] px-[var(--space-2)] bg-[var(--color-danger)] text-white border-none rounded-[var(--radius-sm)] text-[length:var(--font-size-xs)] font-semibold cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add chip */}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center justify-center min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] px-[var(--space-2)] bg-[var(--color-surface,#2a2a2a)] text-[var(--color-text-secondary,#aaa)] border border-dashed border-[var(--color-text-secondary,#555)] rounded-[var(--radius-full,9999px)] text-[length:var(--font-size-lg)] cursor-pointer [-webkit-tap-highlight-color:transparent]"
      >
        +
      </button>

      {/* Clear All */}
      {modifiers.length > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="min-h-[var(--touch-target-min)] px-[var(--space-2)] bg-transparent text-[var(--color-danger)] border-none text-[length:var(--font-size-sm)] font-semibold cursor-pointer self-center [-webkit-tap-highlight-color:transparent]"
        >
          Clear All
        </button>
      )}
    </div>
  );
}
