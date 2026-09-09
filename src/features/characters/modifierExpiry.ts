import type { CharacterRecord, TempModifier } from '../../types/character';
import type { SystemEngine, TimeUnit } from '../systems/engine/types';
import * as characterRepository from '../../storage/repositories/characterRepository';
import * as systemRepository from '../../storage/repositories/systemRepository';
import { getEngine } from '../systems/engine';

/** Something that can end a temporary modifier. */
export type ExpiryTrigger =
  | { kind: 'rest'; restId: string }
  | { kind: 'sessionStart' }
  | { kind: 'encounterEnd' };

/**
 * Whether a time unit ends on this trigger.
 *
 * @remarks
 * A unit with no `expiresOn` never expires on its own — Dragonbane's
 * `permanent`, and any unit a user-authored system forgot to describe. Silence
 * means "leave it alone": dropping a buff nobody asked to drop is worse than
 * leaving one the player can remove by hand.
 */
function unitEndsOn(unit: TimeUnit | undefined, trigger: ExpiryTrigger): boolean {
  const rules = unit?.expiresOn;
  if (!rules) return false;
  switch (trigger.kind) {
    case 'rest':
      return rules.rest === trigger.restId;
    case 'sessionStart':
      return rules.sessionStart === true;
    case 'encounterEnd':
      return rules.encounterEnd === true;
  }
}

/**
 * The modifiers a trigger ends, and what would be left.
 *
 * @remarks
 * Pure, so the confirmation prompt and the write path agree on the answer.
 * A modifier whose `duration` names no declared time unit is never expired:
 * that is data from another system or an older version, and guessing at it
 * would silently delete something the player still wants.
 *
 * @param character - Character whose modifiers are being examined.
 * @param engine - The active engine, for its declared time units.
 * @param trigger - What just happened.
 */
export function modifiersEndingOn(
  character: CharacterRecord | null | undefined,
  engine: Pick<SystemEngine, 'timeUnits'>,
  trigger: ExpiryTrigger,
): { expiring: TempModifier[]; remaining: TempModifier[] } {
  const active = character?.tempModifiers ?? [];
  const units = new Map(engine.timeUnits.map(u => [u.id, u]));
  const expiring = active.filter(m => unitEndsOn(units.get(m.duration), trigger));
  const expiringIds = new Set(expiring.map(m => m.id));
  return { expiring, remaining: active.filter(m => !expiringIds.has(m.id)) };
}

/**
 * Expires each character's modifiers for a trigger, and reports what went.
 *
 * @remarks
 * Each character is measured against its **own** system, because a party may
 * legitimately mix them and a Traveller Watch is not a Dragonbane Stretch.
 *
 * Best-effort per character, like the session resource refresh beside it: one
 * unreadable record must not stop the rest, and none of this should be able to
 * prevent a session starting or an encounter ending.
 *
 * @param characterIds - The party's linked character ids.
 * @param trigger - What just happened.
 * @returns Which characters lost which modifiers, for the caller to report.
 */
export async function expirePartyModifiers(
  characterIds: string[],
  trigger: ExpiryTrigger,
): Promise<{ characterName: string; expired: TempModifier[] }[]> {
  const results: { characterName: string; expired: TempModifier[] }[] = [];

  for (const id of characterIds) {
    try {
      const character = await characterRepository.getById(id);
      if (!character) continue;
      const system = await systemRepository.getById(character.systemId);
      const { expiring, remaining } = modifiersEndingOn(
        character,
        getEngine(system ?? undefined),
        trigger,
      );
      if (expiring.length === 0) continue;
      await characterRepository.patch(id, () => ({ tempModifiers: remaining }));
      results.push({ characterName: character.name, expired: expiring });
    } catch (e) {
      console.error('modifier expiry failed for', id, e);
    }
  }

  return results;
}
