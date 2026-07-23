import { useState } from 'react';
import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Modal } from '../../components/primitives/Modal';
import { useToast } from '../../context/ToastContext';
import { applyRoundRest, applyShiftRest, applyStretchRest } from '../../utils/restActions';
import { nowISO } from '../../utils/dates';
import { cn } from '../../lib/utils';
import { type PlayModuleProps } from './types';
import { useSessionLog } from '../session/useSessionLog';
import { getEngine } from '../systems/engine';

type RestType = 'round' | 'stretch' | 'shift';

export function RestModule({ character, system, updateCharacter }: PlayModuleProps) {
  const { showToast } = useToast();
  const { logRest } = useSessionLog();

  const [roundOpen, setRoundOpen] = useState(false);
  const [roundWp, setRoundWp] = useState('');
  const [stretchOpen, setStretchOpen] = useState(false);
  const [stretchWp, setStretchWp] = useState('');
  const [stretchHp, setStretchHp] = useState('');

  // Systems without a 'rest' panel (e.g. Traveller) have no rest mechanic at all.
  const hasRest = getEngine(system).panels.includes('rest');

  const restsUsed = character.uiState.restsUsed ?? {};

  function markUsed(type: RestType) {
    updateCharacter(prev => ({
      uiState: {
        ...prev.uiState,
        restsUsed: { ...(prev.uiState.restsUsed ?? {}), [type]: true },
      },
    }));
  }

  function resetMarks() {
    updateCharacter(prev => ({
      uiState: { ...prev.uiState, restsUsed: {} },
    }));
    showToast('Rest tracker cleared.', 'info');
  }

  function confirmRound() {
    const roll = parseInt(roundWp, 10);
    if (isNaN(roll) || roll < 1 || roll > 6) {
      showToast('Enter a value between 1 and 6.', 'error');
      return;
    }
    const result = applyRoundRest(character, roll);
    updateCharacter(prev => ({
      resources: { ...prev.resources, wp: { ...prev.resources.wp, current: result.newWpCurrent } },
      uiState: { ...prev.uiState, restsUsed: { ...(prev.uiState.restsUsed ?? {}), round: true } },
      updatedAt: nowISO(),
    }));
    showToast(result.alreadyFull && result.recovered === 0
      ? 'Already at full WP.'
      : `Recovered ${result.recovered} WP.`, 'success');
    logRest(character.name, 'Round Rest', `Rolled ${roll}, recovered ${result.recovered} WP`);
    setRoundOpen(false);
    setRoundWp('');
  }

  function confirmStretch() {
    const wpRoll = parseInt(stretchWp, 10);
    const hpRoll = parseInt(stretchHp, 10);
    if (isNaN(wpRoll) || wpRoll < 1 || wpRoll > 6) {
      showToast('Enter a WP d6 value between 1 and 6.', 'error');
      return;
    }
    if (isNaN(hpRoll) || hpRoll < 1 || hpRoll > 6) {
      showToast('Enter an HP d6 value between 1 and 6.', 'error');
      return;
    }
    const activeCondition = Object.entries(character.conditions).find(([, active]) => active)?.[0];
    const result = applyStretchRest(character, wpRoll, hpRoll, activeCondition);
    updateCharacter(prev => ({
      resources: {
        ...prev.resources,
        wp: { ...prev.resources.wp, current: result.newWpCurrent },
        hp: { ...prev.resources.hp, current: result.newHpCurrent },
      },
      conditions: result.conditionCleared
        ? { ...prev.conditions, [result.conditionCleared]: false }
        : prev.conditions,
      uiState: { ...prev.uiState, restsUsed: { ...(prev.uiState.restsUsed ?? {}), stretch: true } },
      updatedAt: nowISO(),
    }));
    const condName = result.conditionCleared
      ? system?.conditions.find(c => c.id === result.conditionCleared)?.name ?? result.conditionCleared
      : null;
    showToast(`Stretch rest: HP +${result.hpRecovered}, WP restored${condName ? `, cleared ${condName}` : ''}.`, 'success');
    logRest(character.name, 'Stretch Rest', `HP roll ${hpRoll}, WP roll ${wpRoll}`);
    setStretchOpen(false);
    setStretchWp('');
    setStretchHp('');
  }

  function applyShift() {
    const result = applyShiftRest(character);
    updateCharacter(prev => ({
      resources: {
        ...prev.resources,
        hp: { ...prev.resources.hp, current: prev.resources.hp?.max ?? 0 },
        wp: { ...prev.resources.wp, current: prev.resources.wp?.max ?? 0 },
      },
      conditions: Object.fromEntries(Object.keys(prev.conditions).map(id => [id, false])),
      uiState: {
        ...prev.uiState,
        restsUsed: {},
      },
      updatedAt: nowISO(),
    }));
    showToast(`Shift rest: ${result.hpRestored} HP and ${result.wpRestored} WP restored.`, 'success');
    logRest(character.name, 'Shift Rest', 'Fully recovered');
  }

  const btnBase = 'min-h-[var(--touch-target-min)] w-full justify-center px-1 py-[var(--space-sm)] rounded-[var(--radius-sm)] border text-[length:var(--font-size-md)] font-medium cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap';
  const unusedClass = 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)] hover:bg-[var(--color-surface)]';
  const usedClass = 'border-[var(--color-success,#27ae60)] bg-[var(--color-success,#27ae60)] text-white opacity-70';

  function restButton(type: RestType, label: string, onClick: () => void) {
    const used = !!restsUsed[type];
    return (
      <button
        type="button"
        className={cn(btnBase, used ? usedClass : unusedClass)}
        onClick={() => {
          if (used) {
            markUsed(type); // no-op idempotent confirm; still allows re-applying
          }
          onClick();
        }}
        aria-pressed={used}
        title={used ? `${label} already used — Reset to clear` : label}
      >
        {used && <span aria-hidden="true">✓</span>}
        {label}
        {used && <span className="text-[length:var(--font-size-xs)] opacity-80">used</span>}
      </button>
    );
  }

  const anyUsed = !!(restsUsed.round || restsUsed.stretch || restsUsed.shift);

  if (!hasRest) return null;

  return (
    <SectionPanel title="Rest" collapsible defaultOpen>
      <div className="grid gap-2 w-full">
        {restButton('round', 'Round Rest', () => setRoundOpen(true))}
        {restButton('stretch', 'Stretch Rest', () => setStretchOpen(true))}
        {restButton('shift', 'Shift Rest', applyShift)}
        {anyUsed && (
          <button
            type="button"
            className={cn(btnBase, 'border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)]')}
            onClick={resetMarks}
            title="Clear used marks. Does not undo HP/WP changes."
          >
            Reset
          </button>
        )}
      </div>

      <Modal
        open={roundOpen}
        onClose={() => { setRoundOpen(false); setRoundWp(''); }}
        title="Round Rest"
        actions={
          <>
            <button type="button" className="rest-modal-btn rest-modal-btn--cancel" onClick={() => { setRoundOpen(false); setRoundWp(''); }}>Cancel</button>
            <button type="button" className="rest-modal-btn rest-modal-btn--confirm" onClick={confirmRound}>Confirm</button>
          </>
        }
      >
        <div className="flex flex-col gap-[var(--space-md)]">
          <p className="text-[var(--color-text)] text-[length:var(--font-size-md)]">Roll a d6 for WP recovery.</p>
          <label className="flex flex-col gap-2 text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
            d6 Result (1–6)
            <input
              type="number"
              min={1}
              max={6}
              value={roundWp}
              onChange={e => setRoundWp(e.target.value)}
              className="rest-modal-input"
              placeholder="Enter 1–6"
              autoFocus
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={stretchOpen}
        onClose={() => { setStretchOpen(false); setStretchWp(''); setStretchHp(''); }}
        title="Stretch Rest"
        actions={
          <>
            <button type="button" className="rest-modal-btn rest-modal-btn--cancel" onClick={() => { setStretchOpen(false); setStretchWp(''); setStretchHp(''); }}>Cancel</button>
            <button type="button" className="rest-modal-btn rest-modal-btn--confirm" onClick={confirmStretch}>Confirm</button>
          </>
        }
      >
        <div className="flex flex-col gap-[var(--space-md)]">
          <p className="text-[var(--color-text)] text-[length:var(--font-size-md)]">Roll d6 for WP and HP recovery. WP is fully restored. HP is recovered by your roll result.</p>
          <label className="flex flex-col gap-2 text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
            WP d6 Result (1–6)
            <input type="number" min={1} max={6} value={stretchWp} onChange={e => setStretchWp(e.target.value)} className="rest-modal-input" placeholder="Enter 1–6" autoFocus />
          </label>
          <label className="flex flex-col gap-2 text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
            HP d6 Result (1–6)
            <input type="number" min={1} max={6} value={stretchHp} onChange={e => setStretchHp(e.target.value)} className="rest-modal-input" placeholder="Enter 1–6" />
          </label>
        </div>
      </Modal>
    </SectionPanel>
  );
}
