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
  onChange: (value: number) => void;
  disabled?: boolean;
  linkedConditions?: LinkedCondition[];
  onConditionToggle?: (conditionId: string, value: boolean) => void;
}

export function AttributeField({ attributeId: _attributeId, abbreviation, value, min = 3, max = 18, onChange, disabled = false, linkedConditions, onConditionToggle }: AttributeFieldProps) {
  const stepperButtonStyle: React.CSSProperties = {
    minWidth: '48px',
    minHeight: '48px',
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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-xs)',
      minWidth: '60px',
    }}>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>{abbreviation}</span>
      {!disabled ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <button
            type="button"
            aria-label={`Decrease ${abbreviation}`}
            onClick={() => onChange(value - 1)}
            disabled={value <= min}
            style={stepperButtonStyle}
          >
            −
          </button>
          <span style={{
            minWidth: '40px',
            textAlign: 'center',
            fontSize: 'var(--size-2xl)',
            fontWeight: 'bold',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-display)',
          }}>
            {value}
          </span>
          <button
            type="button"
            aria-label={`Increase ${abbreviation}`}
            onClick={() => onChange(value + 1)}
            disabled={value >= max}
            style={stepperButtonStyle}
          >
            +
          </button>
        </div>
      ) : (
        <span style={{
          minWidth: '40px',
          textAlign: 'center',
          fontSize: 'var(--size-2xl)',
          fontWeight: 'bold',
          color: 'var(--color-text)',
          fontFamily: 'var(--font-display)',
        }}>
          {value}
        </span>
      )}
      {linkedConditions && linkedConditions.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-xs)',
          alignItems: 'center',
          width: '100%',
        }}>
          {linkedConditions.map(({ definition, active }) => (
            <button
              key={definition.id}
              type="button"
              role="switch"
              aria-checked={active}
              aria-label={`${definition.name} condition (${abbreviation})`}
              onClick={() => onConditionToggle?.(definition.id, !active)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'var(--touch-target-min)',
                minWidth: 'var(--touch-target-min)',
                padding: '0 var(--space-sm)',
                borderRadius: 'var(--radius-md)',
                border: active ? '2px solid var(--color-danger)' : '2px solid var(--color-border)',
                backgroundColor: active ? 'var(--color-danger)' : 'var(--color-surface-alt)',
                color: active ? '#fff' : 'var(--color-text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'var(--font-size-sm)',
                fontWeight: active ? 'bold' : 'normal',
              }}
            >
              {definition.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
