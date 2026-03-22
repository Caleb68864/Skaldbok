interface CounterControlProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  label: string;
  disabled?: boolean;
}

export function CounterControl({ value, min, max, onChange, label, disabled = false }: CounterControlProps) {
  function decrement() {
    if (disabled) return;
    const next = value - 1;
    if (min !== undefined && next < min) return;
    onChange(next);
  }

  function increment() {
    if (disabled) return;
    const next = value + 1;
    if (max !== undefined && next > max) return;
    onChange(next);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', minWidth: '60px' }}>{label}</span>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={decrement}
        disabled={disabled || (min !== undefined && value <= min)}
        style={{
          minWidth: 'var(--touch-target-min)',
          minHeight: 'var(--touch-target-min)',
          fontSize: 'var(--font-size-xl)',
          background: 'var(--color-surface-alt)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--color-text)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        −
      </button>
      <span style={{
        minWidth: '40px',
        textAlign: 'center',
        fontSize: 'var(--font-size-lg)',
        fontWeight: 'bold',
        color: 'var(--color-text)',
      }}>
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={increment}
        disabled={disabled || (max !== undefined && value >= max)}
        style={{
          minWidth: 'var(--touch-target-min)',
          minHeight: 'var(--touch-target-min)',
          fontSize: 'var(--font-size-xl)',
          background: 'var(--color-surface-alt)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--color-text)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        +
      </button>
    </div>
  );
}
