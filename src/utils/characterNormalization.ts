import type { CharacterRecord, CharacterResource, CharacterSkill } from '../types/character';
import type { AttributeDefinition, ResourceDefinition, SystemDefinition } from '../types/system';

/**
 * Rounds a value into `[min, max]`, substituting `fallback` for anything
 * non-finite.
 *
 * @remarks
 * `max` is `Infinity` wherever no ruleset declares a ceiling. Every bound here
 * used to be a literal, and a literal ceiling is indistinguishable from silent
 * truncation: a Traveller purse holding 2,400,000 credits was rewritten to
 * 999,999 on the next save, with no message and no way back.
 */
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

/**
 * Coerces one attribute against its own definition.
 *
 * @remarks
 * These bounds used to be the literals `1..30`, defaulting to `10` — Dragonbane's
 * range, applied to every system on every save. A Traveller characteristic
 * legitimately at 0 was rewritten to 1, and 10 is not a rung on a Savage Worlds
 * die ladder. With no definition to measure against, the value is made finite
 * and integral and otherwise left alone: normalisation exists to stop a
 * malformed field crashing the sheet, not to enforce a ruleset nobody declared.
 *
 * A `die-ladder` attribute snaps to the nearest rung at or below the value, so a
 * d7 written by a bad import reads as d6 rather than as an off-ladder number the
 * stepper cannot move.
 */
function normalizeAttribute(value: unknown, definition: AttributeDefinition | undefined): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!definition) return Number.isFinite(num) ? Math.round(num) : 0;
  if (!Number.isFinite(num)) return definition.min;

  const clamped = clampNumber(num, definition.min, definition.max, definition.min);
  const ladder = definition.scale?.kind === 'die-ladder' ? definition.scale.ladder : null;
  if (!ladder || ladder.length === 0 || ladder.includes(clamped)) return clamped;

  // `allowsPlus` extends past the top rung (d12+1, d12+2), so anything above it
  // stays as written rather than being snapped back down to d12.
  const top = Math.max(...ladder);
  if (definition.scale?.allowsPlus && clamped > top) return clamped;

  const below = ladder.filter(rung => rung <= clamped);
  return below.length > 0 ? Math.max(...below) : Math.min(...ladder);
}

/**
 * Coerces one resource against its own definition.
 *
 * @remarks
 * The floor comes from `ResourceDefinition.min` when the system declares the
 * resource. There is no ceiling: `defaultMax` is a starting value, not a limit,
 * and nothing in a `SystemDefinition` states one — so the old literal `999` was
 * this module's invention, and it truncated any ruleset with larger pools.
 *
 * `current` is still held inside `[min, max]`. That is a structural invariant of
 * the pair rather than a rule of any particular game, and it is what stops a
 * resource bar rendering past its own track.
 */
function normalizeResource(
  resource: CharacterResource | undefined,
  definition: ResourceDefinition | undefined,
): CharacterResource {
  const min = definition?.min ?? 0;
  const max = clampNumber(resource?.max, min, Infinity, min);
  const current = clampNumber(resource?.current, min, max, min);
  return { current, max };
}

/**
 * Coerces one skill value into the ruleset's declared range.
 *
 * @remarks
 * `range` is the engine's `skill.range`, passed down by a caller that holds an
 * engine. Without one there is no ceiling, for the same reason
 * {@link normalizeAttribute} leaves an undeclared attribute alone: a hardcoded
 * 20 is Dragonbane's ladder applied to every ruleset, and it silently truncated
 * any user-authored system with a wider range on every single save.
 */
function normalizeSkill(
  skill: CharacterSkill | undefined,
  range: { min: number; max: number } | undefined,
): CharacterSkill {
  const min = range?.min ?? 0;
  return {
    value: clampNumber(skill?.value, min, range?.max ?? Infinity, min),
    trained: skill?.trained === true,
    dragonMarked: skill?.dragonMarked === true,
    demonMarked: skill?.demonMarked === true,
  };
}

/**
 * Coerces a character record into well-formed, in-range values without changing
 * its identity.
 *
 * @remarks
 * A defensive pass run so a malformed field — a string where a number belongs, a
 * `current` above its `max`, a missing array — cannot crash the sheet. Every
 * clamp is generic over whatever keys are present (metadata, attributes,
 * resources, wealth) rather than assuming one ruleset's field set, so a
 * Traveller or user-authored character is normalised as safely as a Dragonbane
 * one. Unrelated fields are spread through untouched.
 *
 * Pass the character's `SystemDefinition` and attribute bounds come from it.
 * Without one the range cannot be known, so a value is only made finite —
 * better than silently rewriting a legal score to fit a ruleset the character
 * does not use.
 *
 * `skillRange` is a separate option because the skill range lives on the
 * `SystemEngine`, and importing the engine here would close a cycle back
 * through `ActiveCharacterContext`. Callers that hold an engine should pass
 * `engine.skill.range`. **There is no default range.** There used to be
 * `0..20` — Dragonbane's ladder, applied on every save to every system,
 * including a user-authored one whose skills run to 100. Authoring your own
 * system is this app's headline feature; a value the author entered legally is
 * not this module's to rewrite.
 *
 * @param character - The record to normalise.
 * @param options - The character's system definition, and its skill range.
 */
export function normalizeCharacter(
  character: CharacterRecord,
  options?: { system?: SystemDefinition | null; skillRange?: { min: number; max: number } },
): CharacterRecord {
  const system = options?.system;
  const metadata = character.metadata ?? {};
  const attributeDefs = new Map((system?.attributes ?? []).map(a => [a.id, a]));
  const resourceDefs = new Map((system?.resources ?? []).map(r => [r.id, r]));
  const skillRange = options?.skillRange;
  const resources = Object.fromEntries(
    Object.entries(character.resources ?? {}).map(([id, resource]) => [
      id,
      normalizeResource(resource, resourceDefs.get(id)),
    ]),
  );
  const skills = Object.fromEntries(
    Object.entries(character.skills ?? {}).map(([id, skill]) => [id, normalizeSkill(skill, skillRange)]),
  );

  return {
    ...character,
    // Identity fields are declared per-system, so normalise whatever keys are
    // present rather than forcing one ruleset's field set onto every character.
    metadata: Object.fromEntries(
      Object.entries(metadata).map(([id, value]) => [id, typeof value === 'string' ? value : '']),
    ),
    attributes: Object.fromEntries(
      Object.entries(character.attributes ?? {}).map(([id, value]) => [
        id,
        normalizeAttribute(value, attributeDefs.get(id)),
      ]),
    ),
    conditions: character.conditions ?? {},
    resources,
    skills,
    weapons: Array.isArray(character.weapons) ? character.weapons : [],
    inventory: Array.isArray(character.inventory) ? character.inventory : [],
    tinyItems: Array.isArray(character.tinyItems) ? character.tinyItems : [],
    storyBank: Array.isArray(character.storyBank) ? character.storyBank : [],
    abilities: Array.isArray(character.abilities) ? character.abilities : [],
    // Money is keyed by the system's own denomination ids, so clamp each entry
    // generically instead of assuming gold/silver/copper. Non-negative and
    // whole, and nothing more: the ceiling here was 999,999, which is a
    // reasonable amount of Dragonbane gold and roughly a month of one
    // Traveller trade run. A ruleset that wanted a limit would have to declare
    // one, and none does.
    wealth: Object.fromEntries(
      Object.entries(character.wealth ?? {}).map(([id, amount]) => [
        id,
        clampNumber(amount, 0, Infinity, 0),
      ]),
    ),
    // Custom skill definitions are rendered as rows like any declared skill, so
    // an entry missing its id or name would surface as a nameless, unfixable
    // row. Dropping it loses the definition but never the stored value, which
    // stays in `skills` and can be re-declared.
    ...(character.customSkills
      ? {
          customSkills: character.customSkills.filter(
            skill =>
              !!skill &&
              typeof skill.id === 'string' && skill.id.length > 0 &&
              typeof skill.name === 'string' && skill.name.length > 0 &&
              typeof skill.categoryId === 'string',
          ),
        }
      : {}),
    derivedOverrides: character.derivedOverrides ?? {},
    uiState: character.uiState ?? { expandedSections: [] },
  };
}
