import { cn } from '../../lib/utils';
import type { ConditionDefinition } from '../../types/system';

interface LinkedCondition {
  definition: ConditionDefinition;
  active: boolean;
}

interface AttributeFieldProps {
  attributeId: string;
  abbreviation: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (delta: number) => void;
  disabled?: boolean;
  linkedConditions?: LinkedCondition[];
  onConditionToggle?: (conditionId: string, value: boolean) => void;
  /** Sum of temp modifier deltas for this attribute. Shows a badge when non-zero. */
  modifierDelta?: number;
}

export function AttributeField({ attributeId: _attributeId, abbreviation, value, min = 3, max = 18, onChange, disabled = false, linkedConditions, onConditionToggle, modifierDelta }: AttributeFieldProps) {
  const hasModifier = modifierDelta !== undefined && modifierDelta !== 0;

  return (
    <div className="flex flex-col items-center gap-[var(--space-xs)] min-w-[60px]">
      <span className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)] font-bold">
        {abbreviation}
        {hasModifier && (
          <span className={cn(
            "ml-1 text-[length:var(--font-size-xs,10px)] font-bold",
            modifierDelta! > 0 ? "text-[var(--color-success,#27ae60)]" : "text-[var(--color-danger)]"
          )}>
            {modifierDelta! > 0 ? `+${modifierDelta}` : modifierDelta}
          </span>
        )}
      </span>
      {!disabled ? (
        <div className="flex items-center gap-[var(--space-sm)]">
          <button
            type="button"
            aria-label={`Decrease ${abbreviation}`}
            onClick={() => onChange(-1)}
            disabled={value <= min}
            className="min-w-12 min-h-12 text-[length:var(--size-2xl)] font-bold bg-[var(--color-surface-alt)] border-2 border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] cursor-pointer flex items-center justify-center select-none leading-none"
          >
            −
          </button>
          <span className="min-w-10 text-center text-[length:var(--size-2xl)] font-bold text-[var(--color-text)] font-[family-name:var(--font-display)]">
            {value}
          </span>
          <button
            type="button"
            aria-label={`Increase ${abbreviation}`}
            onClick={() => onChange(1)}
            disabled={value >= max}
            className="min-w-12 min-h-12 text-[length:var(--size-2xl)] font-bold bg-[var(--color-surface-alt)] border-2 border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] cursor-pointer flex items-center justify-center select-none leading-none"
          >
            +
          </button>
        </div>
      ) : (
        <span className="min-w-10 text-center text-[length:var(--size-2xl)] font-bold text-[var(--color-text)] font-[family-name:var(--font-display)]">
          {value}
        </span>
      )}
      {linkedConditions && linkedConditions.length > 0 && (
        <div className="flex flex-col gap-[var(--space-xs)] items-center w-full">
          {linkedConditions.map(({ definition, active }) => (
            <button
              key={definition.id}
              type="button"
              role="switch"
              aria-checked={active}
              aria-label={`${definition.name} condition (${abbreviation})`}
              onClick={() => onConditionToggle?.(definition.id, !active)}
              className={cn(
                "inline-flex items-center justify-center min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-md)] cursor-pointer font-[family-name:inherit] text-[length:var(--font-size-sm)]",
                active
                  ? "border-2 border-[var(--color-danger)] bg-[var(--color-danger)] text-white font-bold"
                  : "border-2 border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)] font-normal"
              )}
            >
              {definition.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
