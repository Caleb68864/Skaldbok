import { useState } from 'react';
import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Modal } from '../../components/primitives/Modal';
import { useToast } from '../../context/ToastContext';
import { nowISO } from '../../utils/dates';
import { cn } from '../../lib/utils';
import type { CharacterRecord } from '../../types/character';
import { type PlayModuleProps } from './types';
import { useSessionLog } from '../session/useSessionLog';
import { getEngine } from '../systems/engine';
import type { RestDefinition } from '../systems/engine/types';

/**
 * `CharacterUIState.restsUsed` is declared with the three Dragonbane keys; the
 * module keys it by `RestDefinition.id` instead so any system's rest ladder can
 * be tracked. The ids match the old literals for classic-fantasy, so no stored
 * data changes shape.
 */
type RestsUsedMap = Record<string, boolean | undefined>;

function asStoredRestsUsed(map: RestsUsedMap): CharacterRecord['uiState']['restsUsed'] {
  return map as CharacterRecord['uiState']['restsUsed'];
}

export function RestModule({ character, system, updateCharacter }: PlayModuleProps) {
  const { showToast } = useToast();
  const { logRest } = useSessionLog();

  const engine = getEngine(system);
  const rests = engine.rest;

  const [openRestId, setOpenRestId] = useState<string | null>(null);
  const [rollInputs, setRollInputs] = useState<Record<string, string>>({});
  const [conditionToClear, setConditionToClear] = useState('');

  const restsUsed = (character.uiState.restsUsed ?? {}) as RestsUsedMap;
  const openRest = rests?.find(def => def.id === openRestId) ?? null;

  /**
   * Whether a rest resets the tracker instead of marking itself used. Declared
   * by the engine (Dragonbane's Shift Rest ends the day) rather than inferred
   * from the rest's position in the ladder.
   */
  function clearsTracker(def: RestDefinition): boolean {
    return def.clearsRestTracker === true;
  }

  function closeModal() {
    setOpenRestId(null);
    setRollInputs({});
    setConditionToClear('');
  }

  function resetMarks() {
    updateCharacter(prev => ({
      uiState: { ...prev.uiState, restsUsed: {} },
    }));
    showToast('Rest tracker cleared.', 'info');
  }

  function applyRest(def: RestDefinition, rolls: Record<string, number>, condition?: string) {
    const outcome = def.apply(character, rolls, condition);

    updateCharacter(prev => {
      const resources = { ...prev.resources };
      for (const [id, value] of Object.entries(outcome.resources)) {
        resources[id] = { ...(prev.resources[id] ?? { current: 0, max: 0 }), current: value };
      }
      const conditions = { ...prev.conditions };
      for (const id of outcome.conditionsCleared) conditions[id] = false;

      const prevUsed = (prev.uiState.restsUsed ?? {}) as RestsUsedMap;
      const nextUsed: RestsUsedMap = clearsTracker(def) ? {} : { ...prevUsed, [def.id]: true };

      return {
        resources,
        conditions,
        uiState: { ...prev.uiState, restsUsed: asStoredRestsUsed(nextUsed) },
        updatedAt: nowISO(),
      };
    });

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

  function startRest(def: RestDefinition) {
    if (!def.prompt) {
      applyRest(def, {});
      return;
    }
    setRollInputs({});
    // Preserves the dashboard's previous behaviour of clearing an active
    // condition by default; the player can still pick another or none.
    setConditionToClear(
      def.prompt.clearOneCondition
        ? Object.entries(character.conditions).find(([, active]) => active)?.[0] ?? ''
        : '',
    );
    setOpenRestId(def.id);
  }

  function confirmRest() {
    if (!openRest?.prompt) return;
    const { prompt } = openRest;
    const rolls: Record<string, number> = {};
    for (const field of prompt.fields) {
      const value = parseInt(rollInputs[field.id] ?? '', 10);
      if (isNaN(value) || value < 1 || value > prompt.die) {
        showToast(
          prompt.fields.length > 1
            ? `Enter a ${field.label} between 1 and ${prompt.die}.`
            : `Enter a value between 1 and ${prompt.die}.`,
          'error',
        );
        return;
      }
      rolls[field.id] = value;
    }
    applyRest(openRest, rolls, prompt.clearOneCondition ? conditionToClear || undefined : undefined);
    closeModal();
  }

  const btnBase = 'min-h-[var(--touch-target-min)] w-full justify-center px-1 py-[var(--space-sm)] rounded-[var(--radius-sm)] border text-[length:var(--font-size-md)] font-medium cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap';
  const unusedClass = 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)] hover:bg-[var(--color-surface)]';
  const usedClass = 'border-[var(--color-success)] bg-[var(--color-success)] text-[var(--color-bg)] opacity-70';

  // Systems without a rest ladder (e.g. Traveller) have no rest mechanic at all.
  if (!rests || rests.length === 0) return null;

  const anyUsed = rests.some(def => !!restsUsed[def.id]);
  const openPrompt = openRest?.prompt ?? null;

  return (
    <SectionPanel title="Rest" collapsible defaultOpen>
      <div className="grid gap-2 w-full">
        {rests.map(def => {
          const used = !!restsUsed[def.id];
          return (
            <button
              key={def.id}
              type="button"
              className={cn(btnBase, used ? usedClass : unusedClass)}
              onClick={() => startRest(def)}
              aria-pressed={used}
              title={used ? `${def.label} already used — Reset to clear` : def.label}
            >
              {used && <span aria-hidden="true">✓</span>}
              {def.label}
              {used && <span className="text-[length:var(--font-size-xs)] opacity-80">used</span>}
            </button>
          );
        })}
        {anyUsed && (
          <button
            type="button"
            className={cn(btnBase, 'border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)]')}
            onClick={resetMarks}
            title={`Clear used marks. Does not undo ${engine.terms.healthResource}/${engine.terms.magicResource} changes.`}
          >
            Reset
          </button>
        )}
      </div>

      <Modal
        open={!!openPrompt}
        onClose={closeModal}
        title={openRest?.label ?? ''}
        actions={
          <>
            <button type="button" className="min-h-[var(--touch-target-min)] px-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)] cursor-pointer hover:bg-[var(--color-surface)]" onClick={closeModal}>Cancel</button>
            <button type="button" className="min-h-[var(--touch-target-min)] px-4 rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold cursor-pointer hover:brightness-110" onClick={confirmRest}>Confirm</button>
          </>
        }
      >
        {openPrompt && (
          <div className="flex flex-col gap-[var(--space-md)]">
            <p className="text-[var(--color-text)] text-[length:var(--font-size-md)]">{openPrompt.text}</p>
            {openPrompt.fields.map((field, index) => (
              <label
                key={field.id}
                className="flex flex-col gap-2 text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]"
              >
                {field.label} (1–{openPrompt.die})
                <input
                  type="number"
                  min={1}
                  max={openPrompt.die}
                  value={rollInputs[field.id] ?? ''}
                  onChange={e => setRollInputs(prev => ({ ...prev, [field.id]: e.target.value }))}
                  className="min-h-[var(--touch-target-min)] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]"
                  placeholder={`Enter 1–${openPrompt.die}`}
                  autoFocus={index === 0}
                />
              </label>
            ))}
            {openPrompt.clearOneCondition && system && system.conditions.length > 0 && (
              <label className="flex flex-col gap-2 text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
                Clear a Condition (optional)
                <select
                  value={conditionToClear}
                  onChange={e => setConditionToClear(e.target.value)}
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
    </SectionPanel>
  );
}
