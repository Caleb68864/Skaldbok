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
import { getDerivedValue, getEffectiveValue } from '../utils/derivedValues';
import { BuffChipBar } from '../components/panels/BuffChipBar';
import { AddModifierDrawer } from '../components/panels/AddModifierDrawer';
import type { TempModifier } from '../types/character';
import { GameIcon } from '../components/primitives/GameIcon';
import { Modal } from '../components/primitives/Modal';
import { useToast } from '../context/ToastContext';
import { applyRoundRest, applyStretchRest, applyShiftRest } from '../utils/restActions';
import * as characterRepository from '../storage/repositories/characterRepository';
import { nowISO } from '../utils/dates';
import { cn } from '../lib/utils';
import { useSessionLog } from '../features/session/useSessionLog';
import DraggableCardContainer from '../components/panels/DraggableCardContainer';
import type { PanelItem } from '../components/panels/DraggableCardContainer';

/**
 * The character Sheet screen — shows the full character sheet for the active character.
 *
 * @remarks
 * Renders a grid of collapsible section panels covering Identity, Attributes,
 * Resources, Derived Values, and Rest & Recovery.  The panel order is
 * persisted per-user via {@link AppSettings.sheetPanelOrder} and can be
 * rearranged in Edit Mode using the {@link DraggableCardContainer}.
 *
 * **Edit Mode** unlocks all identity, attribute, resource-max, and derived
 * override fields and shows the "Reorder Panels" control.
 *
 * **Play Mode** locks attribute and identity fields; only HP/WP counters,
 * conditions, rest buttons, and derived-value overrides remain interactive.
 *
 * **Death Rolls panel** — automatically inserted after the Resources panel
 * when the character's HP reaches 0.  Tracks both failure and success pips
 * (Dragonbane p. 55).
 *
 * **Rest modals** — Round Rest and Stretch Rest open modal dialogs that accept
 * a d6 roll and apply the appropriate recovery rules.  Shift Rest is applied
 * immediately via a single button click.  All rest events are logged to the
 * active session log via {@link useSessionLog}.
 *
 * Autosaves on every character mutation via {@link useAutosave} with a 1-second
 * debounce.  Navigates to `/library` if no character is loaded.
 *
 * @returns The character sheet UI, or a loading indicator, or `null` while
 *   redirecting.
 */
export default function SheetScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const { settings, updateSettings, isLoading: settingsLoading } = useAppState();
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

  // Temp modifier state
  const [addModifierOpen, setAddModifierOpen] = useState(false);
  const [expiryCheck, setExpiryCheck] = useState<{
    restType: 'round' | 'stretch' | 'shift';
    expiring: TempModifier[];
  } | null>(null);

  useEffect(() => {
    const stillLoading = settingsLoading || isLoading;
    const waitingForCharacter = !settingsLoading && !isLoading && !!settings.activeCharacterId && !character;
    if (!stillLoading && !waitingForCharacter && !character) {
      navigate('/library');
    }
  }, [settingsLoading, isLoading, settings.activeCharacterId, character, navigate]);

  const stillLoading = settingsLoading || isLoading;
  const waitingForCharacter = !settingsLoading && !isLoading && !!settings.activeCharacterId && !character;

  if (stillLoading || waitingForCharacter) return <div className="p-[var(--space-md)] text-[var(--color-text)]">Loading...</div>;
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

  // ---- Temp modifier handlers ----
  function handleAddModifier(partial: Omit<TempModifier, 'id' | 'createdAt'>) {
    if (!character) return;
    const newMod: TempModifier = {
      ...partial,
      id: crypto.randomUUID(),
      createdAt: nowISO(),
    };
    updateCharacter({ tempModifiers: [...(character.tempModifiers ?? []), newMod], updatedAt: nowISO() });
  }

  function handleRemoveModifier(id: string) {
    if (!character) return;
    updateCharacter({ tempModifiers: (character.tempModifiers ?? []).filter(m => m.id !== id), updatedAt: nowISO() });
  }

  function handleClearAllModifiers() {
    if (!character) return;
    updateCharacter({ tempModifiers: [], updatedAt: nowISO() });
  }

  const DURATION_TO_REST: Record<string, 'round' | 'stretch' | 'shift'> = {
    round: 'round',
    stretch: 'stretch',
    shift: 'shift',
  };

  function getExpiringModifiers(restType: 'round' | 'stretch' | 'shift'): TempModifier[] {
    if (!character) return [];
    return (character.tempModifiers ?? []).filter(m => DURATION_TO_REST[m.duration] === restType);
  }

  function handleRestWithExpiryCheck(restType: 'round' | 'stretch' | 'shift', openRest: () => void) {
    const expiring = getExpiringModifiers(restType);
    if (expiring.length > 0) {
      setExpiryCheck({ restType, expiring });
    } else {
      openRest();
    }
  }

  function handleExpiryRemoveAndRest() {
    if (!character || !expiryCheck) return;
    const expiringIds = new Set(expiryCheck.expiring.map(m => m.id));
    const remaining = (character.tempModifiers ?? []).filter(m => !expiringIds.has(m.id));
    updateCharacter({ tempModifiers: remaining, updatedAt: nowISO() });
    const names = expiryCheck.expiring.map(m => m.label).join(', ');
    logRest(character.name, `${expiryCheck.restType.charAt(0).toUpperCase() + expiryCheck.restType.slice(1)} Rest`, `Expired modifiers: ${names}`);
    const restType = expiryCheck.restType;
    setExpiryCheck(null);
    if (restType === 'round') setRoundRestOpen(true);
    else if (restType === 'stretch') setStretchRestOpen(true);
    else handleShiftRestDirect();
  }

  function handleExpiryKeepAndRest() {
    if (!expiryCheck) return;
    const restType = expiryCheck.restType;
    setExpiryCheck(null);
    if (restType === 'round') setRoundRestOpen(true);
    else if (restType === 'stretch') setStretchRestOpen(true);
    else handleShiftRestDirect();
  }

  function handleShiftRestDirect() {
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

  const inputClass = (editable: boolean) => cn(
    "p-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text)] text-[length:var(--font-size-md)] w-full",
    editable
      ? "bg-[var(--color-surface-alt)] cursor-text opacity-100"
      : "bg-[var(--color-surface)] cursor-default opacity-70"
  );

  // ---- Panel definitions ----
  const identityPanel = (
    <SectionPanel title="Identity" icon={<GameIcon name="person" size={18} />} collapsible defaultOpen>
      <div className="flex gap-[var(--space-md)] items-start">
        <CharacterPortrait
          portraitUri={character.portraitUri}
          characterName={character.name}
          isEditMode={isEditMode}
          onPortraitChange={(dataUrl) => updateCharacter({ portraitUri: dataUrl, updatedAt: nowISO() })}
        />
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          <div>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Name</label>
            <input
              className={cn(inputClass(identityEditable), identityEditable ? 'field--editable' : 'field--locked')}
              value={character.name}
              disabled={!identityEditable}
              onChange={e => updateCharacter({ name: e.target.value, updatedAt: nowISO() })}
            />
          </div>
          <div className="identity-meta-row">
            <div>
              <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Kin</label>
              <input aria-label="Kin" className={cn(inputClass(identityEditable), identityEditable ? 'field--editable' : 'field--locked')} value={character.metadata.kin} disabled={!identityEditable} onChange={e => updateMeta('kin', e.target.value)} />
            </div>
            <div>
              <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Profession</label>
              <input aria-label="Profession" className={cn(inputClass(identityEditable), identityEditable ? 'field--editable' : 'field--locked')} value={character.metadata.profession} disabled={!identityEditable} onChange={e => updateMeta('profession', e.target.value)} />
            </div>
            <div>
              <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Age</label>
              <input aria-label="Age" className={cn(inputClass(identityEditable), identityEditable ? 'field--editable' : 'field--locked')} value={character.metadata.age ?? ''} disabled={!identityEditable} onChange={e => updateMeta('age', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Weakness</label>
            <input aria-label="Weakness" className={cn(inputClass(identityEditable), identityEditable ? 'field--editable' : 'field--locked')} value={character.metadata.weakness ?? ''} disabled={!identityEditable} onChange={e => updateMeta('weakness', e.target.value)} />
          </div>
        </div>
      </div>
    </SectionPanel>
  );

  const attributesPanel = (
    <>
      <SectionPanel title={`Attributes${isPlayMode ? ' (locked in Play Mode)' : ''}`} subtitle="p. 28-29" icon={<GameIcon name="biceps" size={18} />} collapsible defaultOpen>
        <div className="flex flex-wrap gap-[var(--space-md)] justify-center">
          {system?.attributes.map(attr => {
            const ev = getEffectiveValue(attr.id, character);
            const linked = system.conditions
              .filter(c => c.linkedAttributeId === attr.id)
              .map(def => ({ definition: def, active: !!character.conditions[def.id] }));
            return (
              <AttributeField
                key={attr.id}
                attributeId={attr.id}
                abbreviation={attr.abbreviation}
                value={ev.effective}
                min={attr.min}
                max={attr.max}
                onChange={v => updateAttr(attr.id, v)}
                disabled={!attributesEditable}
                linkedConditions={linked}
                onConditionToggle={updateCondition}
                modifierDelta={ev.isModified ? ev.modifiers.reduce((s, m) => s + m.delta, 0) : undefined}
              />
            );
          })}
        </div>
      </SectionPanel>
      {/* Buff Chip Bar — active temp modifiers */}
      <BuffChipBar
        modifiers={character.tempModifiers ?? []}
        onRemove={handleRemoveModifier}
        onClearAll={handleClearAllModifiers}
        onAdd={() => setAddModifierOpen(true)}
      />
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
      <div className="flex flex-col gap-[var(--space-md)]">
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
      <div className="flex flex-col">
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
      <div className="flex gap-[var(--space-md)] flex-wrap">
        <button
          type="button"
          className="rest-btn rest-btn--round"
          onClick={() => handleRestWithExpiryCheck('round', () => setRoundRestOpen(true))}
        >
          Round Rest
        </button>
        <button
          type="button"
          className="rest-btn rest-btn--stretch"
          onClick={() => handleRestWithExpiryCheck('stretch', () => setStretchRestOpen(true))}
        >
          Stretch Rest
        </button>
        <button
          type="button"
          className="rest-btn rest-btn--stretch"
          onClick={() => handleRestWithExpiryCheck('shift', handleShiftRestDirect)}
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
      <div className="p-[var(--space-sm)] rounded-[var(--radius-md)] border-2 border-[var(--color-danger)] bg-[rgba(224,85,85,0.1)]">
        <p className="text-[var(--color-danger)] font-bold text-[length:var(--font-size-md)] text-center mb-[var(--space-sm)]">
          Character is DOWN!
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-center gap-[var(--space-md)]">
            <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-md)] font-bold">Failures:</span>
            <div className="flex gap-3">
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
                  className={cn(
                    "w-12 h-12 rounded-full border-2 border-[var(--color-danger)] cursor-pointer flex items-center justify-center text-[length:var(--font-size-lg)] font-bold",
                    i < deathRollFailures
                      ? "bg-[var(--color-danger)] text-[var(--color-text-inverse,#fff)]"
                      : "bg-transparent text-[var(--color-danger)]"
                  )}
                >
                  {i < deathRollFailures ? '\u2716' : ''}
                </button>
              ))}
            </div>
          </div>
          {deathRollFailures >= deathRollMax && (
            <p className="text-[var(--color-danger)] font-bold text-[length:var(--font-size-lg)] text-center">
              DEAD
            </p>
          )}
          <div className="flex items-center justify-center gap-[var(--space-md)]">
            <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-md)] font-bold">Successes:</span>
            <div className="flex gap-3">
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
                  className={cn(
                    "w-12 h-12 rounded-full border-2 border-[var(--color-success,#27ae60)] cursor-pointer flex items-center justify-center text-[length:var(--font-size-lg)] font-bold",
                    i < deathSuccessCount
                      ? "bg-[var(--color-success,#27ae60)] text-white"
                      : "bg-transparent text-[var(--color-success,#27ae60)]"
                  )}
                >
                  {i < deathSuccessCount ? '\u2714' : ''}
                </button>
              ))}
            </div>
          </div>
          {deathSuccessCount >= deathSuccessMax && (
            <p className="text-[var(--color-success,#27ae60)] font-bold text-[length:var(--font-size-lg)] text-center">
              Stabilized!
            </p>
          )}
          <div className="flex justify-center mt-[var(--space-sm)]">
            <button
              type="button"
              aria-label="Reset death rolls"
              onClick={resetDeathRolls}
              className="min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] text-[length:var(--font-size-sm)] bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] cursor-pointer px-[var(--space-sm)]"
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
    <div className="p-[var(--space-sm)]">
      {saveError && <div className="text-[var(--color-danger)] mb-[var(--space-sm)] text-[length:var(--font-size-sm)]">{saveError}</div>}

      {isPlayMode && (
        <div className="mb-[var(--space-sm)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-[var(--space-md)] py-[var(--space-sm)]">
          <p className="m-0 text-sm font-semibold text-[var(--color-text)]">Play Mode is on</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Identity and attribute prep fields are locked. Use the top menu&apos;s mode switch to return to Edit Mode when you want to change build details.
          </p>
        </div>
      )}

      {isEditMode && (
        <div className="flex justify-end gap-3 mb-[var(--space-sm)]">
          {reorderMode && (
            <button
              type="button"
              className="rest-btn rest-btn--round flex items-center gap-[var(--space-xs)]"
              onClick={() => {
                handleOrderChange(DEFAULT_PANEL_ORDER);
                showToast('Panel order reset to default.', 'info');
              }}
            >
              Reset Order
            </button>
          )}
          <button
            type="button"
            className={cn(reorderMode ? 'rest-btn rest-btn--stretch' : 'rest-btn rest-btn--round', 'flex items-center gap-[var(--space-xs)]')}
            onClick={() => setReorderMode(prev => !prev)}
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
        <div className="flex flex-col gap-[var(--space-md)]">
          <p className="text-[var(--color-text)] text-[length:var(--font-size-md)]">
            Roll a d6 for WP recovery.
          </p>
          <label className="flex flex-col gap-2 text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
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

      {/* Add Modifier Drawer */}
      <AddModifierDrawer
        open={addModifierOpen}
        onClose={() => setAddModifierOpen(false)}
        onSave={handleAddModifier}
      />

      {/* Rest Expiry Modal */}
      <Modal
        open={expiryCheck !== null}
        onClose={() => setExpiryCheck(null)}
        title="Expiring Effects"
        actions={
          <>
            <button
              type="button"
              className="rest-modal-btn rest-modal-btn--cancel"
              onClick={handleExpiryKeepAndRest}
            >
              Keep & Rest
            </button>
            <button
              type="button"
              className="rest-modal-btn rest-modal-btn--confirm"
              onClick={handleExpiryRemoveAndRest}
            >
              Remove & Rest
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-[var(--space-md)]">
          <p className="text-[var(--color-text)] text-[length:var(--font-size-md)]">
            These effects expire after a {expiryCheck?.restType} rest:
          </p>
          {expiryCheck?.expiring.map(m => (
            <div key={m.id} className="p-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)]">
              <strong className="text-[var(--color-text)]">{m.label}</strong>
              <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] ml-[var(--space-sm)]">
                {m.effects.map(e => `${e.stat.toUpperCase()} ${e.delta > 0 ? '+' : ''}${e.delta}`).join(', ')}
              </span>
            </div>
          ))}
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
        <div className="flex flex-col gap-[var(--space-md)]">
          <p className="text-[var(--color-text)] text-[length:var(--font-size-md)]">
            Roll d6 for WP and HP recovery. WP is fully restored. HP is recovered by your roll result.
          </p>
          <label className="flex flex-col gap-2 text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
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
          <label className="flex flex-col gap-2 text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
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
            <label className="flex flex-col gap-2 text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
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
