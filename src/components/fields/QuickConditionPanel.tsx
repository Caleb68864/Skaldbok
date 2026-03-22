import type { ConditionDefinition } from '../../types/system';

interface QuickConditionPanelProps {
  conditions: Record<string, boolean>;
  definitions: ConditionDefinition[];
  attributes: { id: string; abbreviation: string }[];
  onChange: (id: string, value: boolean) => void;
}

export function QuickConditionPanel({ conditions, definitions, attributes, onChange }: QuickConditionPanelProps) {
  function getAbbreviation(linkedAttributeId: string): string {
    const attr = attributes.find(a => a.id === linkedAttributeId);
    return attr ? attr.abbreviation : '';
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 'var(--space-sm)',
    }}>
      {definitions.map(def => {
        const active = !!conditions[def.id];
        const abbr = getAbbreviation(def.linkedAttributeId);

        return (
          <button
            key={def.id}
            type="button"
            onClick={() => onChange(def.id, !active)}
            style={{
              minHeight: '64px',
              minWidth: '64px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              borderRadius: 'var(--radius-md)',
              border: active ? '2px solid var(--color-danger)' : '2px solid var(--color-border)',
              backgroundColor: active ? 'var(--color-danger)' : 'var(--color-surface-alt)',
              color: active ? 'var(--color-text-inverse)' : 'var(--color-text)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: 'var(--space-xs)',
            }}
          >
            <span style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: active ? 'bold' : 'normal',
              lineHeight: 1.2,
            }}>
              {def.name}
            </span>
            {abbr && (
              <span style={{
                fontSize: 'var(--font-size-sm)',
                opacity: 0.7,
              }}>
                {abbr}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
