import { useState } from 'react';
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
  permanent: '∞',
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
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-2)',
        alignItems: 'flex-start',
      }}
    >
      {modifiers.map((mod) => {
        const delta = sumDelta(mod);
        const isExpanded = expandedId === mod.id;
        const chipColor =
          delta >= 0 ? 'var(--color-accent)' : 'var(--color-danger)';

        return (
          <div key={mod.id} style={{ display: 'flex', flexDirection: 'column' }}>
            <button
              type="button"
              onClick={() => toggleExpanded(mod.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                minHeight: 'var(--touch-target-min)',
                padding: '0 var(--space-3)',
                background: chipColor,
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-full, 9999px)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span>{mod.label}</span>
              <span style={{ opacity: 0.85 }}>{formatDelta(delta)}</span>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  opacity: 0.7,
                  marginLeft: 'var(--space-1)',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1px var(--space-1)',
                }}
              >
                {DURATION_ABBREV[mod.duration]}
              </span>
            </button>

            {isExpanded && (
              <div
                style={{
                  marginTop: 'var(--space-1)',
                  padding: 'var(--space-2)',
                  background: 'var(--color-surface, #1a1a1a)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary, #aaa)',
                }}
              >
                <div style={{ marginBottom: 'var(--space-1)' }}>
                  {formatEffectsList(mod)}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(mod.id)}
                  style={{
                    minHeight: 'var(--touch-target-min)',
                    padding: '0 var(--space-2)',
                    background: 'var(--color-danger)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
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
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'var(--touch-target-min)',
          minWidth: 'var(--touch-target-min)',
          padding: '0 var(--space-2)',
          background: 'var(--color-surface, #2a2a2a)',
          color: 'var(--color-text-secondary, #aaa)',
          border: '1px dashed var(--color-text-secondary, #555)',
          borderRadius: 'var(--radius-full, 9999px)',
          fontSize: 'var(--font-size-lg)',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        +
      </button>

      {/* Clear All */}
      {modifiers.length > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          style={{
            minHeight: 'var(--touch-target-min)',
            padding: '0 var(--space-2)',
            background: 'transparent',
            color: 'var(--color-danger)',
            border: 'none',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            alignSelf: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Clear All
        </button>
      )}
    </div>
  );
}
