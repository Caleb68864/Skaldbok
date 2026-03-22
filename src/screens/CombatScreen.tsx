import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { useAutosave } from '../hooks/useAutosave';
import { CombatResourcePanel } from '../components/fields/CombatResourcePanel';
import { QuickConditionPanel } from '../components/fields/QuickConditionPanel';
import { SectionPanel } from '../components/primitives/SectionPanel';
import * as characterRepository from '../storage/repositories/characterRepository';
import { nowISO } from '../utils/dates';

export default function CombatScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const { system } = useSystemDefinition(character?.systemId ?? 'dragonbane');
  const { error: saveError } = useAutosave(character, characterRepository.save, 1000);

  if (isLoading) return <div style={{ padding: 'var(--space-md)', color: 'var(--color-text)' }}>Loading...</div>;
  if (!character) {
    navigate('/library');
    return null;
  }

  const hp = character.resources['hp'] ?? { current: 0, max: 10 };
  const wp = character.resources['wp'] ?? { current: 0, max: 10 };
  const deathRolls = character.resources['deathRolls'] ?? { current: 0, max: 3 };
  const deathSuccesses = character.resources['deathSuccesses'] ?? { current: 0, max: 3 };
  const isDown = hp.current === 0;

  function updateResourceCurrent(id: string, value: number) {
    if (!character) return;
    const res = character.resources[id];
    if (!res) return;
    updateCharacter({
      resources: { ...character.resources, [id]: { ...res, current: value } },
      updatedAt: nowISO(),
    });
  }

  function updateCondition(id: string, value: boolean) {
    if (!character) return;
    updateCharacter({
      conditions: { ...character.conditions, [id]: value },
      updatedAt: nowISO(),
    });
  }

  function updateDeathRolls(current: number) {
    updateResourceCurrent('deathRolls', current);
  }

  function updateDeathSuccesses(current: number) {
    updateResourceCurrent('deathSuccesses', current);
  }

  function resetDeathRolls() {
    updateResourceCurrent('deathRolls', 0);
    updateResourceCurrent('deathSuccesses', 0);
  }

  // Equipped weapons
  const equippedWeapons = character.weapons.filter(w => w.equipped);

  // Death roll display: show as success/failure marks out of 3
  // In Dragonbane, death rolls track failures. We use deathRolls.current as failure count.
  const deathRollFailures = deathRolls.current;
  const deathRollMax = deathRolls.max;
  const deathSuccessCount = deathSuccesses.current;
  const deathSuccessMax = deathSuccesses.max;

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      {saveError && (
        <div style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
          {saveError}
        </div>
      )}

      {/* HP and WP Counters */}
      <SectionPanel title="Resources" collapsible defaultOpen>
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <CombatResourcePanel
            label="HP"
            current={hp.current}
            max={hp.max}
            colorVar="var(--color-danger)"
            lowThreshold={Math.ceil(hp.max * 0.25)}
            onDecrement={() => updateResourceCurrent('hp', Math.max(0, hp.current - 1))}
            onIncrement={() => updateResourceCurrent('hp', Math.min(hp.max, hp.current + 1))}
          />
          <CombatResourcePanel
            label="WP"
            current={wp.current}
            max={wp.max}
            colorVar="var(--color-accent)"
            lowThreshold={Math.ceil(wp.max * 0.25)}
            onDecrement={() => updateResourceCurrent('wp', Math.max(0, wp.current - 1))}
            onIncrement={() => updateResourceCurrent('wp', Math.min(wp.max, wp.current + 1))}
          />
        </div>
      </SectionPanel>

      {/* Death Rolls */}
      <SectionPanel title="Death Rolls" collapsible defaultOpen>
        <div style={{
          padding: 'var(--space-sm)',
          borderRadius: 'var(--radius-md)',
          border: isDown ? '2px solid var(--color-danger)' : '1px solid var(--color-border)',
          backgroundColor: isDown ? 'rgba(224, 85, 85, 0.1)' : 'transparent',
        }}>
          {isDown && (
            <p style={{
              color: 'var(--color-danger)',
              fontWeight: 'bold',
              fontSize: 'var(--font-size-md)',
              textAlign: 'center',
              marginBottom: 'var(--space-sm)',
            }}>
              Character is DOWN!
            </p>
          )}
          {isDown && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-md)',
              }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-md)', fontWeight: 'bold' }}>
                  Failures:
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  {Array.from({ length: deathRollMax }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Death roll ${i + 1}`}
                      onClick={() => {
                        // Toggle: if clicking the last filled one, remove it; otherwise fill up to this one
                        if (i < deathRollFailures) {
                          updateDeathRolls(i);
                        } else {
                          updateDeathRolls(i + 1);
                        }
                      }}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        border: '2px solid var(--color-danger)',
                        backgroundColor: i < deathRollFailures ? 'var(--color-danger)' : 'transparent',
                        color: i < deathRollFailures ? 'var(--color-text-inverse)' : 'var(--color-danger)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 'bold',
                      }}
                    >
                      {i < deathRollFailures ? '\u2716' : ''}
                    </button>
                  ))}
                </div>
              </div>
              {deathRollFailures >= deathRollMax && (
                <p style={{
                  color: 'var(--color-danger)',
                  fontWeight: 'bold',
                  fontSize: 'var(--font-size-lg)',
                  textAlign: 'center',
                }}>
                  DEAD
                </p>
              )}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-md)',
              }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-md)', fontWeight: 'bold' }}>
                  Successes:
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  {Array.from({ length: deathSuccessMax }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Death success ${i + 1}`}
                      onClick={() => {
                        if (i < deathSuccessCount) {
                          updateDeathSuccesses(i);
                        } else {
                          updateDeathSuccesses(i + 1);
                        }
                      }}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        border: '2px solid var(--color-success)',
                        backgroundColor: i < deathSuccessCount ? 'var(--color-success)' : 'transparent',
                        color: i < deathSuccessCount ? 'var(--color-text-inverse)' : 'var(--color-success)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 'bold',
                      }}
                    >
                      {i < deathSuccessCount ? '\u2714' : ''}
                    </button>
                  ))}
                </div>
              </div>
              {deathSuccessCount >= deathSuccessMax && (
                <p style={{
                  color: 'var(--color-success)',
                  fontWeight: 'bold',
                  fontSize: 'var(--font-size-lg)',
                  textAlign: 'center',
                }}>
                  Stabilized!
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-sm)' }}>
                <button
                  type="button"
                  aria-label="Reset death rolls"
                  onClick={resetDeathRolls}
                  style={{
                    minWidth: 'var(--touch-target-min)',
                    minHeight: 'var(--touch-target-min)',
                    fontSize: 'var(--font-size-sm)',
                    background: 'var(--color-surface-alt)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: '0 var(--space-sm)',
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </SectionPanel>

      {/* Conditions */}
      <SectionPanel title="Conditions" collapsible defaultOpen>
        {system && (
          <QuickConditionPanel
            conditions={character.conditions}
            definitions={system.conditions}
            attributes={system.attributes}
            onChange={updateCondition}
          />
        )}
      </SectionPanel>

      {/* Equipment Summary */}
      <SectionPanel title="Equipment" collapsible defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {/* Weapons */}
          <div>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontWeight: 'bold' }}>
              Weapons
            </span>
            {equippedWeapons.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic' }}>
                No weapons equipped.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', marginTop: 'var(--space-xs)' }}>
                {equippedWeapons.map(w => (
                  <div key={w.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-sm)',
                    backgroundColor: 'var(--color-surface-alt)',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    <span style={{ color: 'var(--color-text)', fontWeight: 'bold' }}>
                      {w.name}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                      {w.grip} | Dmg: {w.damage} | Range: {w.range}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Armor */}
          <div>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontWeight: 'bold' }}>
              Armor
            </span>
            {character.armor && character.armor.equipped ? (
              <p style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-md)', marginTop: 'var(--space-xs)' }}>
                {character.armor.name} (rating {character.armor.rating})
              </p>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic' }}>
                No armor equipped.
              </p>
            )}
          </div>

          {/* Helmet */}
          <div>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontWeight: 'bold' }}>
              Helmet
            </span>
            {character.helmet && character.helmet.equipped ? (
              <p style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-md)', marginTop: 'var(--space-xs)' }}>
                {character.helmet.name} (rating {character.helmet.rating})
              </p>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic' }}>
                No helmet equipped.
              </p>
            )}
          </div>
        </div>
      </SectionPanel>

      {/* Round Tracker */}
      <SectionPanel title="Round Tracker" collapsible defaultOpen>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-md)',
          padding: 'var(--space-sm)',
        }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
            Use this area to track initiative and round count during combat. Round tracking is managed by your GM.
          </p>
        </div>
      </SectionPanel>
    </div>
  );
}
