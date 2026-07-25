import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAppState } from '../context/AppStateContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { useSheetTemplate } from '../features/systems/useSheetTemplate';
import { resolveSheetPanelOrder } from '../features/systems/panelOrder';
import { getEngine } from '../features/systems/engine';
import type { RestDefinition } from '../features/systems/engine/types';
import { useAutosave } from '../hooks/useAutosave';
import { useSyncedResourceMaxima } from '../features/characters/useSyncedResourceMaxima';
import { useFieldEditable, useIsEditMode } from '../utils/modeGuards';
import { AttributeField } from '../components/fields/AttributeField';
import { CharacterPortrait } from '../components/fields/CharacterPortrait';
import { ConditionToggleGroup } from '../components/fields/ConditionToggleGroup';
import { ResourceTracker } from '../components/fields/ResourceTracker';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { DerivedFieldDisplay } from '../components/fields/DerivedFieldDisplay';
import { getEffectiveValue } from '../utils/derivedValues';
import { BuffChipBar } from '../components/panels/BuffChipBar';
import { AddModifierDrawer } from '../components/panels/AddModifierDrawer';
import type { TempModifier } from '../types/character';
import { GameIcon } from '../components/primitives/GameIcon';
import { Modal } from '../components/primitives/Modal';
import { useToast } from '../context/ToastContext';
import * as characterRepository from '../storage/repositories/characterRepository';
import { nowISO } from '../utils/dates';
import { generateId } from '../utils/ids';
import { cn } from '../lib/utils';
import { useSessionLog } from '../features/session/useSessionLog';
import DraggableCardContainer from '../components/panels/DraggableCardContainer';
import type { PanelItem } from '../components/panels/DraggableCardContainer';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

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
 * **Death panel** — automatically inserted after the Resources panel when the
 * engine's `death` model says the character is down.  Its pip rows, labels and
 * thresholds all come from `engine.death`; systems without death rules render
 * nothing.
 *
 * **Rest** — one button per `engine.rest` entry.  A rest with a `prompt` opens
 * a generic modal collecting one die roll per prompt field (plus an optional
 * condition to clear); a rest without one applies immediately.  All rest events
 * are logged to the active session log via {@link useSessionLog}.
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
  const { system } = useSystemDefinition(character?.systemId ?? 'classic-fantasy');
  const { template } = useSheetTemplate(character?.systemId ?? 'classic-fantasy');
  const { error: saveError } = useAutosave(character, characterRepository.save, 1000);
  useSyncedResourceMaxima(character, system, updateCharacter);
  const { showToast } = useToast();
  const { logHPChange, logDeathRoll, logRest } = useSessionLog();

  const isEditMode = useIsEditMode();
  const identityEditable = useFieldEditable('identity');
  const attributesEditable = useFieldEditable('attributes.str');
  const resourceMaxEditable = useFieldEditable('resources.hp.max');
  const derivedEditable = useFieldEditable('derivedOverrides');

  // Reorder mode state
  const [reorderMode, setReorderMode] = useState(false);

  // Story Bank editor draft (a new beat being composed)
  const [newBeatCue, setNewBeatCue] = useState('');
  const [newBeatText, setNewBeatText] = useState('');

  function addStoryBeat() {
    const text = newBeatText.trim();
    if (!text) return;
    const beat = { id: generateId(), cue: newBeatCue.trim(), text };
    updateCharacter(prev => ({ storyBank: [...(prev.storyBank ?? []), beat], updatedAt: nowISO() }));
    setNewBeatCue('');
    setNewBeatText('');
  }

  function removeStoryBeat(id: string) {
    updateCharacter(prev => ({
      storyBank: (prev.storyBank ?? []).filter(b => b.id !== id),
      updatedAt: nowISO(),
    }));
  }

  // Death track helpers (mirrored from CombatScreen)
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

  /** Sets a death track's pip count, logging the roll when the count increases. */
  function updateDeathTrack(trackId: string, current: number, isSuccess: boolean) {
    if (!character) return;
    const prev = character.resources[trackId]?.current ?? 0;
    updateDeathRollCurrent(trackId, current);
    if (current > prev) logDeathRoll(character.name, current, isSuccess);
  }

  // Rest modal state — a single generic prompt driven by the active RestDefinition.
  const [restPrompt, setRestPrompt] = useState<{
    rest: RestDefinition;
    rolls: Record<string, string>;
    conditionToClear: string;
  } | null>(null);

  // Temp modifier state
  const [addModifierOpen, setAddModifierOpen] = useState(false);
  const [expiryCheck, setExpiryCheck] = useState<{
    rest: RestDefinition;
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
  const engine = getEngine(system);
  // Engines may surface derived keys beyond the shared `DerivedValues` shape
  // (e.g. Traveller's `initiativeDM`), so index the result by string key.
  const derivedStats = engine.derivedStats(character, system ?? undefined) as unknown as Record<
    string,
    number | string | undefined
  >;
  const currencyAmounts = engine.currency.read(character);

  // Derived fields this surface shows. The Derived Values panel exists to
  // override them, so a system whose sheet-surfaced fields are all computed-only
  // gets no panel rather than a read-only list.
  const sheetDerivedFields = engine.derivedFields.filter(
    f => !f.surfaces || f.surfaces.includes('sheet'),
  );

  /**
   * Which sheet panels the active system has, derived from the engine rather
   * than from `systemId`. A system that declares no `characteristics` panel
   * simply never gets one; adding a ruleset needs no change here.
   */
  const panelAvailability: Record<string, boolean> = {
    identity: true,
    attributes: engine.panels.includes('attributes'),
    characteristics: engine.panels.includes('characteristics'),
    resources: engine.panels.includes('resources'),
    derived: sheetDerivedFields.some(f => f.overridable),
    finances: engine.panels.includes('finances'),
    careers: engine.panels.includes('careers'),
    augments: engine.panels.includes('augments'),
    edges: engine.panels.includes('edges'),
    hindrances: engine.panels.includes('hindrances'),
    rest: engine.rest !== null,
    storyBank: true,
  };

  // Canonical head-to-toe fallback order; each system shows the subset it declares.
  // Must list EVERY key in `panelAvailability` — a key that is available but
  // omitted here silently vanishes whenever a system falls back (no sheet.json).
  const FALLBACK_PANEL_SEQUENCE = [
    'identity',
    'attributes',
    'characteristics',
    'resources',
    'derived',
    'finances',
    'careers',
    'augments',
    'edges',
    'hindrances',
    'rest',
    'storyBank',
  ];
  // When the system's `sheet.json` declares a `sheet` surface, its panel keys set
  // the default order/selection — the Sheet is "authored as data". The panels
  // themselves stay bespoke editors; only which appear and in what order is
  // template-driven. Availability still gates, so a stale key can't render a
  // panel the system lacks. Falls back to the canonical order with no template.
  // Note: unlike the play surface (CardRenderer), a sheet entry's `when` guard is
  // NOT honored here — sheet panels are gated by `panelAvailability` only.
  const templatePanelKeys = (template?.sheet?.regions ?? [])
    .flatMap(region => (Array.isArray(region) ? region : region.cells.flat()))
    .map(entry => (typeof entry === 'string' ? entry : entry.card));
  // The three-layer template→availability→persisted-order reconciliation lives in
  // a pure, unit-tested helper (see panelOrder.ts).
  const { defaultOrder: DEFAULT_PANEL_ORDER, panelOrder } = resolveSheetPanelOrder(
    templatePanelKeys,
    FALLBACK_PANEL_SEQUENCE,
    panelAvailability,
    settings.sheetPanelOrder,
  );

  function updateAttr(id: string, delta: number) {
    if (!character) return;
    updateCharacter(prev => {
      const current = prev.attributes[id] ?? 10;
      const attrDef = system?.attributes.find(attr => attr.id === id);
      const scale = attrDef?.scale;
      let next: number;
      if (scale?.kind === 'die-ladder' && scale.ladder.length > 0) {
        // Walk the die ladder (d4→d6→d8…) a rung at a time rather than by 1, so a
        // Savage Worlds attribute never lands on a nonexistent d5/d7. A stored
        // value that isn't a rung (migrated/hand-edited data) snaps to the far
        // rung in the pressed direction rather than getting stuck. The length
        // guard keeps a malformed empty ladder from writing `undefined`.
        const ladder = scale.ladder;
        const idx = ladder.indexOf(current);
        const targetIdx = idx === -1
          ? (delta > 0 ? ladder.length - 1 : 0)
          : clamp(idx + Math.sign(delta), 0, ladder.length - 1);
        next = ladder[targetIdx];
      } else {
        next = clamp(current + delta, attrDef?.min ?? 1, attrDef?.max ?? 30);
      }
      return { attributes: { ...prev.attributes, [id]: next }, updatedAt: nowISO() };
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
      const max = prev.resources[id]?.max ?? 0;
      return { resources: { ...prev.resources, [id]: { ...prev.resources[id], current: clamp(current + delta, 0, max) } }, updatedAt: nowISO() };
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
      const nextMax = clamp(max + delta, 0, 999);
      const nextCurrent = clamp(prev.resources[id]?.current ?? 0, 0, nextMax);
      return { resources: { ...prev.resources, [id]: { ...prev.resources[id], current: nextCurrent, max: nextMax } }, updatedAt: nowISO() };
    });
  }

  function updateMeta(field: string, value: string) {
    if (!character) return;
    updateCharacter({ metadata: { ...character.metadata, [field]: value }, updatedAt: nowISO() });
  }

  /** Reads a free-text field out of the character's system-specific bag. */
  function sysStr(key: string): string {
    return (character?.systemData?.[key] as string | undefined) ?? '';
  }

  /** Writes a free-text field into the character's system-specific bag. */
  function setSysStr(key: string, value: string) {
    if (!character) return;
    updateCharacter({ systemData: { ...character.systemData, [key]: value }, updatedAt: nowISO() });
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

  // ---- Rest handlers (driven entirely by engine.rest) ----

  /**
   * Applies a {@link RestDefinition}, writing back the outcome's resources and
   * cleared conditions, toasting the summary and logging it to the session.
   */
  function applyRest(def: RestDefinition, rolls: Record<string, number>, conditionToClear?: string) {
    if (!character) return;
    const outcome = def.apply(character, rolls, conditionToClear);

    // A no-op rest (already at full) reports informationally and skips the
    // write, so it neither claims success nor bumps updatedAt.
    if (outcome.noop) {
      showToast(outcome.messages.join(' '), 'info');
      return;
    }

    const updatedResources = { ...character.resources };
    for (const [resId, value] of Object.entries(outcome.resources)) {
      updatedResources[resId] = { ...updatedResources[resId], current: value };
    }
    const updatedConditions = { ...character.conditions };
    for (const condId of outcome.conditionsCleared) {
      updatedConditions[condId] = false;
    }
    updateCharacter({ resources: updatedResources, conditions: updatedConditions, updatedAt: nowISO() });

    const parts = [...outcome.messages];
    if (outcome.conditionsCleared.length > 0) {
      const names = outcome.conditionsCleared.map(
        id => system?.conditions.find(c => c.id === id)?.name ?? id,
      );
      parts.push(`Cleared ${names.join(', ')}.`);
    }
    const summary = parts.join(' ');
    showToast(summary, 'success');
    logRest(character.name, def.label, summary);
  }

  /** Opens the prompt modal for a rest, or applies it immediately when it has none. */
  function beginRest(def: RestDefinition) {
    if (def.prompt) {
      setRestPrompt({
        rest: def,
        rolls: Object.fromEntries(def.prompt.fields.map(f => [f.id, ''])),
        conditionToClear: '',
      });
    } else {
      applyRest(def, {});
    }
  }

  /** Modifier `duration` values are rest ids, so a rest expires the modifiers keyed to it. */
  function getExpiringModifiers(def: RestDefinition): TempModifier[] {
    if (!character) return [];
    return (character.tempModifiers ?? []).filter(m => m.duration === def.id);
  }

  function handleRestClick(def: RestDefinition) {
    const expiring = getExpiringModifiers(def);
    if (expiring.length > 0) {
      setExpiryCheck({ rest: def, expiring });
    } else {
      beginRest(def);
    }
  }

  function handleExpiryRemoveAndRest() {
    if (!character || !expiryCheck) return;
    const { rest, expiring } = expiryCheck;
    const expiringIds = new Set(expiring.map(m => m.id));
    const remaining = (character.tempModifiers ?? []).filter(m => !expiringIds.has(m.id));
    updateCharacter({ tempModifiers: remaining, updatedAt: nowISO() });
    const names = expiring.map(m => m.label).join(', ');
    logRest(character.name, rest.label, `Expired modifiers: ${names}`);
    setExpiryCheck(null);
    beginRest(rest);
  }

  function handleExpiryKeepAndRest() {
    if (!expiryCheck) return;
    const { rest } = expiryCheck;
    setExpiryCheck(null);
    beginRest(rest);
  }

  function confirmRestPrompt() {
    if (!restPrompt) return;
    const { rest, rolls, conditionToClear } = restPrompt;
    const prompt = rest.prompt;
    if (!prompt) return;

    const parsed: Record<string, number> = {};
    for (const field of prompt.fields) {
      const value = parseInt(rolls[field.id] ?? '', 10);
      if (isNaN(value) || value < 1 || value > prompt.die) {
        showToast(`Please enter a value between 1 and ${prompt.die}.`, 'error');
        return;
      }
      parsed[field.id] = value;
    }

    applyRest(rest, parsed, prompt.clearOneCondition && conditionToClear ? conditionToClear : undefined);
    setRestPrompt(null);
  }

  const inputClass = (editable: boolean) => cn(
    "p-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text)] text-[length:var(--font-size-md)] w-full",
    editable
      ? "bg-[var(--color-surface-alt)] cursor-text opacity-100"
      : "bg-[var(--color-surface)] cursor-default opacity-70"
  );

  // ---- Identity fields (declared by the active system, not hardcoded) ----
  type IdentityField = { id: string; label: string; type?: 'text' | 'textarea' };

  const identityFields: IdentityField[] = system?.identityFields ?? [];
  // The first three declared fields share the compact meta row; anything beyond
  // that gets its own full-width line, matching the sheet's existing rhythm.
  const identityRowFields = identityFields.slice(0, 3);
  const identityRestFields = identityFields.slice(3);

  function renderIdentityField(field: IdentityField) {
    const value = character?.metadata?.[field.id] ?? '';
    const className = cn(
      inputClass(identityEditable),
      field.type === 'textarea' && 'min-h-[80px]',
      identityEditable ? 'field--editable' : 'field--locked',
    );
    return (
      <div key={field.id}>
        <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">
          {field.label}
        </label>
        {field.type === 'textarea' ? (
          <textarea
            aria-label={field.label}
            className={className}
            value={value}
            disabled={!identityEditable}
            onChange={e => updateMeta(field.id, e.target.value)}
          />
        ) : (
          <input
            aria-label={field.label}
            className={className}
            value={value}
            disabled={!identityEditable}
            onChange={e => updateMeta(field.id, e.target.value)}
          />
        )}
      </div>
    );
  }

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
          {identityRowFields.length > 0 && (
            <div className="identity-meta-row">
              {identityRowFields.map(renderIdentityField)}
            </div>
          )}
          {identityRestFields.map(renderIdentityField)}
        </div>
      </div>
    </SectionPanel>
  );

  const attributesPanel = (
    <>
      <SectionPanel title={`${engine.labels.attributesPanel}${isPlayMode ? ' (locked in Play Mode)' : ''}`} icon={<GameIcon name="biceps" size={18} />} collapsible defaultOpen>
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
                format={engine.attributeReadout?.mode === 'dice' ? (n) => engine.attributeReadout!.format(n) : undefined}
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
        const orphanConditions = system.conditions.filter(c => !c.linkedAttributeId || !linkedAttrIds.has(c.linkedAttributeId));
        if (orphanConditions.length === 0) return null;
        return (
          <SectionPanel title={engine.labels.conditionsPanel ?? 'Conditions'} collapsible defaultOpen>
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
    <SectionPanel title={engine.labels.resourcesPanel} icon={<GameIcon name="health-potion" size={18} />} collapsible defaultOpen>
      <div className="flex flex-col gap-[var(--space-md)]">
        {engine.resourceIds.map(resId => {
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

  // ---- Traveller panels ----
  const characteristicsPanel = (
    <SectionPanel title={engine.labels.attributesPanel} icon={<GameIcon name="biceps" size={18} />} collapsible defaultOpen>
      <div className="flex flex-wrap gap-[var(--space-md)] justify-center">
        {engine.attributeIds.map(attrId => {
          const attr = system?.attributes.find(a => a.id === attrId);
          const ev = getEffectiveValue(attrId, character);
          const dm = engine.attributeBadge(attrId, character);
          return (
            <div key={attrId} className="flex flex-col items-center gap-[var(--space-xs)]">
              <AttributeField
                attributeId={attrId}
                abbreviation={attr?.abbreviation ?? attrId.toUpperCase()}
                value={ev.effective}
                min={attr?.min}
                max={attr?.max}
                onChange={v => updateAttr(attrId, v)}
                disabled={!attributesEditable}
              />
              {dm !== null && (
                <span
                  aria-label={`${attr?.abbreviation ?? attrId.toUpperCase()} DM`}
                  className="text-[length:var(--font-size-xs,10px)] font-bold text-[var(--color-primary)] px-[var(--space-sm)] py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-border)]"
                >
                  DM {dm}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </SectionPanel>
  );

  const financesPanel = (
    <SectionPanel title="Finances" icon={<GameIcon name="cog" size={18} />} collapsible defaultOpen>
      <div className="flex flex-col gap-[var(--space-md)]">
        {engine.currency.denominations.map(denom => (
          <div key={denom.id}>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">{denom.label}</label>
            <input
              type="number"
              min={0}
              aria-label={denom.label}
              className={cn(inputClass(identityEditable), identityEditable ? 'field--editable' : 'field--locked')}
              value={currencyAmounts[denom.id] ?? 0}
              disabled={!identityEditable}
              onChange={e =>
                updateCharacter({
                  // Clamp non-negative at the source; money is never negative in
                  // any bundled system, and the stored value is normalised to
                  // >= 0 anyway, so an unclamped input just shows a value that
                  // silently corrects itself on the next load.
                  ...engine.currency.write(character, { [denom.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }),
                  updatedAt: nowISO(),
                })
              }
            />
          </div>
        ))}
        <div>
          <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Cost of Living (Cr / month)</label>
          <input
            type="number"
            min={0}
            aria-label="Cost of Living (Cr / month)"
            className={cn(inputClass(identityEditable), identityEditable ? 'field--editable' : 'field--locked')}
            value={sysStr('livingCost')}
            disabled={!identityEditable}
            onChange={e => setSysStr('livingCost', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Finance Notes</label>
          <textarea
            aria-label="Finance Notes"
            className={cn(inputClass(identityEditable), 'min-h-[80px]', identityEditable ? 'field--editable' : 'field--locked')}
            value={sysStr('financeNotes')}
            disabled={!identityEditable}
            onChange={e => setSysStr('financeNotes', e.target.value)}
          />
        </div>
      </div>
    </SectionPanel>
  );

  const careersPanel = (
    <SectionPanel title="Careers / Background" icon={<GameIcon name="person" size={18} />} collapsible defaultOpen>
      <textarea
        aria-label="Careers"
        className={cn(inputClass(identityEditable), 'min-h-[120px]', identityEditable ? 'field--editable' : 'field--locked')}
        value={sysStr('careers')}
        disabled={!identityEditable}
        onChange={e => setSysStr('careers', e.target.value)}
      />
    </SectionPanel>
  );

  const augmentsPanel = (
    <SectionPanel title="Augments / Species" icon={<GameIcon name="cog" size={18} />} collapsible defaultOpen>
      <div className="flex flex-col gap-[var(--space-md)]">
        <div>
          <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Species Traits</label>
          <textarea
            aria-label="Species Traits"
            className={cn(inputClass(identityEditable), 'min-h-[80px]', identityEditable ? 'field--editable' : 'field--locked')}
            value={sysStr('speciesTraits')}
            disabled={!identityEditable}
            onChange={e => setSysStr('speciesTraits', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Augments</label>
          <textarea
            aria-label="Augments"
            className={cn(inputClass(identityEditable), 'min-h-[80px]', identityEditable ? 'field--editable' : 'field--locked')}
            value={sysStr('augments')}
            disabled={!identityEditable}
            onChange={e => setSysStr('augments', e.target.value)}
          />
        </div>
      </div>
    </SectionPanel>
  );

  const edgesPanel = (
    <SectionPanel title="Edges" icon={<GameIcon name="star" size={18} />} collapsible defaultOpen>
      <textarea
        aria-label="Edges"
        className={cn(inputClass(identityEditable), 'min-h-[120px]', identityEditable ? 'field--editable' : 'field--locked')}
        placeholder="One Edge per line — e.g. Two-Fisted, Quick, Alertness…"
        value={sysStr('edges')}
        disabled={!identityEditable}
        onChange={e => setSysStr('edges', e.target.value)}
      />
    </SectionPanel>
  );

  const hindrancesPanel = (
    <SectionPanel title="Hindrances" icon={<GameIcon name="skull" size={18} />} collapsible defaultOpen>
      <textarea
        aria-label="Hindrances"
        className={cn(inputClass(identityEditable), 'min-h-[120px]', identityEditable ? 'field--editable' : 'field--locked')}
        placeholder="One Hindrance per line, with (Major)/(Minor) — e.g. Loyal (Minor), Heroic (Major)…"
        value={sysStr('hindrances')}
        disabled={!identityEditable}
        onChange={e => setSysStr('hindrances', e.target.value)}
      />
    </SectionPanel>
  );

  const storyBankPanel = (
    <SectionPanel title="Story Bank" icon={<GameIcon name="cog" size={18} />} collapsible defaultOpen>
      <div className="flex flex-col gap-[var(--space-sm)]">
        {(character.storyBank ?? []).length === 0 && (
          <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
            No roleplay prompts yet. Add cues you want at hand during play.
          </p>
        )}
        {(character.storyBank ?? []).map(beat => (
          <div key={beat.id} className="flex items-start justify-between gap-[var(--space-sm)] border-b border-[var(--color-border)] pb-[var(--space-xs)]">
            <div className="min-w-0">
              {beat.cue && (
                <span className="mr-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] px-1.5 py-0.5 text-[length:var(--font-size-sm)] font-semibold text-[var(--color-accent)]">
                  {beat.cue}
                </span>
              )}
              <span className="text-[var(--color-text)] text-[length:var(--font-size-md)]">{beat.text}</span>
            </div>
            {isEditMode && (
              <button
                type="button"
                onClick={() => removeStoryBeat(beat.id)}
                aria-label={`Remove ${beat.text}`}
                className="shrink-0 min-h-[44px] px-2 text-[var(--color-danger)] cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {isEditMode && (
          <div className="flex flex-wrap gap-[var(--space-xs)]">
            <input
              type="text"
              value={newBeatCue}
              onChange={e => setNewBeatCue(e.target.value)}
              placeholder="Cue (e.g. patience)"
              aria-label="New story cue"
              className="w-32 min-h-[44px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]"
            />
            <input
              type="text"
              value={newBeatText}
              onChange={e => setNewBeatText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addStoryBeat(); }}
              placeholder="Prompt / anecdote title"
              aria-label="New story prompt"
              className="flex-1 min-w-[140px] min-h-[44px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]"
            />
            <button
              type="button"
              onClick={addStoryBeat}
              className="min-h-[44px] px-3 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] cursor-pointer"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </SectionPanel>
  );

  const derivedPanel = (
    <SectionPanel title="Derived Values" icon={<GameIcon name="cog" size={18} />} collapsible defaultOpen>
      <div className="flex flex-col">
        {sheetDerivedFields.map(({ key, label, overridable }) => {
          const computed = derivedStats[key] ?? 0;
          const overrideRaw = character.derivedOverrides?.[key];
          const override =
            overridable && typeof overrideRaw === 'number' ? overrideRaw : null;
          return (
            <DerivedFieldDisplay
              key={key}
              label={label}
              computedValue={computed}
              override={override}
              onOverride={v => setDerivedOverride(key, v)}
              onReset={() => resetDerivedOverride(key)}
              editable={derivedEditable && !!overridable}
            />
          );
        })}
      </div>
    </SectionPanel>
  );

  // One button per RestDefinition; systems without rest rules render no panel.
  const restPanel = engine.rest ? (
    <SectionPanel title="Rest & Recovery" icon={<GameIcon name="health-potion" size={18} />} collapsible defaultOpen>
      <div className="flex gap-[var(--space-md)] flex-wrap">
        {engine.rest.map((def, index) => (
          <button
            key={def.id}
            type="button"
            className={cn('rest-btn', index === 0 ? 'rest-btn--round' : 'rest-btn--stretch')}
            onClick={() => handleRestClick(def)}
          >
            {def.label}
          </button>
        ))}
      </div>
    </SectionPanel>
  ) : null;

  // Death panel: shape, labels and thresholds all come from engine.death.
  const death = engine.death;
  const isDown =
    death !== null &&
    (character.resources[death.triggerResourceId]?.current ?? 0) <= death.triggerAtOrBelow;

  const deathRollsPanel =
    death && isDown ? (
      <SectionPanel title="Death Rolls" collapsible defaultOpen>
        <div className="p-[var(--space-sm)] rounded-[var(--radius-md)] border-2 border-[var(--color-danger)] bg-[rgba(224,85,85,0.1)]">
          <p className="text-[var(--color-danger)] font-bold text-[length:var(--font-size-md)] text-center mb-[var(--space-sm)]">
            {death.downLabel}
          </p>
          <div className="flex flex-col gap-3">
            {death.tracks.map(track => {
              const isSuccess = track.tone === 'success';
              const res = character.resources[track.id];
              const filled = res?.current ?? 0;
              const max = res?.max ?? track.max;
              const pipLabel = isSuccess ? 'Death success' : 'Death roll';
              return (
                <div key={track.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-center gap-[var(--space-md)]">
                    <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-md)] font-bold">
                      {track.label}:
                    </span>
                    <div className="flex gap-3">
                      {Array.from({ length: max }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`${pipLabel} ${i + 1}`}
                          onClick={() => updateDeathTrack(track.id, i < filled ? i : i + 1, isSuccess)}
                          className={cn(
                            "w-12 h-12 rounded-full border-2 cursor-pointer flex items-center justify-center text-[length:var(--font-size-lg)] font-bold",
                            isSuccess
                              ? "border-[var(--color-success,#27ae60)]"
                              : "border-[var(--color-danger)]",
                            i < filled
                              ? isSuccess
                                ? "bg-[var(--color-success,#27ae60)] text-white"
                                : "bg-[var(--color-danger)] text-[var(--color-text-inverse,#fff)]"
                              : isSuccess
                                ? "bg-transparent text-[var(--color-success,#27ae60)]"
                                : "bg-transparent text-[var(--color-danger)]"
                          )}
                        >
                          {i < filled ? (isSuccess ? '\u2714' : '\u2716') : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                  {filled >= max && (
                    <p
                      className={cn(
                        "font-bold text-[length:var(--font-size-lg)] text-center",
                        isSuccess ? "text-[var(--color-success,#27ae60)]" : "text-[var(--color-danger)]"
                      )}
                    >
                      {isSuccess ? death.stabilizedLabel : death.deadLabel}
                    </p>
                  )}
                </div>
              );
            })}
            <div className="flex justify-center mt-[var(--space-sm)]">
              <button
                type="button"
                aria-label="Reset death rolls"
                onClick={() => death.tracks.forEach(t => updateDeathRollCurrent(t.id, 0))}
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
  // Every panel this screen knows how to render, keyed the same way as
  // `panelAvailability`; the system's declared panels select the subset.
  const allPanels: Record<string, React.ReactNode> = {
    identity: identityPanel,
    attributes: attributesPanel,
    characteristics: characteristicsPanel,
    resources: resourcesPanel,
    derived: derivedPanel,
    finances: financesPanel,
    careers: careersPanel,
    augments: augmentsPanel,
    edges: edgesPanel,
    hindrances: hindrancesPanel,
    rest: restPanel,
    storyBank: storyBankPanel,
  };

  const panelMap: Record<string, React.ReactNode> = Object.fromEntries(
    Object.entries(allPanels).filter(([key]) => panelAvailability[key]),
  );

  // Rest is the one panel that is also mode-gated: it is prep noise in Edit Mode.
  const panelVisibility: Record<string, boolean> = Object.fromEntries(
    Object.keys(panelMap).map(key => [key, key === 'rest' ? isPlayMode : true]),
  );

  const panelItems: PanelItem[] = panelOrder
    .filter(key => panelMap[key] !== undefined)
    .map(key => ({ key, element: panelMap[key] }));

  const handleOrderChange = (newOrder: string[]) => {
    updateSettings({ sheetPanelOrder: newOrder }).catch(console.error);
  };

  /** Prompt spec for the rest currently awaiting confirmation, if any. */
  const activeRestPrompt = restPrompt?.rest.prompt ?? null;

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

      {/* Rest Prompt Modal — shape driven by the active RestDefinition's prompt */}
      <Modal
        open={restPrompt !== null}
        onClose={() => setRestPrompt(null)}
        title={restPrompt?.rest.label ?? ''}
        actions={
          <>
            <button
              type="button"
              className="min-h-[var(--touch-target-min)] px-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)] cursor-pointer hover:bg-[var(--color-surface)]"
              onClick={() => setRestPrompt(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="min-h-[var(--touch-target-min)] px-4 rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold cursor-pointer hover:brightness-110"
              onClick={confirmRestPrompt}
            >
              Confirm
            </button>
          </>
        }
      >
        {restPrompt && activeRestPrompt && (
          <div className="flex flex-col gap-[var(--space-md)]">
            <p className="text-[var(--color-text)] text-[length:var(--font-size-md)]">
              {activeRestPrompt.text}
            </p>
            {activeRestPrompt.fields.map(field => (
              <label
                key={field.id}
                className="flex flex-col gap-2 text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]"
              >
                {`${field.label} (1–${activeRestPrompt.die})`}
                <input
                  type="number"
                  min={1}
                  max={activeRestPrompt.die}
                  value={restPrompt.rolls[field.id] ?? ''}
                  onChange={e =>
                    setRestPrompt(prev =>
                      prev ? { ...prev, rolls: { ...prev.rolls, [field.id]: e.target.value } } : prev,
                    )
                  }
                  className="min-h-[var(--touch-target-min)] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]"
                  placeholder={`Enter 1–${activeRestPrompt.die}`}
                />
              </label>
            ))}
            {activeRestPrompt.clearOneCondition && system && system.conditions.length > 0 && (
              <label className="flex flex-col gap-2 text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
                Clear a Condition (optional)
                <select
                  value={restPrompt.conditionToClear}
                  onChange={e =>
                    setRestPrompt(prev => (prev ? { ...prev, conditionToClear: e.target.value } : prev))
                  }
                  className="min-h-[var(--touch-target-min)] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]"
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
        )}
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
              className="min-h-[var(--touch-target-min)] px-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)] cursor-pointer hover:bg-[var(--color-surface)]"
              onClick={handleExpiryKeepAndRest}
            >
              Keep & Rest
            </button>
            <button
              type="button"
              className="min-h-[var(--touch-target-min)] px-4 rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold cursor-pointer hover:brightness-110"
              onClick={handleExpiryRemoveAndRest}
            >
              Remove & Rest
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-[var(--space-md)]">
          <p className="text-[var(--color-text)] text-[length:var(--font-size-md)]">
            These effects expire after a {expiryCheck?.rest.id} rest:
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
    </div>
  );
}
