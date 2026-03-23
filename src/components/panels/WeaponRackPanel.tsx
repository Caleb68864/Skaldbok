import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { useIsEditMode } from '../../utils/modeGuards';
import { computeDamageBonus, computeAGLDamageBonus } from '../../utils/derivedValues';
import { nowISO } from '../../utils/dates';
import { ShieldCard } from '../fields/ShieldCard';
import type { Weapon } from '../../types/character';

function isRangedWeapon(weapon: Weapon): boolean {
  return weapon.range.toLowerCase() !== 'melee';
}

function buildDamageDisplay(weapon: Weapon, damageBonus: string, aglDamageBonus: string): string {
  const bonus = isRangedWeapon(weapon) ? aglDamageBonus : damageBonus;
  if (!bonus || bonus === '+0') {
    return weapon.damage;
  }
  return `${weapon.damage} ${bonus}`;
}

function getGripLabel(grip: Weapon['grip']): string {
  return grip === 'one-handed' ? '1H' : '2H';
}

type StrStatus = 'ok' | 'bane' | 'cannot';

function getStrStatus(str: number, requirement: number): StrStatus {
  if (str >= requirement) return 'ok';
  if (str >= Math.ceil(requirement / 2)) return 'bane';
  return 'cannot';
}

interface WeaponRackPanelProps {
  /** Optional navigation callback for empty state tap-to-navigate affordance */
  onNavigateToGear?: () => void;
}

export function WeaponRackPanel({ onNavigateToGear }: WeaponRackPanelProps = {}) {
  const { character, updateCharacter } = useActiveCharacter();
  const isEditMode = useIsEditMode();
  const isPlayMode = !isEditMode;

  if (!character) return null;

  const equippedWeapons = character.weapons.filter(w => w.equipped);
  const shields = equippedWeapons.filter(w => w.isShield === true);
  const regularWeapons = equippedWeapons.filter(w => w.isShield !== true);

  const damageBonus = computeDamageBonus(character);
  const aglDamageBonus = computeAGLDamageBonus(character);
  const str = character.attributes['str'] ?? 10;

  function handleMarkDamaged(weaponId: string) {
    const updated = character!.weapons.map(w =>
      w.id === weaponId ? { ...w, damaged: true } : w
    );
    updateCharacter({ weapons: updated, updatedAt: nowISO() });
  }

  function handleRepair(weaponId: string) {
    const updated = character!.weapons.map(w =>
      w.id === weaponId ? { ...w, damaged: false } : w
    );
    updateCharacter({ weapons: updated, updatedAt: nowISO() });
  }

  // Empty state
  if (equippedWeapons.length === 0) {
    return (
      <div className="weapon-rack-panel">
        <div className="weapon-rack__header">
          <span className="weapon-rack__title">Weapons</span>
        </div>
        <div
          className="weapon-rack__empty"
          role="button"
          tabIndex={0}
          aria-label="No weapons equipped. Tap to go to Gear screen."
          onClick={onNavigateToGear}
          onKeyDown={e => {
            if ((e.key === 'Enter' || e.key === ' ') && onNavigateToGear) {
              onNavigateToGear();
            }
          }}
        >
          <p>No weapons equipped. Equip weapons on the Gear screen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="weapon-rack-panel">
      <div className="weapon-rack__header">
        <span className="weapon-rack__title">Weapons</span>
      </div>

      {/* Regular weapon cards */}
      {regularWeapons.length > 0 && (
        <ul className="weapon-rack__list" role="list">
          {regularWeapons.map(weapon => {
            const isDamaged = weapon.damaged === true;
            const hasDurability = weapon.durability != null;
            const hasStrReq = weapon.strRequirement != null;
            const hasDamageType = weapon.damageType != null;
            const damageDisplay = buildDamageDisplay(weapon, damageBonus, aglDamageBonus);

            let strStatus: StrStatus = 'ok';
            if (hasStrReq) {
              strStatus = getStrStatus(str, weapon.strRequirement!);
            }

            const featuresList = weapon.features
              ? weapon.features.split(',').map(f => f.trim()).filter(Boolean)
              : [];

            return (
              <li key={weapon.id} className="weapon-card">
                {/* Name and type row */}
                <div className="weapon-card__title-row">
                  <h3 className="weapon-card__name">{weapon.name}</h3>
                  {hasDamageType && (
                    <span className={`weapon-badge weapon-badge--type weapon-badge--${weapon.damageType}`}>
                      {weapon.damageType}
                    </span>
                  )}
                </div>

                {/* Damage and grip row */}
                <div className="weapon-card__stats-row">
                  <span className="weapon-card__damage">{damageDisplay}</span>
                  <span className="weapon-card__sep">·</span>
                  <span className="weapon-card__grip">{getGripLabel(weapon.grip)}</span>
                  <span className="weapon-card__sep">·</span>
                  <span className="weapon-card__range">Range: {weapon.range}</span>
                </div>

                {/* Features */}
                {featuresList.length > 0 && (
                  <div className="weapon-card__features">
                    {featuresList.map((feat, i) => (
                      <span key={i} className="weapon-card__feature-tag">{feat}</span>
                    ))}
                  </div>
                )}

                {/* Durability */}
                {hasDurability && (
                  <div className="weapon-card__durability">
                    <span className="weapon-card__dur-label">Durability: {weapon.durability}</span>
                    {isDamaged ? (
                      <span className="weapon-badge weapon-badge--damaged" role="status">DAMAGED</span>
                    ) : (
                      <span className="weapon-badge weapon-badge--ok" role="status" aria-label="Durability OK">✓</span>
                    )}
                  </div>
                )}

                {/* STR requirement check */}
                {hasStrReq && (
                  <div className={`weapon-card__str-check weapon-card__str-check--${strStatus}`}>
                    {strStatus === 'ok' && (
                      <span>✓ STR {weapon.strRequirement} met</span>
                    )}
                    {strStatus === 'bane' && (
                      <span>⚠ Bane on attacks &amp; parries (STR {weapon.strRequirement} req.)</span>
                    )}
                    {strStatus === 'cannot' && (
                      <span>✗ Cannot use (STR {weapon.strRequirement} req.)</span>
                    )}
                  </div>
                )}

                {/* Play mode damaged/repair actions */}
                {isPlayMode && hasDurability && (
                  <div className="weapon-card__actions">
                    {isDamaged ? (
                      <button
                        type="button"
                        className="weapon-action-btn weapon-action-btn--repair"
                        onClick={() => handleRepair(weapon.id)}
                        aria-label={`Repair ${weapon.name}`}
                      >
                        Repair
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="weapon-action-btn weapon-action-btn--damage"
                        onClick={() => handleMarkDamaged(weapon.id)}
                        aria-label={`Mark ${weapon.name} as damaged`}
                      >
                        Mark Damaged
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Shield sub-cards */}
      {shields.length > 0 && (
        <div className="weapon-rack__shields">
          {shields.map(shield => (
            <ShieldCard
              key={shield.id}
              shield={shield}
              isPlayMode={isPlayMode}
              onMarkDamaged={handleMarkDamaged}
              onRepair={handleRepair}
            />
          ))}
        </div>
      )}
    </div>
  );
}
