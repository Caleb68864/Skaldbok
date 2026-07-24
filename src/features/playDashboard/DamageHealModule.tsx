import { useState } from 'react';
import { SectionPanel } from '../../components/primitives/SectionPanel';
import { nowISO } from '../../utils/dates';
import type { PlayModuleProps } from './types';
import { getEngine } from '../systems/engine';
import { applyDamage } from '../../utils/damageTrack';

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

  if (!model) return null;

  const labelFor = (id: string) => system?.resources.find(r => r.id === id)?.name ?? id.toUpperCase();

  /** Writes new track `current` values back to the character. */
  function writeResources(next: Record<string, number>) {
    updateCharacter(prev => {
      const resources = { ...prev.resources };
      for (const [id, current] of Object.entries(next)) {
        resources[id] = { ...resources[id], current };
      }
      return { resources, updatedAt: nowISO() };
    });
  }

  function handleTakeDamage() {
    const n = Number(dmgAmount);
    if (!Number.isFinite(n) || n <= 0) return;
    const result = applyDamage(character, model!, n, overflow, primary);
    const landed = Object.entries(result.dealt).map(([id, v]) => `${v} to ${labelFor(id)}`).join(', ');
    const parts = [landed ? `Took ${landed}.` : 'No room — every track is full.'];
    if (result.unassigned > 0) parts.push(`${result.unassigned} unassigned.`);
    if (result.status === 'dead') parts.push(model!.deadLabel);
    else if (result.status === 'down') parts.push(model!.downLabel);
    writeResources(result.resources);
    setMessage(parts.join(' '));
    setDmgAmount('');
  }

  function handleHeal() {
    const n = Number(healAmount);
    if (!Number.isFinite(n) || n <= 0 || !healTarget) return;
    const current = character.resources?.[healTarget]?.current ?? 0;
    const healed = Math.min(n, current);
    writeResources({ [healTarget]: current - healed });
    setMessage(healed > 0 ? `Healed ${healed} ${labelFor(healTarget)}.` : `${labelFor(healTarget)} already clear.`);
    setHealAmount('');
  }

  function handleRecoverAll() {
    writeResources(Object.fromEntries(tracks.map(id => [id, 0])));
    setMessage('Full recovery — all damage cleared.');
  }

  const status = applyDamage(character, model, 0).status;
  const btn =
    'min-h-[44px] px-3 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] cursor-pointer disabled:opacity-50 disabled:pointer-events-none';
  const field =
    'min-h-[44px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';

  return (
    <SectionPanel title="Take Damage & Heal" collapsible defaultOpen>
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
          <label className="flex flex-col text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
            Apply to
            <select value={primary} onChange={e => setPrimary(e.target.value)} aria-label="Damage primary target" className={`${field} mt-1`}>
              {tracks.map(id => <option key={id} value={id}>{labelFor(id)}</option>)}
            </select>
          </label>
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
          <label className="flex flex-col text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
            Target
            <select value={healTarget} onChange={e => setHealTarget(e.target.value)} aria-label="Heal target" className={`${field} mt-1`}>
              {tracks.map(id => <option key={id} value={id}>{labelFor(id)}</option>)}
            </select>
          </label>
          <button type="button" onClick={handleHeal} disabled={!healAmount} className={btn}>Heal</button>
          <button type="button" onClick={handleRecoverAll} className={btn}>Recover All</button>
        </div>

        {message && (
          <p className="m-0 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">{message}</p>
        )}
      </div>
    </SectionPanel>
  );
}
