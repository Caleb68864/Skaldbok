import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { computeMaxPreparedSpells } from '../../utils/derivedValues';
import { isMetalEquipped } from '../../utils/metalDetection';
import type { Spell } from '../../types/character';

/**
 * PreparedSpellsPanel — SS-06
 * Compact dashboard panel showing prepared spells with WP cost,
 * WP-availability dimming, and metal-equipment blocking.
 */

function isMagicTrick(spell: Spell): boolean {
  return spell.school.toLowerCase().includes('trick');
}

function getWpCost(spell: Spell): number {
  if (spell.wpCost !== undefined && spell.wpCost !== null) return spell.wpCost;
  return isMagicTrick(spell) ? 1 : 2;
}

export function PreparedSpellsPanel() {
  const { character } = useActiveCharacter();
  const navigate = useNavigate();

  // Hidden when no character or no spells
  if (!character) return null;
  if (!character.spells || character.spells.length === 0) return null;

  const allTricks = character.spells.every((s) => isMagicTrick(s));

  // ── Magic-trick-only view ─────────────────────────────────────────────
  if (allTricks) {
    return (
      <div className="prepared-spells-panel">
        <div className="prepared-spells-header">
          <span className="prepared-spells-title">Spells</span>
        </div>
        <p className="prepared-spells-tricks-note">Magic tricks are always prepared</p>
        <ul className="prepared-spells-list" role="list">
          {character.spells.map((spell) => {
            const wpCost = getWpCost(spell);
            return (
              <li key={spell.id}>
                <button
                  className="spell-entry"
                  onClick={() => navigate('/magic')}
                  type="button"
                  aria-label={`${spell.name} — ${wpCost} WP, navigate to Magic screen`}
                >
                  <span className="spell-entry-name">{spell.name}</span>
                  <span className="spell-entry-cost">{wpCost} WP</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // ── Standard prepared-spells view ────────────────────────────────────
  const preparedSpells = character.spells.filter((s) => s.prepared === true);
  const maxPrepared = computeMaxPreparedSpells(character);
  const metalBlocked = isMetalEquipped(character);
  const currentWP = character.resources?.wp?.current ?? 0;

  return (
    <div className="prepared-spells-panel">
      <div className="prepared-spells-header">
        <span className="prepared-spells-title">
          Prepared {preparedSpells.length}/{maxPrepared}
        </span>
      </div>

      {preparedSpells.length === 0 ? (
        <p className="prepared-spells-empty">No spells prepared.</p>
      ) : (
        <ul className="prepared-spells-list" role="list">
          {preparedSpells.map((spell) => {
            const wpCost = getWpCost(spell);
            // Metal blocking takes visual precedence over WP dimming
            const isBlocked = metalBlocked;
            const isDimmed = !metalBlocked && currentWP < wpCost;

            const entryClass = [
              'spell-entry',
              isBlocked ? 'spell-blocked' : '',
              isDimmed ? 'spell-dimmed' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <li key={spell.id}>
                <button
                  className={entryClass}
                  onClick={() => navigate('/magic')}
                  type="button"
                  aria-label={`${spell.name} — ${wpCost} WP${isBlocked ? ', blocked by metal' : isDimmed ? ', insufficient WP' : ''}`}
                >
                  <span className="spell-entry-name">{spell.name}</span>
                  <span className="spell-entry-cost">{wpCost} WP</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
