import { cn } from '../../lib/utils';

interface CombatResourcePanelProps {
  label: string;
  current: number;
  max: number;
  colorVar: string;
  lowThreshold?: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function CombatResourcePanel({
  label,
  current,
  max,
  colorVar,
  lowThreshold = 3,
  onIncrement,
  onDecrement,
}: CombatResourcePanelProps) {
  const isLow = current <= lowThreshold && current > 0;
  const isZero = current === 0;

  return (
    <div className="flex flex-col items-center gap-[var(--space-sm)] p-[var(--space-md)] flex-1">
      <span className="text-[length:var(--font-size-md)] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.05em]">
        {label}
      </span>

      <div className="flex items-center gap-[var(--space-md)]">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={onDecrement}
          disabled={current <= 0}
          className={cn(
            "min-w-[60px] min-h-[60px] text-[2rem] font-bold bg-[var(--color-surface-alt)] border-2 border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] flex items-center justify-center",
            current <= 0 ? "cursor-default opacity-40" : "cursor-pointer opacity-100"
          )}
        >
          −
        </button>

        <div className="text-center">
          <span className={cn(
              "text-[3.5rem] font-bold leading-none",
              isZero && "text-[var(--color-danger)]",
              isLow && !isZero && "text-[var(--color-warning)]",
            )}
            style={!isZero && !isLow ? { color: colorVar } : undefined}
          >
            {current}
          </span>
          <span className="text-[length:var(--font-size-lg)] text-[var(--color-text-muted)]">
            {' / '}
            {max}
          </span>
        </div>

        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={onIncrement}
          disabled={current >= max}
          className={cn(
            "min-w-[60px] min-h-[60px] text-[2rem] font-bold bg-[var(--color-surface-alt)] border-2 border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] flex items-center justify-center",
            current >= max ? "cursor-default opacity-40" : "cursor-pointer opacity-100"
          )}
        >
          +
        </button>
      </div>
    </div>
  );
}
