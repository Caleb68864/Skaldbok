import type { Weapon } from '../../types/character';

interface ShieldCardProps {
  shield: Weapon;
  isPlayMode: boolean;
  onMarkDamaged: (id: string) => void;
  onRepair: (id: string) => void;
}

export function ShieldCard({ shield, isPlayMode, onMarkDamaged, onRepair }: ShieldCardProps) {
  const isDamaged = shield.damaged === true;
  const hasDurability = shield.durability != null && shield.durability !== undefined;

  return (
    <div className="shield-card" aria-label={`Shield: ${shield.name}`}>
      <div className="shield-card__header">
        <span className="shield-card__icon" aria-hidden="true">🛡</span>
        <span className="shield-card__name">{shield.name}</span>
        <span className="shield-card__label">SHIELD</span>
      </div>

      {hasDurability && (
        <div className="shield-card__durability">
          <span className="shield-card__dur-label">Durability</span>
          <span className="shield-card__dur-value">{shield.durability}</span>
          {isDamaged ? (
            <span className="weapon-badge weapon-badge--damaged" role="status">DAMAGED</span>
          ) : (
            <span className="weapon-badge weapon-badge--ok" role="status" aria-label="Durability OK">✓</span>
          )}
        </div>
      )}

      {isPlayMode && hasDurability && (
        <div className="shield-card__actions">
          {isDamaged ? (
            <button
              type="button"
              className="weapon-action-btn weapon-action-btn--repair"
              onClick={() => onRepair(shield.id)}
              aria-label={`Repair ${shield.name}`}
            >
              Repair
            </button>
          ) : (
            <button
              type="button"
              className="weapon-action-btn weapon-action-btn--damage"
              onClick={() => onMarkDamaged(shield.id)}
              aria-label={`Mark ${shield.name} as damaged`}
            >
              Mark Damaged
            </button>
          )}
        </div>
      )}
    </div>
  );
}
