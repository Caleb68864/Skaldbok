import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAppState } from '../context/AppStateContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { useAutosave } from '../hooks/useAutosave';
import { useFieldEditable, useIsEditMode } from '../utils/modeGuards';
import { AttributeField } from '../components/fields/AttributeField';
import { CharacterPortrait } from '../components/fields/CharacterPortrait';
import { ConditionToggleGroup } from '../components/fields/ConditionToggleGroup';
import { ResourceTracker } from '../components/fields/ResourceTracker';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { DerivedFieldDisplay } from '../components/fields/DerivedFieldDisplay';
import { getDerivedValue } from '../utils/derivedValues';
import { GameIcon } from '../components/primitives/GameIcon';
import { Modal } from '../components/primitives/Modal';
import { useToast } from '../context/ToastContext';
import { applyRoundRest, applyStretchRest, applyShiftRest } from '../utils/restActions';
import * as characterRepository from '../storage/repositories/characterRepository';
import { nowISO } from '../utils/dates';
import { useSessionLog } from '../features/session/useSessionLog';
import DraggableCardContainer from '../components/panels/DraggableCardContainer';
import type { PanelItem } from '../components/panels/DraggableCardContainer';

export default function SheetScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const { settings, updateSettings } = useAppState();
  const { system } = useSystemDefinition(character?.systemId ?? 'dragonbane');
  const { error: saveError } = useAutosave(character, characterRepository.save, 1000);
  const { showToast } = useToast();
  const { logHPChange, logDeathRoll, logRest } = useSessionLog();

  const isEditMode = useIsEditMode();
  const identityEditable = useFieldEditable('identity');
  const attributesEditable = useFieldEditable('attributes.str');
  const resourceMaxEditable = useFieldEditable('resources.hp.max');
  const derivedEditable = useFieldEditable('derivedOverrides');

  // Reorder mode state
  const [reorderMode, setReorderMode] = useState(false);

  // Death roll helpers (mirrored from CombatScreen)
  function updateDeathRollCurrent(id: string, value: number) {
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

  function updateDeathRolls(current: number) {
    if (!character) return;
    const prev = character.resources['deathRolls']?.current ?? 0;
    updateDeathRollCurrent('deathRolls', current);
    if (current > prev) logDeathRoll(character.name, current, false);
  }

  function updateDeathSuccesses(current: number) {
    if (!character) return;
    const prev = character.resources['deathSuccesses']?.current ?? 0;
    updateDeathRollCurrent('deathSuccesses', current);
    if (current > prev) logDeathRoll(character.name, current, true);
  }

  function resetDeathRolls() {
    updateDeathRollCurrent('deathRolls', 0);
    updateDeathRollCurrent('deathSuccesses', 0);
  }

  // Rest modal state
  const [roundRestOpen, setRoundRestOpen] = useState(false);
  const [roundRestWp, setRoundRestWp] = useState('');
  const [stretchRestOpen, setStretchRestOpen] = useState(false);
  const [stretchRestWp, setStretchRestWp] = useState('');
  const [stretchRestHp, setStretchRestHp] = useState('');
  const [stretchRestCondition, setStretchRestCondition] = useState('');

  useEffect(() => {
    if (!isLoading && !character) {
      navigate('/library');
    }
  }, [isLoading, character, navigate]);

  if (isLoading) return <div style={{ padding: 'var(--space-md)', color: 'var(--color-text)' }}>Loading...</div>;
  if (!character) return null;

  const isPlayMode = settings.mode === 'play';

  const DEFAULT_PANEL_ORDER = ['identity', 'attributes', 'resources', 'derived', 'rest'];
  const panelOrder = settings.sheetPanelOrder ?? DEFAULT_PANEL_ORDER;

  function updateAttr(id: string, delta: number) {
    if (!character) return;
    updateCharacter(prev => {
      const current = prev.attributes[id] ?? 10;
      return { attributes: { ...prev.attributes, [id]: current + delta }, updatedAt: nowISO() };
    });
  }

  function updateCondition(id: string, value: boolean) {
    if (!character) return;
    updateCharacter(prev => ({ conditions: { ...prev.conditions, [id]: value }, updatedAt: nowISO() }));
  }

  function updateResourceCurrent(id: string, delta: number) {
    if (!character) return;
    const oldCurrent = character.resources[id]?.current ?? 0;
    const maxVal = character.resources[id]?.max ?? 0;
    updateCharacter(prev => {
      const current = prev.resources[id]?.current ?? 0;
      return { resources: { ...prev.resources, [id]: { ...prev.resources[id], current: current + delta } }, updatedAt: nowISO() };
    });
    // Auto-log HP and WP changes to active session (debounced)
    if (id === 'hp' || id === 'wp') {
      logHPChange(character.name, oldCurrent, oldCurrent + delta, maxVal, id);
    }
  }

  function updateResourceMax(id: string, delta: number) {
    if (!character) return;
    updateCharacter(prev => {
      const max = prev.resources[id]?.max ?? 0;
      return { resources: { ...prev.resources, [id]: { ...prev.resources[id], max: max + delta } }, updatedAt: nowISO() };
    });
  }

  function updateMeta(field: string, value: string) {
    if (!character) return;
    updateCharacter({ metadata: { ...character.metadata, [field]: value }, updatedAt: nowISO() });
  }

  function setDerivedOverride(key: string, value: number) {
    if (!character) return;
    updateCharacter({ derivedOverrides: { ...character.derivedOverrides, [key]: value }, updatedAt: nowISO() });
  }

  function resetDerivedOverride(key: string) {
    if (!character) return;
    updateCharacter({ derivedOverrides: { ...character.derivedOverrides, [key]: null }, updatedAt: nowISO() });
  }

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
      logRest(character.name, 'Round Rest', `Recovered ${result.recovered} WP`);
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
    logRest(character.name, 'Stretch Rest', parts.join(' '));
    setStretchRestOpen(false);
    setStretchRestWp('');
    setStretchRestHp('');
    setStretchRestCondition('');
  }

  const inputStyle = (editable: boolean): React.CSSProperties => ({
    padding: 'var(--space-sm)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    background: editable ? 'var(--color-surface-alt)' : 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 'var(--font-size-md)',
    width: '100%',
    cursor: editable ? 'text' : 'default',
    opacity: editable ? 1 : 0.7,
  });

  // ---- Panel definitions ----
  const identityPanel = (
    <SectionPanel title="Identity" icon={<GameIcon name="person" size={18} />} collapsible defaultOpen>
      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
        <CharacterPortrait
          portraitUri={character.portraitUri}
          characterName={character.name}
          isEditMode={isEditMode}
          onPortraitChange={(dataUrl) => updateCharacter({ portraitUri: dataUrl, updatedAt: nowISO() })}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', flex: 1, minWidth: 0 }}>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Name</label>
            <input
              style={inputStyle(identityEditable)}
              value={character.name}
              disabled={!identityEditable}
              className={identityEditable ? 'field--editable' : 'field--locked'}
              onChange={e => updateCharacter({ name: e.target.value, updatedAt: nowISO() })}
            />
          </div>
          <div className="identity-meta-row">
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Kin</label>
              <input aria-label="Kin" style={inputStyle(identityEditable)} value={character.metadata.kin} disabled={!identityEditable} className={identityEditable ? 'field--editable' : 'field--locked'} onChange={e => updateMeta('kin', e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Profession</label>
              <input aria-label="Profession" style={inputStyle(identityEditable)} value={character.metadata.profession} disabled={!identityEditable} className={identityEditable ? 'field--editable' : 'field--locked'} onChange={e => updateMeta('profession', e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Age</label>
              <input aria-label="Age" style={inputStyle(identityEditable)} value={character.metadata.age ?? ''} disabled={!identityEditable} className={identityEditable ? 'field--editable' : 'field--locked'} onChange={e => updateMeta('age', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Weakness</label>
            <input aria-label="Weakness" style={inputStyle(identityEditable)} value={character.metadata.weakness ?? ''} disabled={!identityEditable} className={identityEditable ? 'field--editable' : 'field--locked'} onChange={e => updateMeta('weakness', e.target.value)} />
          </div>
        </div>
      </div>
    </SectionPanel>
  );

  const attributesPanel = (
    <>
      <SectionPanel title={`Attributes${isPlayMode ? ' (locked in Play Mode)' : ''}`} subtitle="p. 28-29" icon={<GameIcon name="biceps" size={18} />} collapsible defaultOpen>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', justifyContent: 'center' }}>
          {system?.attributes.map(attr => {
            const linked = system.conditions
              .filter(c => c.linkedAttributeId === attr.id)
              .map(def => ({ definition: def, active: !!character.conditions[def.id] }));
            return (
              <AttributeField
                key={attr.id}
                attributeId={attr.id}
                abbreviation={attr.abbreviation}
                value={character.attributes[attr.id] ?? 10}
                min={attr.min}
                max={attr.max}
                onChange={v => updateAttr(attr.id, v)}
                disabled={!attributesEditable}
                linkedConditions={linked}
                onConditionToggle={updateCondition}
              />
            );
          })}
        </div>
      </SectionPanel>
      {system && (() => {
        const linkedAttrIds = new Set(system.attributes.map(a => a.id));
        const orphanConditions = system.conditions.filter(c => !linkedAttrIds.has(c.linkedAttributeId));
        if (orphanConditions.length === 0) return null;
        return (
          <SectionPanel title="Conditions" subtitle="p. 56" collapsible defaultOpen>
            <ConditionToggleGroup
              conditions={character.conditions}
              definitions={orphanConditions}
              onChange={updateCondition}
            />
          </SectionPanel>
        );
      })()}
    </>
  );

  const resourcesPanel = (
    <SectionPanel title="Resources" subtitle="p. 55" icon={<GameIcon name="health-potion" size={18} />} collapsible defaultOpen>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {['hp', 'wp'].map(resId => {
          const res = character.resources[resId];
          if (!res) return null;
          const def = system?.resources.find(r => r.id === resId);
          return (
            <ResourceTracker
              key={resId}
              resourceId={resId}
              label={def?.name ?? resId.toUpperCase()}
              current={res.current}
              max={res.max}
              onCurrentChange={v => updateResourceCurrent(resId, v)}
              onMaxChange={v => updateResourceMax(resId, v)}
              maxEditable={resourceMaxEditable}
            />
          );
        })}
      </div>
    </SectionPanel>
  );

  const derivedPanel = (
    <SectionPanel title="Derived Values" icon={<GameIcon name="cog" size={18} />} collapsible defaultOpen>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {([
          { key: 'movement', label: 'Movement' },
          { key: 'hpMax', label: 'HP Max' },
          { key: 'wpMax', label: 'WP Max' },
          { key: 'damageBonus', label: 'STR Damage Bonus' },
          { key: 'aglDamageBonus', label: 'AGL Damage Bonus' },
        ] as const).map(({ key, label }) => {
          const dv = getDerivedValue(character, key);
          return (
            <DerivedFieldDisplay
              key={key}
              label={label}
              computedValue={dv.computed}
              override={dv.override as number | null}
              onOverride={v => setDerivedOverride(key, v)}
              onReset={() => resetDerivedOverride(key)}
              editable={derivedEditable}
            />
          );
        })}
      </div>
    </SectionPanel>
  );

  const restPanel = (
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
            logRest(character.name, 'Shift Rest', 'Fully recovered');
          }}
        >
          Shift Rest
        </button>
      </div>
    </SectionPanel>
  );

  // Death rolls panel (only rendered when HP == 0)
  const hp = character.resources['hp'] ?? { current: 0, max: 10 };
  const isDown = hp.current === 0;
  const deathRolls = character.resources['deathRolls'] ?? { current: 0, max: 3 };
  const deathSuccesses = character.resources['deathSuccesses'] ?? { current: 0, max: 3 };
  const deathRollFailures = deathRolls.current;
  const deathRollMax = deathRolls.max;
  const deathSuccessCount = deathSuccesses.current;
  const deathSuccessMax = deathSuccesses.max;

  const deathRollsPanel = isDown ? (
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-md)' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-md)', fontWeight: 'bold' }}>Failures:</span>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              {Array.from({ length: deathRollMax }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Death roll ${i + 1}`}
                  onClick={() => {
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
                    color: i < deathRollFailures ? 'var(--color-text-inverse, #fff)' : 'var(--color-danger)',
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
            <p style={{ color: 'var(--color-danger)', fontWeight: 'bold', fontSize: 'var(--font-size-lg)', textAlign: 'center' }}>
              DEAD
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-md)' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-md)', fontWeight: 'bold' }}>Successes:</span>
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
                    border: '2px solid var(--color-success, #27ae60)',
                    backgroundColor: i < deathSuccessCount ? 'var(--color-success, #27ae60)' : 'transparent',
                    color: i < deathSuccessCount ? '#fff' : 'var(--color-success, #27ae60)',
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
            <p style={{ color: 'var(--color-success, #27ae60)', fontWeight: 'bold', fontSize: 'var(--font-size-lg)', textAlign: 'center' }}>
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
  ) : null;

  // ---- Panel map & visibility ----
  const panelMap: Record<string, React.ReactNode> = {
    identity: identityPanel,
    attributes: attributesPanel,
    resources: resourcesPanel,
    derived: derivedPanel,
    rest: restPanel,
  };

  const panelVisibility: Record<string, boolean> = {
    identity: true,
    attributes: true,
    resources: true,
    derived: true,
    rest: isPlayMode,
  };

  const panelItems: PanelItem[] = panelOrder
    .filter(key => panelMap[key] !== undefined)
    .map(key => ({ key, element: panelMap[key] }));

  const handleOrderChange = (newOrder: string[]) => {
    updateSettings({ sheetPanelOrder: newOrder }).catch(console.error);
  };

  return (
    <div style={{ padding: 'var(--space-sm)' }}>
      {saveError && <div style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>{saveError}</div>}

      {isEditMode && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
          {reorderMode && (
            <button
              type="button"
              className="rest-btn rest-btn--round"
              onClick={() => {
                handleOrderChange(DEFAULT_PANEL_ORDER);
                showToast('Panel order reset to default.', 'info');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}
            >
              Reset Order
            </button>
          )}
          <button
            type="button"
            className={reorderMode ? 'rest-btn rest-btn--stretch' : 'rest-btn rest-btn--round'}
            onClick={() => setReorderMode(prev => !prev)}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}
          >
            <GameIcon name="cog" size={16} />
            {reorderMode ? 'Done Reordering' : 'Reorder Panels'}
          </button>
        </div>
      )}

      {reorderMode ? (
        <DraggableCardContainer
          panels={panelItems}
          cardOrder={panelOrder}
          panelVisibility={panelVisibility}
          isEditMode={isEditMode}
          onOrderChange={handleOrderChange}
        />
      ) : (
        <div className="sheet-grid">
          {panelOrder.filter(key => panelVisibility[key] !== false && panelMap[key] !== undefined).map(key => (
            <div key={key} className={key === 'identity' ? 'sheet-grid__full-width' : undefined}>
              {panelMap[key]}
              {/* Death rolls panel appears inline after Resources */}
              {key === 'resources' && deathRollsPanel}
            </div>
          ))}
        </div>
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
