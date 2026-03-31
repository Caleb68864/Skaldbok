import { useActiveCharacter } from '../../context/ActiveCharacterContext';

interface AbilityPickerProps {
  onSelect: (abilityName: string) => void;
  onClose: () => void;
}

export function AbilityPicker({ onSelect, onClose }: AbilityPickerProps) {
  const { character } = useActiveCharacter();

  const abilities = character?.heroicAbilities ?? [];

  if (abilities.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
        No heroic abilities on active character.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {abilities.map(ability => (
        <button
          key={ability.id}
          onClick={() => { onSelect(ability.name); onClose(); }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            textAlign: 'left',
            padding: '12px',
            minHeight: '44px',
            background: 'none',
            border: 'none',
            borderBottom: '1px solid var(--color-border)',
            color: 'var(--color-text)',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          <span>{ability.name}</span>
          {ability.wpCost !== undefined && (
            <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
              {ability.wpCost} WP
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
