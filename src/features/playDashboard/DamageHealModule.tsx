import { useState } from 'react';
import { SectionPanel } from '../../components/primitives/SectionPanel';
import { nowISO } from '../../utils/dates';
import type { PlayModuleProps } from './types';
import { getEngine } from '../systems/engine';
import { applyDamage, damageStatus, statusConditions } from '../../utils/damageTrack';
import { useSessionLog } from '../session/useSessionLog';

/**
 * The single place damage and healing are applied for a system with a cascading
 * damage track (Traveller). Replaces the per-track steppers in Vitals.
 *
 * @remarks
 * Damage: enter an amount, the track it lands on first ("Apply to", default the
 * model's primary), and where the remainder overflows; the engine's
 * {@link applyDamage} fills the primary then the overflow and reports what
 * landed where plus any down/out state. Healing is manual — Traveller has no
 * fixed rest ladder — so it just reduces a chosen track (or clears everything
 * with Recover All). Hidden for systems without a damage track.
 */
export function DamageHealModule({ character, system, updateCharacter }: PlayModuleProps) {
  const engine = getEngine(system);
  const model = engine.damageTrack;

  const tracks = model ? [...new Set([...model.order, ...model.overflowTo])] : [];
  const [dmgAmount, setDmgAmount] = useState('');
  const [primary, setPrimary] = useState(model?.order[0] ?? tracks[0] ?? '');
  const [overflow, setOverflow] = useState(model?.overflowTo[0] ?? '');
  const [healAmount, setHealAmount] = useState('');
  const [healTarget, setHealTarget] = useState(model?.order[0] ?? tracks[0] ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [confirmRecover, setConfirmRecover] = useState(false);
  const { logToSession, hasActiveSession } = useSessionLog();

  /**
   * Mirrors the on-screen outcome into the session log.
   *
   * @remarks
   * For a damage-track system this panel is the *only* surface that applies
   * damage — Vitals renders a read-only readout — so without this a whole fight
   * leaves no record. Not debounced: each application is one deliberate button
   * press, unlike the sheet's ± steppers.
   */
  function logOutcome(text: string) {
    if (!hasActiveSession) return;
    void logToSession(`${character.name}: ${text}`);
  }

  if (!model) return null;
  // Alias the narrowed model so its type survives into the handler closures,
  // where TS re-widens `model` to `... | null` (the reason for the old `!` asserts).
  const track = model;

  const labelFor = (id: string) => system?.resources.find(r => r.id === id)?.name ?? id.toUpperCase();

  /**
   * Writes new track `current` values back to the character, keeping any
   * status-implied condition flags in step.
   *
   * @remarks
   * Every path that changes the track — damage, heal, Recover All — goes through
   * here, which is why the condition sync lives here rather than in each handler.
   * Status is recomputed from the *post-write* resources, so healing out of an
   * unconscious state clears the flag as reliably as taking the hit set it.
   *
   * Previously nothing wrote these flags at all: the banner read UNCONSCIOUS
   * while `conditions.unconscious` stayed false, so the print sheet and every
   * export recorded a character who was up.
   */
  function writeResources(next: Record<string, number>) {
    updateCharacter(prev => {
      const resources = { ...prev.resources };
      for (const [id, current] of Object.entries(next)) {
        resources[id] = { ...resources[id], current };
      }
      const implied = statusConditions(
        track,
        damageStatus({ ...prev, resources } as typeof prev, track),
      );
      if (Object.keys(implied).length === 0) {
        return { resources, updatedAt: nowISO() };
      }
      return {
        resources,
        conditions: { ...prev.conditions, ...implied },
        updatedAt: nowISO(),
      };
    });
  }

  function handleTakeDamage() {
    const n = Number(dmgAmount);
    if (!Number.isFinite(n) || n <= 0) return;
    // Level-track systems (Savage Worlds) convert a rolled damage total to Wounds
    // via the engine's Toughness comparison, and set conditions (Shaken), rather
    // than subtracting points. E3.
    if (engine.resolveDamage && track.kind === 'levels') {
      const r = engine.resolveDamage(character, { total: n });
      updateCharacter(prev => {
        const resources = { ...prev.resources };
        for (const [id, add] of Object.entries(r.levels)) {
          const existing = resources[id];
          // The engine may name a track the character record lacks (older/imported
          // data): don't fabricate a maxless resource — skip it. Cap at the track's
          // own max, falling back to the model's level count, never a magic 99.
          if (!existing) continue;
          const max = existing.max ?? track.levels ?? add;
          resources[id] = { ...existing, current: Math.min((existing.current ?? 0) + add, max) };
        }
        const conditions = { ...prev.conditions };
        for (const c of r.setsConditions) conditions[c] = true;
        return { resources, conditions, updatedAt: nowISO() };
      });
      const woundsAdded = Object.values(r.levels).reduce((a, b) => a + b, 0);
      const parts: string[] = [];
      if (r.noEffect) parts.push(`Damage ${n} — no effect (under Toughness).`);
      else {
        if (r.setsConditions.includes('shaken')) parts.push('Shaken');
        if (woundsAdded > 0) parts.push(`+${woundsAdded} Wound${woundsAdded > 1 ? 's' : ''}`);
      }
      const levelsOutcome = parts.join(' · ') || 'No effect.';
      setMessage(levelsOutcome);
      logOutcome(`Damage ${n} — ${levelsOutcome}`);
      setDmgAmount('');
      return;
    }
    const result = applyDamage(character, track, n, overflow, primary);
    const landed = Object.entries(result.dealt).map(([id, v]) => `${v} to ${labelFor(id)}`).join(', ');
    const parts = [landed ? `Took ${landed}.` : 'No room — every track is full.'];
    if (result.unassigned > 0) parts.push(`${result.unassigned} unassigned.`);
    if (result.status === 'dead') parts.push(track.deadLabel);
    else if (result.status === 'down') parts.push(track.downLabel);
    writeResources(result.resources);
    const outcome = parts.join(' ');
    setMessage(outcome);
    logOutcome(outcome);
    setDmgAmount('');
  }

  function handleHeal() {
    const n = Number(healAmount);
    if (!Number.isFinite(n) || n <= 0 || !healTarget) return;
    const current = character.resources?.[healTarget]?.current ?? 0;
    const healed = Math.min(n, current);
    writeResources({ [healTarget]: current - healed });
    const outcome = healed > 0
      ? `Healed ${healed} ${labelFor(healTarget)}.`
      : `${labelFor(healTarget)} already clear.`;
    setMessage(outcome);
    if (healed > 0) logOutcome(outcome);
    setHealAmount('');
  }

  /**
   * Clears every damage track. Two-step: the first press arms, the second
   * fires.
   *
   * @remarks
   * There is no undo anywhere in the app for this, and the dashboard autosaves
   * within 500ms, so a mis-tap costs the player three remembered numbers. The
   * arm state clears itself after five seconds so it cannot be left hot.
   */
  function handleRecoverAll() {
    if (!confirmRecover) {
      setConfirmRecover(true);
      window.setTimeout(() => setConfirmRecover(false), 5000);
      return;
    }
    setConfirmRecover(false);
    writeResources(Object.fromEntries(tracks.map(id => [id, 0])));
    setMessage('Full recovery — all damage cleared.');
    logOutcome('Full recovery — all damage cleared.');
  }

  // Standing track status (no damage applied) — drives the down/dead banner below.
  const status = damageStatus(character, model);
  const btn =
    'min-h-[44px] px-3 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] cursor-pointer disabled:opacity-50 disabled:pointer-events-none';
  const field =
    'min-h-[44px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';

  return (
    <SectionPanel title={engine.labels.damageHealPanel ?? 'Take Damage & Heal'} collapsible defaultOpen>
      <div className="flex flex-col gap-[var(--space-sm)]">
        {status !== 'ok' && (
          <p role="status" className="m-0 text-center text-[length:var(--font-size-sm)] font-bold text-[var(--color-danger)]">
            {status === 'dead' ? model.deadLabel : model.downLabel}
          </p>
        )}

        {/* Damage */}
        <div className="flex flex-wrap items-end gap-[var(--space-xs)]">
          <label className="flex flex-col text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
            Damage
            <input type="number" min={1} value={dmgAmount} onChange={e => setDmgAmount(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleTakeDamage(); }}
              aria-label="Damage amount" className={`${field} w-20 mt-1`} />
          </label>
          {/* A single-track / auto-allocated system (Savage Worlds Wounds) gives the
              player no target choice — hide the selector. E13. */}
          {tracks.length > 1 && (
            <label className="flex flex-col text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
              Apply to
              <select value={primary} onChange={e => setPrimary(e.target.value)} aria-label="Damage primary target" className={`${field} mt-1`}>
                {tracks.map(id => <option key={id} value={id}>{labelFor(id)}</option>)}
              </select>
            </label>
          )}
          {model.overflowTo.length > 0 && (
            <label className="flex flex-col text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
              Overflow to
              <select value={overflow} onChange={e => setOverflow(e.target.value)} aria-label="Damage overflow target" className={`${field} mt-1`}>
                {model.overflowTo.map(id => <option key={id} value={id}>{labelFor(id)}</option>)}
              </select>
            </label>
          )}
          <button type="button" onClick={handleTakeDamage} disabled={!dmgAmount} className={btn}>Take Damage</button>
        </div>

        {/* Heal */}
        <div className="flex flex-wrap items-end gap-[var(--space-xs)] border-t border-[var(--color-border)] pt-[var(--space-sm)]">
          <label className="flex flex-col text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
            Heal
            <input type="number" min={1} value={healAmount} onChange={e => setHealAmount(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleHeal(); }}
              aria-label="Heal amount" className={`${field} w-20 mt-1`} />
          </label>
          {tracks.length > 1 && (
            <label className="flex flex-col text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
              Target
              <select value={healTarget} onChange={e => setHealTarget(e.target.value)} aria-label="Heal target" className={`${field} mt-1`}>
                {tracks.map(id => <option key={id} value={id}>{labelFor(id)}</option>)}
              </select>
            </label>
          )}
          <button type="button" onClick={handleHeal} disabled={!healAmount} className={btn}>Heal</button>
        </div>

        {/* Recover All — on its own row, and armed before it fires. It used to
            sit immediately right of Heal in identical styling, and Heal is
            `disabled:pointer-events-none` whenever the amount field is empty,
            so the common state left a dead zone with an irreversible full heal
            as the first live target to its right. */}
        <div className="flex flex-wrap items-center gap-[var(--space-xs)] border-t border-[var(--color-border)] pt-[var(--space-sm)]">
          <button
            type="button"
            onClick={handleRecoverAll}
            aria-label={confirmRecover ? 'Confirm full recovery' : 'Recover all damage'}
            className={`${btn} ${
              confirmRecover
                ? 'border-[var(--color-danger)] text-[var(--color-danger)] font-bold'
                : 'text-[var(--color-text-muted)]'
            }`}
          >
            {confirmRecover ? 'Tap again to confirm' : 'Recover All'}
          </button>
          {confirmRecover && (
            <button
              type="button"
              onClick={() => setConfirmRecover(false)}
              className={btn}
            >
              Cancel
            </button>
          )}
        </div>

        {message && (
          <p role="status" aria-live="polite" className="m-0 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">{message}</p>
        )}
      </div>
    </SectionPanel>
  );
}
