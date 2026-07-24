import type { CharacterRecord } from '../types/character';
import type { DamageApplication, DamageTrackModel } from '../features/systems/engine/types';

/**
 * Applies damage across a system's health resources.
 *
 * @remarks
 * Written as a pure function over the {@link DamageTrackModel} so the rule is
 * testable without a browser and identical everywhere it is used. Resources
 * count damage *up* toward `max` (a Traveller damage track), so "depleted"
 * means `current >= max`.
 *
 * The overflow target is the caller's choice rather than the model's, because
 * in Traveller the player decides whether a hit that drops END spills into STR
 * or DEX. Passing an id not listed in `overflowTo` is ignored, so a stale UI
 * cannot write damage somewhere the rules disallow.
 *
 * @param character - Character taking the damage.
 * @param model - The system's damage-track rules.
 * @param amount - Points of damage to apply; non-positive amounts are a no-op.
 * @param overflowTarget - Resource to take the remainder once `order` is full.
 */
export function applyDamage(
  character: CharacterRecord,
  model: DamageTrackModel,
  amount: number,
  overflowTarget?: string,
): DamageApplication {
  const resources: Record<string, number> = {};
  const dealt: Record<string, number> = {};
  let remaining = Math.max(0, Math.floor(amount));

  const currentOf = (id: string) => character.resources?.[id]?.current ?? 0;
  const maxOf = (id: string) => character.resources?.[id]?.max ?? 0;

  // Only spill into a track the model actually permits.
  const overflow = overflowTarget && model.overflowTo.includes(overflowTarget) ? [overflowTarget] : [];
  const sequence = [...model.order, ...overflow];

  for (const id of sequence) {
    if (remaining <= 0) break;
    const room = Math.max(0, maxOf(id) - currentOf(id));
    if (room === 0) continue;
    const applied = Math.min(room, remaining);
    resources[id] = currentOf(id) + applied;
    dealt[id] = applied;
    remaining -= applied;
  }

  // Depletion is judged across every track the model knows about, not just the
  // ones this hit touched — a character already at 0 STR is still down.
  const allTracks = [...new Set([...model.order, ...model.overflowTo])];
  const depleted = allTracks.filter(id => {
    const current = resources[id] ?? currentOf(id);
    return maxOf(id) > 0 && current >= maxOf(id);
  });

  const status: DamageApplication['status'] =
    model.deadAtDepleted !== null && depleted.length >= model.deadAtDepleted
      ? 'dead'
      : depleted.length >= model.downAtDepleted
        ? 'down'
        : 'ok';

  return { resources, dealt, unassigned: remaining, depleted, status };
}

/**
 * Current status without applying any damage, for rendering a standing banner.
 */
export function damageStatus(
  character: CharacterRecord,
  model: DamageTrackModel,
): DamageApplication['status'] {
  return applyDamage(character, model, 0).status;
}
