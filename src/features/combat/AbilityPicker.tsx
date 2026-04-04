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
      <p className="text-[var(--color-text-muted)] text-sm">
        No heroic abilities on active character.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {abilities.map(ability => (
        <button
          key={ability.id}
          onClick={() => { onSelect(ability.name); onClose(); }}
          className="flex justify-between items-center w-full text-left p-3 min-h-11 bg-transparent border-0 border-b border-b-[var(--color-border)] text-[var(--color-text)] cursor-pointer text-base"
        >
          <span>{ability.name}</span>
          {ability.wpCost !== undefined && (
            <span className="text-[var(--color-text-muted)] text-sm">
              {ability.wpCost} WP
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
