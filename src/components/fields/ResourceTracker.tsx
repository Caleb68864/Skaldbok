interface ResourceTrackerProps {
  resourceId: string;
  label: string;
  current: number;
  max: number;
  onCurrentChange: (delta: number) => void;
  onMaxChange?: (delta: number) => void;
  disabled?: boolean;
  maxDisabled?: boolean;
  maxEditable?: boolean;
}

export function ResourceTracker({ label, current, max, onCurrentChange, onMaxChange, disabled = false, maxDisabled = false, maxEditable = true }: ResourceTrackerProps) {
  function decrementCurrent() {
    if (!disabled && current > 0) onCurrentChange(-1);
  }
  function incrementCurrent() {
    if (!disabled && current < max) onCurrentChange(1);
  }
  function decrementMax() {
    if (!maxDisabled && !disabled && max > 0) onMaxChange?.(-1);
  }
  function incrementMax() {
    if (!maxDisabled && !disabled) onMaxChange?.(1);
  }

  const bigBtnClass = "min-w-[52px] min-h-[52px] text-[length:var(--size-2xl)] font-bold bg-[var(--color-surface-alt)] border-2 border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] cursor-pointer flex items-center justify-center select-none leading-none";

  const smallBtnClass = "min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] text-[length:var(--size-lg)] bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] cursor-pointer flex items-center justify-center select-none leading-none";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)] font-bold">{label}</span>

      {/* Current value — big prominent +/- */}
      <div className="flex items-center gap-[var(--space-sm)]">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={decrementCurrent}
          disabled={disabled || current <= 0}
          className={bigBtnClass}
        >
          −
        </button>
        <span className="min-w-12 text-center text-[length:var(--size-2xl)] font-bold text-[var(--color-text)] font-[family-name:var(--font-display)]">
          {current}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={incrementCurrent}
          disabled={disabled || current >= max}
          className={bigBtnClass}
        >
          +
        </button>

        <span className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)] ml-[var(--space-xs)]">
          /
        </span>

        {/* Max value — inline after slash */}
        {onMaxChange && maxEditable ? (
          <div className="flex items-center gap-[var(--space-xs)]">
            <button
              type="button"
              aria-label={`Decrease ${label} max`}
              onClick={decrementMax}
              disabled={maxDisabled || disabled || max <= 0}
              className={smallBtnClass}
            >
              −
            </button>
            <span className="min-w-7 text-center text-[length:var(--size-lg)] font-bold text-[var(--color-text-muted)]">
              {max}
            </span>
            <button
              type="button"
              aria-label={`Increase ${label} max`}
              onClick={incrementMax}
              disabled={maxDisabled || disabled}
              className={smallBtnClass}
            >
              +
            </button>
          </div>
        ) : (
          <span className="text-[length:var(--size-lg)] font-bold text-[var(--color-text-muted)]">
            {max}
          </span>
        )}
      </div>
    </div>
  );
}
