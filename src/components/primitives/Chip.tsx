interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export function Chip({ label, active = false, onClick, disabled = false }: ChipProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'var(--touch-target-min)',
        minWidth: 'var(--touch-target-min)',
        padding: '0 var(--space-md)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        backgroundColor: active ? 'var(--color-primary)' : 'var(--color-surface-alt)',
        color: active ? 'var(--color-primary-text)' : 'var(--color-text)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontFamily: 'inherit',
        fontSize: 'var(--font-size-sm)',
        fontWeight: active ? 'bold' : 'normal',
      }}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
