interface AttributeFieldProps {
  attributeId: string;
  abbreviation: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function AttributeField({ attributeId: _attributeId, abbreviation, value, min = 3, max = 18, onChange, disabled = false }: AttributeFieldProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-xs)',
      minWidth: '60px',
    }}>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>{abbreviation}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className={disabled ? 'field--locked' : 'field--editable'}
        style={{
          width: '56px',
          height: '56px',
          textAlign: 'center',
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'bold',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          background: disabled ? 'var(--color-surface)' : 'var(--color-surface-alt)',
          color: 'var(--color-text)',
          cursor: disabled ? 'default' : 'text',
        }}
      />
    </div>
  );
}
