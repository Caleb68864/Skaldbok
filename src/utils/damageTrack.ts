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
 * @param overflowTarget - Resource to take the remainder once the primary is full.
 * @param primaryTarget - The track damage lands on first. Defaults to the
 *   model's `order` (END for Traveller). Any track the model knows about is
 *   allowed, so the player can apply a hit straight to a chosen characteristic.
 */
export function applyDamage(
  character: CharacterRecord,
  model: DamageTrackModel,
  amount: number,
  overflowTarget?: string,
  primaryTarget?: string,
): DamageApplication {
  const resources: Record<string, number> = {};
  const dealt: Record<string, number> = {};
  let remaining = Math.max(0, Math.floor(amount));

  const currentOf = (id: string) => character.resources?.[id]?.current ?? 0;
  const maxOf = (id: string) => character.resources?.[id]?.max ?? 0;

  const allTracks = [...new Set([...model.order, ...model.overflowTo])];
  // Primary defaults to the model's order (END-first); a caller may name any
  // track the model knows about. Overflow stays restricted to `overflowTo`.
  const primary = primaryTarget && allTracks.includes(primaryTarget) ? [primaryTarget] : [...model.order];
  const chosenOverflow =
    overflowTarget && model.overflowTo.includes(overflowTarget) && overflowTarget !== primary[0]
      ? [overflowTarget]
      : [];
  // Continue through the model's remaining overflow tracks after the chosen one.
  // Stopping at `[primary, chosen]` meant a big hit stranded its remainder: with
  // STR/DEX/END all 7/7, 20 damage filled END and STR, silently dropped the last
  // 6, left DEX untouched, and reported `down` — so `deadAtDepleted: 3` was
  // unreachable in a single application and one hit could never kill.
  //
  // The player's choice still decides which track is hit *first*; the rest follow
  // the model's own order. Overflow stays restricted to `overflowTo`, so an
  // out-of-range choice falls back to that order rather than stranding the
  // damage — losing points silently is worse at the table than defaulting.
  const remainingOverflow = model.overflowTo.filter(
    id => id !== primary[0] && !chosenOverflow.includes(id),
  );
  const sequence = [...new Set([...primary, ...chosenOverflow, ...remainingOverflow])];

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
 * Condition flags implied by a damage status, per the model's own declaration.
 *
 * @remarks
 * Returns every id the model claims for `down`/`dead`, mapped to whether it
 * should now be set. A status of `'ok'` clears them, so recovering fully does
 * not leave a stale "Unconscious" behind. Ids the model does not claim are
 * absent from the result and so are never written — a manually-ticked condition
 * is the player's, not ours.
 *
 * Empty when the system declares no mapping (Savage Worlds sets conditions
 * through `resolveDamage().setsConditions` instead).
 *
 * @param model - The system's damage-track rules.
 * @param status - Status reported by {@link applyDamage} or {@link damageStatus}.
 * @returns Condition id → whether it should be set.
 */
export function statusConditions(
  model: DamageTrackModel,
  status: DamageApplication['status'],
): Record<string, boolean> {
  const declared = model.statusConditions;
  if (!declared) return {};
  const owned = [...new Set([...(declared.down ?? []), ...(declared.dead ?? [])])];
  const active = new Set(
    status === 'dead'
      ? [...(declared.dead ?? []), ...(declared.down ?? [])]
      : status === 'down'
        ? (declared.down ?? [])
        : [],
  );
  return Object.fromEntries(owned.map(id => [id, active.has(id)]));
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
