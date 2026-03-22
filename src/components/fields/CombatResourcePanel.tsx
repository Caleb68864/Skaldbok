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

  const displayColor = isZero
    ? 'var(--color-danger)'
    : isLow
      ? 'var(--color-warning)'
      : colorVar;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-sm)',
      padding: 'var(--space-md)',
      flex: 1,
    }}>
      <span style={{
        fontSize: 'var(--font-size-md)',
        fontWeight: 'bold',
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
      </span>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
      }}>
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={onDecrement}
          disabled={current <= 0}
          style={{
            minWidth: '60px',
            minHeight: '60px',
            fontSize: '2rem',
            fontWeight: 'bold',
            background: 'var(--color-surface-alt)',
            border: '2px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text)',
            cursor: current <= 0 ? 'default' : 'pointer',
            opacity: current <= 0 ? 0.4 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          −
        </button>

        <div style={{ textAlign: 'center' }}>
          <span style={{
            fontSize: '3.5rem',
            fontWeight: 'bold',
            color: displayColor,
            lineHeight: 1,
          }}>
            {current}
          </span>
          <span style={{
            fontSize: 'var(--font-size-lg)',
            color: 'var(--color-text-muted)',
          }}>
            {' / '}
            {max}
          </span>
        </div>

        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={onIncrement}
          disabled={current >= max}
          style={{
            minWidth: '60px',
            minHeight: '60px',
            fontSize: '2rem',
            fontWeight: 'bold',
            background: 'var(--color-surface-alt)',
            border: '2px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text)',
            cursor: current >= max ? 'default' : 'pointer',
            opacity: current >= max ? 0.4 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
