import type { CharacterRecord } from '../../../types/character';
import { getEffectiveValue, type DerivedValues } from '../../../utils/derivedValues';
import {
  characteristicToDM,
  twoD6SuccessProbability,
  threeD6KeepTwoProbability,
} from '../../../systems/traveller/travellerMath';
import { attrKey, resKey } from '../../../utils/statKeys';
import type { SystemEngine, SkillDisplayContext } from './types';

export const TRAVELLER_ATTRIBUTE_IDS = ['str', 'dex', 'end', 'int', 'edu', 'soc'];

/**
 * The characteristics that carry a damage track.
 *
 * @remarks
 * These ids intentionally collide with the resource ids of the same name —
 * `attr:str` is the characteristic, `res:str` is the damage taken to it. See
 * {@link utils/statKeys!statKey | statKey}.
 */
export const TRAVELLER_DAMAGE_TRACK_IDS = ['str', 'dex', 'end'];

/**
 * A characteristic's current score, after damage.
 *
 * @remarks
 * In Traveller, damage is applied *to the characteristic*, so a wounded
 * character rolls worse: END 7 with 5 damage is END 2, which is DM −2, not the
 * DM +0 the undamaged score would give. Every DM in this engine is derived from
 * this function rather than from `attributes` directly, so the damage track
 * actually bites. Characteristics without a track (INT/EDU/SOC) have no
 * matching resource and so are returned unchanged.
 *
 * Temp modifiers are folded into the base through `getEffectiveValue` under the
 * **namespaced** key, so `attr:str` (the characteristic) and `res:str` (damage
 * taken to it) stay distinct targets — a buff aimed at the damage track must not
 * move the score. Resolving the modified base here rather than at each call site
 * is what keeps the sheet's score and its DM badge derived from one number.
 */
export function effectiveCharacteristic(character: CharacterRecord, id: string): number {
  const base = getEffectiveValue(attrKey(id), character).effective;
  const damage = character.resources?.[id]?.current ?? 0;
  return Math.max(0, base - damage);
}

/**
 * Carry limit in kg: STR + END.
 *
 * @remarks
 * Deliberately a simple, legible default rather than an imported encumbrance
 * table — bundling the tables is what this project avoids. It reads the *base*
 * characteristics, not the damaged ones, so a hit mid-fight does not silently
 * make a character encumbered; and any character can override the computed
 * value from the sheet if a group plays it differently.
 */
export function computeTravellerCarryLimit(character: CharacterRecord): number {
  const str = character.attributes?.['str'] ?? 0;
  const end = character.attributes?.['end'] ?? 0;
  return str + end;
}

/** Formats a DM as a signed string, e.g. 2 -> '+2', -1 -> '-1'. */
export function formatDM(dm: number): string {
  return dm >= 0 ? `+${dm}` : `${dm}`;
}

/** DerivedValues shape extended with Traveller-specific characteristic DMs. */
export interface TravellerDerivedValues extends DerivedValues {
  characteristicDMs: Record<string, number>;
  initiativeDM: number;
}

/** Computes the six characteristic DMs (and an initiative DM = DEX DM) for a Traveller character. */
export function computeTravellerDerivedValues(character: CharacterRecord): TravellerDerivedValues {
  const characteristicDMs: Record<string, number> = {};
  for (const id of TRAVELLER_ATTRIBUTE_IDS) {
    characteristicDMs[id] = characteristicToDM(effectiveCharacteristic(character, id));
  }
  const initiativeDM = characteristicDMs['dex'] ?? 0;

  // hpMax/wpMax/movement/damageBonus/aglDamageBonus are Dragonbane-shaped fields
  // the base DerivedValues type still mandates. Traveller has none of them — it
  // surfaces its real stats (characteristicDMs, initiativeDM, encumbranceLimit)
  // separately — so these are inert placeholders. They MUST stay neutral (0/'+0'),
  // NOT a "meaningful" value: hpMax was previously END, a landmine that
  // PrintableSheet.maxFor would print as max HP for any system cloned from this
  // one that declares an `hp` resource. Traveller has no `hp` resource, so 0 here
  // is never read; keeping it honest protects future clones.
  return {
    hpMax: 0,
    wpMax: 0,
    movement: 0,
    damageBonus: '+0',
    aglDamageBonus: '+0',
    encumbranceLimit: computeTravellerCarryLimit(character),
    characteristicDMs,
    initiativeDM,
  };
}

/**
 * Formats a Traveller skill's level + linked-characteristic DM + 2d6-vs-8
 * success probability string.
 *
 * The DM is supplied by {@link travellerEngine}'s `skill.display`, which
 * resolves it from the {@link SkillDisplayContext} the shared skill screens
 * pass in. It defaults to 0 so callers holding only a raw level stay safe.
 */
export function formatSkillDisplay(
  value: number,
  characteristicDM = 0,
  boonBane: 'boon' | 'none' | 'bane' = 'none',
  unskilled = false,
): string {
  // Attempting a skill the character doesn't have is at DM −3 (Traveller's
  // unskilled penalty). Folded into the odds so an untrained skill shows the
  // honest chance, not its trained-at-0 baseline.
  const unskilledDM = unskilled ? -3 : 0;
  const effectiveModifier = value + characteristicDM + unskilledDM;
  const prob =
    boonBane === 'boon'
      ? threeD6KeepTwoProbability(8, effectiveModifier, 'best')
      : boonBane === 'bane'
        ? threeD6KeepTwoProbability(8, effectiveModifier, 'worst')
        : twoD6SuccessProbability(8, effectiveModifier);
  const dmLabel = characteristicDM !== 0 ? ` · DM ${formatDM(characteristicDM)}` : '';
  const unskilledLabel = unskilled ? ' · -3 unskilled' : '';
  const levelLabel = unskilled ? 'Unskilled' : `Level ${value}`;
  const stateLabel = boonBane === 'boon' ? ' (boon)' : boonBane === 'bane' ? ' (bane)' : '';
  return `${levelLabel}${dmLabel}${unskilledLabel} · ${Math.round(prob * 100)}%${stateLabel}`;
}

/**
 * The linked-characteristic DM and unskilled flag for one skill roll — the
 * single computation both `skill.display` and `probability.chance` need.
 * Extracted so the two surfaces cannot drift again (they disagreed once:
 * display reported 26% while chance reported 42% for the same untrained skill).
 * Untrained = the trained flag is explicitly false at level 0; a level implies
 * trained, and an undefined flag is treated as trained.
 */
function travellerRollContext(
  value: number,
  context: SkillDisplayContext | undefined,
): { dm: number; unskilled: boolean } {
  const linkedId = context?.linkedAttributeId;
  const dm = linkedId ? characteristicToDM(effectiveCharacteristic(context.character, linkedId)) : 0;
  const unskilled = context?.trained === false && value === 0;
  return { dm, unskilled };
}

/**
 * The Traveller ruleset, expressed as a {@link SystemEngine}.
 *
 * @remarks
 * Contrasts with {@link features/systems/engine/classicFantasyEngine!classicFantasyEngine | classicFantasyEngine} on almost every axis and is the
 * project's proof that ruleset-specific behaviour stays out of the screens:
 * 2d6-plus resolution instead of d20-roll-under, characteristic DMs instead of
 * flat scores, a cascading {@link features/systems/engine/types!DamageTrackModel | DamageTrackModel} (END then a chosen physical
 * characteristic) instead of a single HP pool, and `null` for the rest, death,
 * and advancement models because Traveller has no such fixed procedures — which
 * is how those panels get hidden.
 */
export const travellerEngine: SystemEngine = {
  resolution: '2d6-plus',
  hasMagic: false,
  attributeBadge: (attributeId, character) => {
    const score = character.attributes?.[attributeId];
    if (score === undefined || score === null) return null;
    return formatDM(characteristicToDM(effectiveCharacteristic(character, attributeId)));
  },
  attributeIds: TRAVELLER_ATTRIBUTE_IDS,
  skill: {
    valueLabel: 'Level',
    range: { min: 0, max: 6 },
    advancementMax: 6,
    defaultValue: 0,
    display: (value, context) => {
      const { dm, unskilled } = travellerRollContext(value, context);
      return formatSkillDisplay(value, dm, context?.boonBane ?? 'none', unskilled);
    },
    supportsMarks: false,
    // Traveller level 0 is a real (trained) skill, so presence of the trained
    // flag matters as much as a non-zero level.
    isRelevant: skill => !!skill && (skill.trained || skill.value > 0),
    // Levels are assigned during character creation; there is no attribute-derived
    // starting value, so an unset skill simply sits at 0.
    computeValue: () => 0,
    // Levels are authored directly; the trained flag must not rewrite them.
    trainedAffectsValue: false,
    // Boon/Bane use the canonical 3d6-keep-best/worst-two odds.
    supportsBoonBane: true,
  },
  derivedStats: character => computeTravellerDerivedValues(character),
  resourceIds: TRAVELLER_DAMAGE_TRACK_IDS,
  panels: ['characteristics', 'skills', 'resources', 'finances', 'careers', 'augments', 'inventory', 'combat', 'notes'],
  currency: {
    mode: 'single',
    label: 'Credits',
    denominations: [
      { id: 'credits', label: 'Credits', abbr: 'Cr', value: 1, step: 100, quickSteps: [1, 5, 10, 100, 1000, 10000] },
    ],
    read: character => ({ credits: character.wealth?.credits ?? 0 }),
    write: (character, amounts) => ({
      wealth: { ...character.wealth, ...amounts },
    }),
  },
  outcomes: [
    { id: 'exceptional-success', label: 'Exceptional Success', tone: 'critical' },
    { id: 'success', label: 'Success', tone: 'success' },
    { id: 'failure', label: 'Failure', tone: 'failure' },
    { id: 'exceptional-failure', label: 'Exceptional Failure', tone: 'fumble' },
  ],
  // No "pushed" mechanic in Traveller.
  rollModifiers: [
    { id: 'boon', label: 'Boon' },
    { id: 'bane', label: 'Bane' },
  ],
  // Reuses the existing TempModifier duration ids, relabelled for a sci-fi setting.
  timeUnits: [
    { id: 'round', label: 'Round', abbrev: 'RND' },
    { id: 'stretch', label: 'Watch', abbrev: 'WCH' },
    { id: 'shift', label: 'Day', abbrev: 'DAY' },
    { id: 'scene', label: 'Scene', abbrev: 'SCN' },
    { id: 'permanent', label: 'Permanent', abbrev: '∞' },
  ],
  terms: {
    abilities: 'Talents',
    spells: 'Psionic Powers',
    magicResource: 'PSI',
    healthResource: 'END',
    roleFallback: 'Traveller',
  },
  labels: {
    // null => the abilities/magic tab is hidden entirely rather than linking to
    // a dead-end screen. Set `labels.abilitiesScreen` in system.json to surface
    // it (e.g. "Psionics") once that content exists.
    abilitiesScreen: null,
    resourcesPanel: 'Damage Track',
    attributesPanel: 'Characteristics',
    encumbrance: 'Encumbrance',
    // Traveller has no hit points; END is the pool a hit actually depletes.
    participantHealth: 'Current END',
    conditionExamples: 'e.g. stunned, wounded',
    encounterTagExamples: 'e.g. boarding, starport, pirates',
    locationExample: 'e.g. Cargo Bay 3',
    armorFeatures: 'Features',
    // No keepsake concept in Traveller; the slot is hidden entirely.
    memento: null,
    // Weight-based encumbrance counts every item; no free "tiny" tier.
    tinyItems: null,
  },
  logActions: [
    { id: 'attack', label: 'attack' },
    // No spellcasting; 'spell' is reused as the psionics slot so already-logged
    // events keep resolving while the label reads correctly for the setting.
    { id: 'spell', label: 'psionics' },
    { id: 'ability', label: 'talent' },
    { id: 'damage', label: 'damage' },
    { id: 'heal', label: 'first aid' },
    { id: 'condition', label: 'condition' },
    { id: 'note', label: 'note' },
  ],
  primaryHealthResourceId: 'end',
  // Damage fills END first, then spills into whichever physical characteristic
  // the player chooses. Two empty tracks put a Traveller out of the fight;
  // all three is fatal.
  damageTrack: {
    order: ['end'],
    overflowTo: ['str', 'dex'],
    downAtDepleted: 2,
    deadAtDepleted: 3,
    downLabel: 'UNCONSCIOUS',
    deadLabel: 'DEAD',
  },
  // Psionics exist but the app does not automate a PP economy yet.
  magic: null,
  // Traveller recovery is Medic checks and downtime, not a fixed rest ladder.
  rest: null,
  // No death-roll track; a downed character is handled by the damage track.
  death: null,
  // Advancement is study/training time, not per-session rolls.
  advancement: null,
  probability: {
    // Skill level + linked-characteristic DM vs the default 8+ target.
    chance: (value, state, context) => {
      // Same DM + unskilled derivation as skill.display, via the shared helper,
      // so the two surfaces can't report different odds for the same roll.
      const { dm, unskilled } = travellerRollContext(value, context);
      const modifier = value + dm + (unskilled ? -3 : 0);
      if (state === 'boon') return threeD6KeepTwoProbability(8, modifier, 'best');
      if (state === 'bane') return threeD6KeepTwoProbability(8, modifier, 'worst');
      return twoD6SuccessProbability(8, modifier);
    },
  },
  derivedFields: [
    { key: 'initiativeDM', label: 'Initiative DM', shortLabel: 'Init' },
    {
      key: 'encumbranceLimit',
      label: 'Carry Limit (kg)',
      shortLabel: 'Carry',
      overridable: true,
      surfaces: ['dashboard', 'print'],
    },
  ],
  // Characteristics and damage-track resources share ids (str/dex/end), so the
  // namespace is what keeps `attr:str` and `res:str` distinct targets.
  modifiableStats: system => [
    ...(system?.attributes ?? []).map(a => ({
      id: attrKey(a.id),
      label: a.abbreviation,
      group: 'Characteristics',
    })),
    ...(system?.resources ?? []).map(r => ({
      id: resKey(r.id),
      label: r.name,
      group: 'Damage Track',
    })),
  ],
};
