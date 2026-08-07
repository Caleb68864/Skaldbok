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
  /**
   * The score each DM was computed from — after temp modifiers and damage.
   *
   * @remarks
   * Surfaces alongside `characteristicDMs` so a display can show "END 7 (+0)"
   * without recomputing {@link effectiveCharacteristic} itself. The pair must
   * come from one number: a screen deriving the score separately would print a
   * score and a DM that disagree the moment a character takes damage.
   */
  characteristicScores: Record<string, number>;
  initiativeDM: number;
  /** Sum of every skill level the character holds. */
  skillLevelTotal: number;
  /** The creation budget those levels were meant to fit: 3 × (INT + EDU). */
  creationSkillCap: number;
}

/**
 * Total skill levels held, against the budget character creation allows.
 *
 * @remarks
 * Mongoose caps total skill levels at creation to 3 × (INT + EDU). Nothing in
 * the app surfaced it, so a hand-built character had no way to check the one
 * arithmetic constraint creation imposes.
 *
 * Reads the *base* characteristics, not the damaged ones — the cap is a fact
 * about how the character was built, and a hit in a firefight must not appear
 * to retroactively overspend it.
 *
 * Counts levels only. A trained-at-0 speciality costs nothing, which is exactly
 * why Traveller hands them out a group at a time.
 */
export function computeSkillBudget(character: CharacterRecord): { total: number; cap: number } {
  const total = Object.values(character.skills ?? {}).reduce((sum, skill) => sum + (skill?.value ?? 0), 0);
  const int = character.attributes?.['int'] ?? 0;
  const edu = character.attributes?.['edu'] ?? 0;
  return { total, cap: 3 * (int + edu) };
}

/** Computes the six characteristic DMs (and an initiative DM = DEX DM) for a Traveller character. */
export function computeTravellerDerivedValues(character: CharacterRecord): TravellerDerivedValues {
  const characteristicDMs: Record<string, number> = {};
  const characteristicScores: Record<string, number> = {};
  for (const id of TRAVELLER_ATTRIBUTE_IDS) {
    const score = effectiveCharacteristic(character, id);
    characteristicScores[id] = score;
    characteristicDMs[id] = characteristicToDM(score);
  }
  const initiativeDM = characteristicDMs['dex'] ?? 0;
  const budget = computeSkillBudget(character);

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
    characteristicScores,
    initiativeDM,
    skillLevelTotal: budget.total,
    creationSkillCap: budget.cap,
  };
}

/**
 * The Average-difficulty target every displayed probability assumes.
 *
 * @remarks
 * Traveller sets a target per task — Simple 2+ through Impossible 16+, a table
 * the app renders in its own Quick Reference. Nothing in the UI selects one, so
 * every number here is Average. The constant exists so the two surfaces that
 * compute odds cannot drift apart, and so the displayed string can *say* which
 * target it assumed: an unqualified "83%" reads as the odds for whatever the GM
 * just called, which at Difficult (10+) would be 42%.
 *
 * `twoD6SuccessProbability` and `threeD6KeepTwoProbability` already take the
 * target as a parameter, so a difficulty selector is a UI change, not a maths
 * one.
 */
export const TRAVELLER_DEFAULT_TARGET = 8;

/** The book's penalty for attempting a skill the character does not have at all. */
export const UNSKILLED_DM = -3;

/**
 * The skill whose entire rule is "reduce the unskilled penalty by your level".
 *
 * @remarks
 * A ruleset fact, so it lives in this adapter rather than in a screen. It is a
 * skill id from `system.json`, not a label, so renaming the skill's display name
 * cannot break the rule.
 */
export const JACK_OF_ALL_TRADES_SKILL_ID = 'jackOfAllTrades';

/**
 * The unskilled DM this character actually suffers, after Jack of All Trades.
 *
 * @remarks
 * Floors at 0: JoT cancels the penalty, it never becomes a bonus, so a JoT 4
 * character rolls an unskilled task exactly as well as a level-0 one and no
 * better.
 *
 * Reads the level alone and ignores the `trained` flag. A trained-at-0 JoT and
 * an absent one both reduce the penalty by 0, so the two states are already
 * indistinguishable here — an explicit `trained` check looked meaningful but
 * could not change any result, which mutation-checking confirmed.
 */
export function unskilledPenalty(character: CharacterRecord): number {
  const level = character.skills?.[JACK_OF_ALL_TRADES_SKILL_ID]?.value ?? 0;
  return Math.min(0, UNSKILLED_DM + level);
}

/**
 * Formats a Traveller skill's level + linked-characteristic DM + 2d6 success
 * probability against {@link TRAVELLER_DEFAULT_TARGET}.
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
  unskilledDM = UNSKILLED_DM,
): string {
  // Attempting a skill the character doesn't have is at DM −3 (Traveller's
  // unskilled penalty), reduced by Jack of All Trades — see
  // {@link unskilledPenalty}. Folded into the odds so an untrained skill shows
  // the honest chance, not its trained-at-0 baseline.
  const penalty = unskilled ? unskilledDM : 0;
  const effectiveModifier = value + characteristicDM + penalty;
  const target = TRAVELLER_DEFAULT_TARGET;
  const prob =
    boonBane === 'boon'
      ? threeD6KeepTwoProbability(target, effectiveModifier, 'best')
      : boonBane === 'bane'
        ? threeD6KeepTwoProbability(target, effectiveModifier, 'worst')
        : twoD6SuccessProbability(target, effectiveModifier);
  const dmLabel = characteristicDM !== 0 ? ` · DM ${formatDM(characteristicDM)}` : '';
  // Names the penalty actually applied rather than the book's -3, so a Jack of
  // All Trades character can see their training doing something.
  const unskilledLabel = unskilled
    ? penalty === 0
      ? ' · no unskilled penalty'
      : ` · ${formatDM(penalty)} unskilled`
    : '';
  const levelLabel = unskilled ? 'Unskilled' : `Level ${value}`;
  const stateLabel = boonBane === 'boon' ? ' (boon)' : boonBane === 'bane' ? ' (bane)' : '';
  return `${levelLabel}${dmLabel}${unskilledLabel} · ${Math.round(prob * 100)}% vs ${target}+${stateLabel}`;
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
): { dm: number; unskilled: boolean; unskilledDM: number } {
  const linkedId = context?.linkedAttributeId;
  const dm = linkedId ? characteristicToDM(effectiveCharacteristic(context.character, linkedId)) : 0;
  const unskilled = context?.trained === false && value === 0;
  // Jack of All Trades reduces the penalty on every *other* skill. Applying it
  // to itself would let an untrained JoT roll bootstrap off a level it does not
  // have, so the skill under display is excluded from its own rule.
  const unskilledDM =
    context && context.skillId !== JACK_OF_ALL_TRADES_SKILL_ID
      ? unskilledPenalty(context.character)
      : UNSKILLED_DM;
  return { dm, unskilled, unskilledDM };
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
      const { dm, unskilled, unskilledDM } = travellerRollContext(value, context);
      return formatSkillDisplay(value, dm, context?.boonBane ?? 'none', unskilled, unskilledDM);
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
    // Nothing in this panel is derived in the Dragonbane sense — a
    // characteristic score is authored, and its DM is just how that score reads
    // at the table. "Stats" is what a Traveller player calls them.
    derivedPanel: 'Stats',
    encumbrance: 'Encumbrance',
    // Traveller has no hit points; END is the pool a hit actually depletes.
    participantHealth: 'Current END',
    creatureHealth: 'END',
    creatureArmor: 'Armour',
    creatureMovement: 'Mv',
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
    // A depleted physical track is what "Unconscious" means in Mongoose 2e, so
    // the stored flag follows the banner instead of the two disagreeing.
    // `wounded` is left to the player: its description ("Physical damage track
    // is depleted") overlaps, but a GM may want it ticked before a full
    // depletion, and auto-owning it would fight them.
    statusConditions: {
      down: ['unconscious'],
      dead: ['unconscious'],
    },
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
      const { dm, unskilled, unskilledDM } = travellerRollContext(value, context);
      const modifier = value + dm + (unskilled ? unskilledDM : 0);
      if (state === 'boon') return threeD6KeepTwoProbability(TRAVELLER_DEFAULT_TARGET, modifier, 'best');
      if (state === 'bane') return threeD6KeepTwoProbability(TRAVELLER_DEFAULT_TARGET, modifier, 'worst');
      return twoD6SuccessProbability(TRAVELLER_DEFAULT_TARGET, modifier);
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
    {
      // Print only. It is a creation-time check, and a permanent sheet tile
      // reading "18 / 51" is noise for the rest of a character's life — but it
      // is exactly what you want on the sheet you build a character against.
      key: 'skillLevelTotal',
      label: 'Skill Levels Spent',
      shortLabel: 'Skills',
      surfaces: ['print'],
    },
    {
      key: 'creationSkillCap',
      label: 'Creation Cap (3 × INT+EDU)',
      shortLabel: 'Cap',
      surfaces: ['print'],
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
