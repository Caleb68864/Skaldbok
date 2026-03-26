import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAppState } from '../context/AppStateContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { useAutosave } from '../hooks/useAutosave';
import { CombatResourcePanel } from '../components/fields/CombatResourcePanel';
import { QuickConditionPanel } from '../components/fields/QuickConditionPanel';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { Modal } from '../components/primitives/Modal';
import { GameIcon } from '../components/primitives/GameIcon';
import { useToast } from '../context/ToastContext';
import { applyRoundRest, applyStretchRest, applyShiftRest } from '../utils/restActions';
import * as characterRepository from '../storage/repositories/characterRepository';
import { nowISO } from '../utils/dates';

export default function CombatScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const { settings } = useAppState();
  const { system } = useSystemDefinition(character?.systemId ?? 'dragonbane');
  const { error: saveError } = useAutosave(character, characterRepository.save, 1000);
  const { showToast } = useToast();

  // Rest modal state
  const [roundRestOpen, setRoundRestOpen] = useState(false);
  const [roundRestWp, setRoundRestWp] = useState('');
  const [stretchRestOpen, setStretchRestOpen] = useState(false);
  const [stretchRestWp, setStretchRestWp] = useState('');
  const [stretchRestHp, setStretchRestHp] = useState('');
  const [stretchRestCondition, setStretchRestCondition] = useState('');

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
    updateCharacter(prev => {
      const res = prev.resources[id];
      if (!res) return {};
      return {
        resources: { ...prev.resources, [id]: { ...res, current: value } },
        updatedAt: nowISO(),
      };
    });
  }

  function updateCondition(id: string, value: boolean) {
    if (!character) return;
    updateCharacter(prev => ({
      conditions: { ...prev.conditions, [id]: value },
      updatedAt: nowISO(),
    }));
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

  const isPlayMode = settings.mode === 'play';

  function confirmRoundRest() {
    if (!character) return;
    const roll = parseInt(roundRestWp, 10);
    if (isNaN(roll) || roll < 1 || roll > 6) {
      showToast('Please enter a value between 1 and 6.', 'error');
      return;
    }
    const result = applyRoundRest(character, roll);
    if (result.alreadyFull && result.recovered === 0) {
      showToast('Already at full WP.', 'info');
    } else {
      updateCharacter({
        resources: { ...character.resources, wp: { ...character.resources['wp'], current: result.newWpCurrent } },
        updatedAt: nowISO(),
      });
      showToast(`Recovered ${result.recovered} WP.`, 'success');
    }
    setRoundRestOpen(false);
    setRoundRestWp('');
  }

  function confirmStretchRest() {
    if (!character) return;
    const wpRoll = parseInt(stretchRestWp, 10);
    const hpRoll = parseInt(stretchRestHp, 10);
    if (isNaN(wpRoll) || wpRoll < 1 || wpRoll > 6) {
      showToast('Please enter a WP d6 value between 1 and 6.', 'error');
      return;
    }
    if (isNaN(hpRoll) || hpRoll < 1 || hpRoll > 6) {
      showToast('Please enter an HP d6 value between 1 and 6.', 'error');
      return;
    }
    const result = applyStretchRest(character, wpRoll, hpRoll, stretchRestCondition || undefined);
    const updatedResources = {
      ...character.resources,
      wp: { ...character.resources['wp'], current: result.newWpCurrent },
      hp: { ...character.resources['hp'], current: result.newHpCurrent },
    };
    const updatedConditions = result.conditionCleared
      ? { ...character.conditions, [result.conditionCleared]: false }
      : character.conditions;
    updateCharacter({ resources: updatedResources, conditions: updatedConditions, updatedAt: nowISO() });

    const parts: string[] = [];
    if (result.alreadyFullWp) {
      parts.push('Already at full WP.');
    } else {
      parts.push('WP restored to max.');
    }
    if (result.alreadyFullHp && result.hpRecovered === 0) {
      parts.push('Already at full HP.');
    } else {
      parts.push(`Recovered ${result.hpRecovered} HP.`);
    }
    if (result.conditionCleared) {
      const condDef = system?.conditions.find(c => c.id === result.conditionCleared);
      const condName = condDef?.name ?? result.conditionCleared;
      parts.push(`Cleared ${condName}.`);
    }
    showToast(parts.join(' '), 'success');
    setStretchRestOpen(false);
    setStretchRestWp('');
    setStretchRestHp('');
    setStretchRestCondition('');
  }

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
      <SectionPanel title="Resources" subtitle="p. 55" collapsible defaultOpen>
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

      {/* Death Rolls — only visible when HP is 0 */}
      {isDown && (
      <SectionPanel title="Death Rolls" subtitle="p. 55" collapsible defaultOpen>
        <div style={{
          padding: 'var(--space-sm)',
          borderRadius: 'var(--radius-md)',
          border: '2px solid var(--color-danger)',
          backgroundColor: 'rgba(224, 85, 85, 0.1)',
        }}>
            <p style={{
              color: 'var(--color-danger)',
              fontWeight: 'bold',
              fontSize: 'var(--font-size-md)',
              textAlign: 'center',
              marginBottom: 'var(--space-sm)',
            }}>
              Character is DOWN!
            </p>
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
        </div>
      </SectionPanel>
      )}

      {/* Conditions */}
      <SectionPanel title="Conditions" subtitle="p. 56" collapsible defaultOpen>
        {system && (
          <QuickConditionPanel
            conditions={character.conditions}
            definitions={system.conditions}
            attributes={system.attributes}
            onChange={updateCondition}
          />
        )}
      </SectionPanel>

      {/* Equipment — Quick Equip */}
      <SectionPanel title="Equipment" subtitle="p. 73-77" collapsible defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {/* Weapons */}
          <div>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontWeight: 'bold' }}>
              Weapons
            </span>
            {character.weapons.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic' }}>
                No weapons. Add weapons on the Gear page.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', marginTop: 'var(--space-xs)' }}>
                {character.weapons.map(w => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      const updated = character.weapons.map(wp =>
                        wp.id === w.id ? { ...wp, equipped: !wp.equipped } : wp
                      );
                      updateCharacter({ weapons: updated, updatedAt: nowISO() });
                    }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 'var(--space-sm)',
                      backgroundColor: w.equipped ? 'var(--color-surface-alt)' : 'transparent',
                      borderRadius: 'var(--radius-sm)',
                      border: w.equipped ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      opacity: w.equipped ? 1 : 0.6,
                      minHeight: 'var(--touch-target-min)',
                    }}
                  >
                    <span style={{ color: 'var(--color-text)', fontWeight: w.equipped ? 'bold' : 'normal' }}>
                      {w.equipped ? '\u2694\uFE0F ' : ''}{w.name}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                      {w.grip} | {w.damage} | {w.range}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Armor */}
          <div>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontWeight: 'bold' }}>
              Armor
            </span>
            {character.armor ? (
              <button
                type="button"
                onClick={() => {
                  updateCharacter(prev => ({
                    armor: prev.armor ? { ...prev.armor, equipped: !prev.armor.equipped } : prev.armor,
                    updatedAt: nowISO(),
                  }));
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-sm)',
                  backgroundColor: character.armor.equipped ? 'var(--color-surface-alt)' : 'transparent',
                  borderRadius: 'var(--radius-sm)',
                  border: character.armor.equipped ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  opacity: character.armor.equipped ? 1 : 0.6,
                  minHeight: 'var(--touch-target-min)',
                  marginTop: 'var(--space-xs)',
                }}
              >
                <span style={{ color: 'var(--color-text)', fontWeight: character.armor.equipped ? 'bold' : 'normal' }}>
                  {character.armor.equipped ? '\uD83D\uDEE1\uFE0F ' : ''}{character.armor.name}
                </span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  AR {character.armor.rating}
                </span>
              </button>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic' }}>
                No armor.
              </p>
            )}
          </div>

          {/* Helmet */}
          <div>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontWeight: 'bold' }}>
              Helmet
            </span>
            {character.helmet ? (
              <button
                type="button"
                onClick={() => {
                  updateCharacter(prev => ({
                    helmet: prev.helmet ? { ...prev.helmet, equipped: !prev.helmet.equipped } : prev.helmet,
                    updatedAt: nowISO(),
                  }));
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-sm)',
                  backgroundColor: character.helmet.equipped ? 'var(--color-surface-alt)' : 'transparent',
                  borderRadius: 'var(--radius-sm)',
                  border: character.helmet.equipped ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  opacity: character.helmet.equipped ? 1 : 0.6,
                  minHeight: 'var(--touch-target-min)',
                  marginTop: 'var(--space-xs)',
                }}
              >
                <span style={{ color: 'var(--color-text)', fontWeight: character.helmet.equipped ? 'bold' : 'normal' }}>
                  {character.helmet.equipped ? '\uD83D\uDEE1\uFE0F ' : ''}{character.helmet.name}
                </span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  AR {character.helmet.rating}
                </span>
              </button>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic' }}>
                No helmet.
              </p>
            )}
          </div>
        </div>
      </SectionPanel>

      {/* Round Tracker */}
      <SectionPanel title="Round Tracker" subtitle="p. 46" collapsible defaultOpen>
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

      {/* Rest & Recovery — play mode only */}
      {isPlayMode && (
        <SectionPanel title="Rest & Recovery" subtitle="p. 55, 57" icon={<GameIcon name="health-potion" size={18} />} collapsible defaultOpen>
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="rest-btn rest-btn--round"
              onClick={() => setRoundRestOpen(true)}
            >
              Round Rest
            </button>
            <button
              type="button"
              className="rest-btn rest-btn--stretch"
              onClick={() => setStretchRestOpen(true)}
            >
              Stretch Rest
            </button>
            <button
              type="button"
              className="rest-btn rest-btn--stretch"
              onClick={() => {
                if (!character || !system) return;
                const result = applyShiftRest(character);
                const updatedResources = {
                  ...character.resources,
                  hp: { ...character.resources['hp'], current: character.resources['hp']?.max ?? 0 },
                  wp: { ...character.resources['wp'], current: character.resources['wp']?.max ?? 0 },
                };
                const clearedConditions = Object.fromEntries(
                  Object.keys(character.conditions).map(id => [id, false])
                );
                updateCharacter({ resources: updatedResources, conditions: clearedConditions, updatedAt: nowISO() });
                const parts: string[] = [];
                parts.push(result.hpRestored > 0 ? `Restored ${result.hpRestored} HP.` : 'HP already full.');
                parts.push(result.wpRestored > 0 ? `Restored ${result.wpRestored} WP.` : 'WP already full.');
                if (result.conditionsCleared.length > 0) {
                  const names = result.conditionsCleared.map(id => system.conditions.find(c => c.id === id)?.name ?? id);
                  parts.push(`Cleared ${names.join(', ')}.`);
                }
                showToast(parts.join(' '), 'success');
              }}
            >
              Shift Rest
            </button>
          </div>
        </SectionPanel>
      )}

      {/* Round Rest Modal */}
      <Modal
        open={roundRestOpen}
        onClose={() => { setRoundRestOpen(false); setRoundRestWp(''); }}
        title="Round Rest"
        actions={
          <>
            <button
              type="button"
              className="rest-modal-btn rest-modal-btn--cancel"
              onClick={() => { setRoundRestOpen(false); setRoundRestWp(''); }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rest-modal-btn rest-modal-btn--confirm"
              onClick={confirmRoundRest}
            >
              Confirm
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <p style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-md)' }}>
            Roll a d6 for WP recovery.
          </p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            d6 Result (1–6)
            <input
              type="number"
              min={1}
              max={6}
              value={roundRestWp}
              onChange={e => setRoundRestWp(e.target.value)}
              className="rest-modal-input"
              placeholder="Enter 1–6"
            />
          </label>
        </div>
      </Modal>

      {/* Stretch Rest Modal */}
      <Modal
        open={stretchRestOpen}
        onClose={() => { setStretchRestOpen(false); setStretchRestWp(''); setStretchRestHp(''); setStretchRestCondition(''); }}
        title="Stretch Rest"
        actions={
          <>
            <button
              type="button"
              className="rest-modal-btn rest-modal-btn--cancel"
              onClick={() => { setStretchRestOpen(false); setStretchRestWp(''); setStretchRestHp(''); setStretchRestCondition(''); }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rest-modal-btn rest-modal-btn--confirm"
              onClick={confirmStretchRest}
            >
              Confirm
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <p style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-md)' }}>
            Roll d6 for WP and HP recovery. WP is fully restored. HP is recovered by your roll result.
          </p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            WP d6 Result (1–6)
            <input
              type="number"
              min={1}
              max={6}
              value={stretchRestWp}
              onChange={e => setStretchRestWp(e.target.value)}
              className="rest-modal-input"
              placeholder="Enter 1–6"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            HP d6 Result (1–6)
            <input
              type="number"
              min={1}
              max={6}
              value={stretchRestHp}
              onChange={e => setStretchRestHp(e.target.value)}
              className="rest-modal-input"
              placeholder="Enter 1–6"
            />
          </label>
          {system && system.conditions.length > 0 && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              Clear a Condition (optional)
              <select
                value={stretchRestCondition}
                onChange={e => setStretchRestCondition(e.target.value)}
                className="rest-modal-input"
              >
                <option value="">— None —</option>
                {system.conditions
                  .filter(c => character.conditions[c.id])
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
            </label>
          )}
        </div>
      </Modal>
    </div>
  );
}
