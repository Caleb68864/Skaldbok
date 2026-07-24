import { useState } from 'react';
import type { CharacterRecord } from '../../types/character';
import type { SystemDefinition } from '../../types/system';
import type { DamageTrackModel } from '../systems/engine/types';
import { applyDamage, damageStatus } from '../../utils/damageTrack';

interface DamageTrackControlProps {
  character: CharacterRecord;
  system: SystemDefinition | null;
  model: DamageTrackModel;
  onApply: (resources: Record<string, number>, summary: string) => void;
}

/**
 * "Take damage" control for systems whose damage cascades across tracks.
 *
 * @remarks
 * Stepping each track by hand cannot express the rule: a 9-point hit on a
 * Traveller with END 7 fills END and puts 2 into STR or DEX, and the player
 * chooses which. This takes the total and the target, applies
 * {@link applyDamage}, and reports what landed where — including any damage
 * that had nowhere left to go.
 */
export function DamageTrackControl({ character, system, model, onApply }: DamageTrackControlProps) {
  const [amount, setAmount] = useState('');
  const [target, setTarget] = useState(model.overflowTo[0] ?? '');
  const [message, setMessage] = useState<string | null>(null);

  const labelFor = (id: string) => system?.resources.find(r => r.id === id)?.name ?? id.toUpperCase();
  const status = damageStatus(character, model);

  function handleApply() {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    const result = applyDamage(character, model, parsed, target);
    const landed = Object.entries(result.dealt)
      .map(([id, n]) => `${n} to ${labelFor(id)}`)
      .join(', ');

    const parts: string[] = [];
    parts.push(landed ? `Took ${landed}.` : 'No damage could be applied — every track is full.');
    if (result.unassigned > 0) parts.push(`${result.unassigned} unassigned.`);
    if (result.status === 'dead') parts.push(model.deadLabel);
    else if (result.status === 'down') parts.push(model.downLabel);

    onApply(result.resources, parts.join(' '));
    setMessage(parts.join(' '));
    setAmount('');
  }

  return (
    <div className="mt-[var(--space-sm)] flex flex-col gap-[var(--space-xs)] rounded-[var(--radius-sm)] border border-[var(--color-border)] p-[var(--space-sm)]">
      {status !== 'ok' && (
        <p
          role="status"
          className="m-0 text-center text-[length:var(--font-size-sm)] font-bold text-[var(--color-danger,#c0392b)]"
        >
          {status === 'dead' ? model.deadLabel : model.downLabel}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-[var(--space-xs)]">
        <label className="flex flex-col text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
          Damage
          <input
            type="number"
            min={1}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleApply(); }}
            aria-label="Damage amount"
            className="mt-1 w-20 min-h-11 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 text-[var(--color-text)]"
          />
        </label>
        {model.overflowTo.length > 0 && (
          <label className="flex flex-col text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
            Overflow to
            <select
              value={target}
              onChange={e => setTarget(e.target.value)}
              aria-label="Overflow target"
              className="mt-1 min-h-11 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 text-[var(--color-text)]"
            >
              {model.overflowTo.map(id => (
                <option key={id} value={id}>{labelFor(id)}</option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={handleApply}
          disabled={!amount}
          className="min-h-11 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[var(--color-text)] disabled:opacity-60"
        >
          Take Damage
        </button>
      </div>
      {message && (
        <p className="m-0 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">{message}</p>
      )}
    </div>
  );
}
