import type { CharacterRecord } from '../../types/character';

export interface ResolvedMember {
  id: string;
  name: string;
  character: CharacterRecord | null;
}

const chipStyle = {
  minHeight: '44px',
  padding: '0 14px',
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: '22px',
  color: 'var(--color-text)',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 600,
  flexShrink: 0,
} as const;

export function PartyPicker({
  members,
  selected,
  onSelect,
  multiSelect,
}: {
  members: ResolvedMember[];
  selected: string[];
  onSelect: (ids: string[]) => void;
  multiSelect?: boolean;
}) {
  const isMulti = multiSelect !== false; // default true
  const toggle = (id: string) => {
    if (isMulti) {
      if (id === '__party__') {
        // Select all or deselect all
        if (selected.length === members.length) onSelect([]);
        else onSelect(members.map(m => m.id));
      } else {
        if (selected.includes(id)) onSelect(selected.filter(s => s !== id));
        else onSelect([...selected.filter(s => s !== '__party__'), id]);
      }
    } else {
      onSelect([id]);
    }
  };

  const isSelected = (id: string) => {
    if (id === '__party__') return selected.length === members.length && members.length > 0;
    return selected.includes(id);
  };

  // Disambiguate duplicate names by appending an index suffix
  const disambiguatedNames = members.map((m, idx) => {
    const sameNameCount = members.filter(other => other.name === m.name).length;
    if (sameNameCount > 1) {
      const rank = members.slice(0, idx + 1).filter(other => other.name === m.name).length;
      return { ...m, displayName: `${m.name} (${rank})` };
    }
    return { ...m, displayName: m.name };
  });

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        background: 'var(--color-surface)',
        paddingBottom: '8px',
        marginBottom: '4px',
        borderBottom: '1px solid var(--color-border)',
        zIndex: 1,
      }}
    >
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', marginTop: '0' }}>
        Who?
      </p>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {members.length > 1 && (
          <button
            onClick={() => toggle('__party__')}
            style={{
              ...chipStyle,
              background: isSelected('__party__') ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color: isSelected('__party__') ? 'var(--color-on-accent, #fff)' : 'var(--color-text)',
            }}
          >
            Party
          </button>
        )}
        {disambiguatedNames.map(m => (
          <button
            key={m.id}
            onClick={() => toggle(m.id)}
            style={{
              ...chipStyle,
              background: isSelected(m.id) ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color: isSelected(m.id) ? 'var(--color-on-accent, #fff)' : 'var(--color-text)',
            }}
          >
            {m.displayName}
          </button>
        ))}
      </div>
    </div>
  );
}
