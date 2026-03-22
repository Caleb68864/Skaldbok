interface ResourceTrackerProps {
  resourceId: string;
  label: string;
  current: number;
  max: number;
  onCurrentChange: (value: number) => void;
  onMaxChange?: (value: number) => void;
  disabled?: boolean;
  maxDisabled?: boolean;
  maxEditable?: boolean;
}

export function ResourceTracker({ label, current, max, onCurrentChange, onMaxChange, disabled = false, maxDisabled = false, maxEditable = true }: ResourceTrackerProps) {
  function decrementCurrent() {
    if (!disabled && current > 0) onCurrentChange(current - 1);
  }
  function incrementCurrent() {
    if (!disabled && current < max) onCurrentChange(current + 1);
  }
  function decrementMax() {
    if (!maxDisabled && !disabled && max > 0) onMaxChange?.(max - 1);
  }
  function incrementMax() {
    if (!maxDisabled && !disabled) onMaxChange?.(max + 1);
  }

  const bigButtonStyle: React.CSSProperties = {
    minWidth: '52px',
    minHeight: '52px',
    fontSize: 'var(--size-2xl)',
    fontWeight: 'bold',
    background: 'var(--color-surface-alt)',
    border: '2px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    lineHeight: 1,
  };

  const smallButtonStyle: React.CSSProperties = {
    minWidth: 'var(--touch-target-min)',
    minHeight: 'var(--touch-target-min)',
    fontSize: 'var(--size-lg)',
    background: 'var(--color-surface-alt)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    lineHeight: 1,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>{label}</span>

      {/* Current value — big prominent +/- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={decrementCurrent}
          disabled={disabled || current <= 0}
          style={bigButtonStyle}
        >
          −
        </button>
        <span style={{
          minWidth: '48px',
          textAlign: 'center',
          fontSize: 'var(--size-2xl)',
          fontWeight: 'bold',
          color: 'var(--color-text)',
          fontFamily: 'var(--font-display)',
        }}>
          {current}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={incrementCurrent}
          disabled={disabled || current >= max}
          style={bigButtonStyle}
        >
          +
        </button>

        <span style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-muted)',
          marginLeft: 'var(--space-xs)',
        }}>
          /
        </span>

        {/* Max value — inline after slash */}
        {onMaxChange && maxEditable ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
            <button
              type="button"
              aria-label={`Decrease ${label} max`}
              onClick={decrementMax}
              disabled={maxDisabled || disabled || max <= 0}
              style={smallButtonStyle}
            >
              −
            </button>
            <span style={{
              minWidth: '28px',
              textAlign: 'center',
              fontSize: 'var(--size-lg)',
              fontWeight: 'bold',
              color: 'var(--color-text-muted)',
            }}>
              {max}
            </span>
            <button
              type="button"
              aria-label={`Increase ${label} max`}
              onClick={incrementMax}
              disabled={maxDisabled || disabled}
              style={smallButtonStyle}
            >
              +
            </button>
          </div>
        ) : (
          <span style={{
            fontSize: 'var(--size-lg)',
            fontWeight: 'bold',
            color: 'var(--color-text-muted)',
          }}>
            {max}
          </span>
        )}
      </div>
    </div>
  );
}
