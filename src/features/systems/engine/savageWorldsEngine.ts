import type { CharacterRecord } from '../../../types/character';
import { resolveArmorRating, getEffectiveValue, type DerivedValues } from '../../../utils/derivedValues';
import { dieCode, traitChance, decodeTraitDie, traitLadder, SAVAGE_TOP_DIE } from '../../../systems/savage-worlds/savageMath';
import { attrKey, resKey } from '../../../utils/statKeys';
import type { SystemEngine } from './types';

export const SAVAGE_WORLDS_ATTRIBUTE_IDS = ['agility', 'smarts', 'spirit', 'strength', 'vigor'];

/**
 * The unskilled trait die (d4) — Savage Worlds' skill floor. Named so the die
 * ladder's min, the default value, and the "is this skill trained?" threshold
 * all derive from ONE number: a clone that raises the floor edits it once
 * instead of five scattered `4` literals that would otherwise drift.
 */
const SAVAGE_UNSKILLED_DIE = 4;

/**
 * The trait-roll penalty per level of Wounds and of Fatigue, and the level each
 * track caps at.
 *
 * @remarks
 * One source for numbers that appeared twice: `savageTraitPenalty` applied them
 * and `damageTrack` *declared* them, with nothing tying the two together.
 * `damageTrack.penaltyPerLevel: -1` in particular was read by nothing at all —
 * it stated the rule the penalty function separately hardcoded, so editing the
 * declaration would have changed no behaviour while looking as though it had.
 *
 * SWADE caps the Wound penalty at −3 (a 4th wound is Incapacitation, not −4)
 * and Fatigue at −2 (a 3rd level is Incapacitation).
 */
/** How far past d12 a trait may advance: d12+1, d12+2. */
const SAVAGE_MAX_DIE_BONUS = 2;

const SAVAGE_PENALTY_PER_LEVEL = -1;
const SAVAGE_MAX_WOUND_LEVELS = 3;
const SAVAGE_MAX_FATIGUE_LEVELS = 2;

/**
 * A character's trait die, defaulting to d4 when unset.
 *
 * @remarks
 * Returns sides *and* bonus because SWADE advances past d12 with a flat bonus
 * rather than a bigger die. Reading the stored number as raw sides made a
 * Legendary d12+1 roll as a d13 — a die that does not exist, and strictly
 * better than the rule allows at every target.
 */
function traitDie(character: CharacterRecord, id: string) {
  return decodeTraitDie(character.attributes?.[id] ?? SAVAGE_UNSKILLED_DIE);
}

/** Half a trait die, the step used by Parry and Toughness. The flat bonus adds whole. */
function halfDie(die: { sides: number; bonus: number }): number {
  return Math.floor(die.sides / 2) + die.bonus;
}

/** DerivedValues shape carrying Savage Worlds' Pace / Parry / Toughness. */
export interface SavageWorldsDerivedValues extends DerivedValues {
  pace: number;
  parry: number;
  toughness: number;
}

/**
 * Toughness = `2 + ½ Vigor + Armor`, with armor-piercing `ap` stripping armor
 * first (floored at 0). Split out from {@link computeSavageWorldsDerivedValues}
 * so {@link savageWorldsEngine.resolveDamage} can apply AP without recomputing
 * Pace/Parry/Load. `ap` defaults to 0, so the derived-stats caller gets the
 * plain Toughness it always did.
 */
export function computeToughness(character: CharacterRecord, ap = 0): number {
  const vigor = traitDie(character, 'vigor');
  // Through the shared resolver so an `armor:armor` temp modifier reaches
  // Toughness. Reading `character.armor.rating` raw made every such modifier
  // inert, including in this formula — the one place armour is arithmetic
  // rather than display.
  const armor = resolveArmorRating(character, 'armor');
  const effectiveArmor = Math.max(0, armor - Math.max(0, ap));
  return 2 + halfDie(vigor) + effectiveArmor;
}

/**
 * SWADE derived stats: Pace 6, Parry `2 + ½ Fighting`, Toughness `2 + ½ Vigor +
 * armor`, Load Limit `Strength × 5`. Parry reads a *skill* and Toughness folds in
 * *equipped armor* — the first derived stats to depend on more than attributes.
 * hpMax/wpMax/movement/damageBonus are held at neutral values only to satisfy the
 * shared DerivedValues type (see the inline note).
 */
export function computeSavageWorldsDerivedValues(character: CharacterRecord): SavageWorldsDerivedValues {
  const strength = traitDie(character, 'strength');
  const fighting = character.skills?.['fighting']?.value ?? 0;
  return {
    // E14: DerivedValues mandates hpMax/wpMax/movement/damageBonus/aglDamageBonus,
    // none of which Savage Worlds uses. Held at neutral values to satisfy the
    // shared type. SAFE ONLY BECAUSE: (a) SWADE declares no resource with id
    // 'hp'/'wp', so PrintableSheet.maxFor never reads hpMax/wpMax, and (b) these

    // Savage Worlds computes none of Dragonbane's derived stats, and no longer
    // returns neutral placeholders for them: the derived block is an open map,
    // so a stat this ruleset has no concept of is simply absent. `movement` in
    // particular used to be 6 — Pace's value, which reads as meaningful and is
    // not. Pace is the real SWADE stat and is declared below.
    // Load Limit is Strength x5, and a d12+1 Strength carries as a 13 would.
    encumbranceLimit: (strength.sides + strength.bonus) * 5,
    pace: 6,
    // Parry = 2 + ½ Fighting die. Fighting reads `.value ?? 0` (an unskilled
    // Fighting is effectively 0 → Parry 2), not dieSides(); the `>= 4` guard keeps
    // any stray sub-d4 value from contributing a half-step.
    parry: 2 + (fighting >= SAVAGE_UNSKILLED_DIE ? halfDie(decodeTraitDie(fighting)) : 0),
    toughness: computeToughness(character),
  };
}

/**
 * The flat penalty on every trait roll from the character's current state: −1 per
 * Wound and per Fatigue level, −2 Distracted, −2 Entangled. Wounds/Fatigue read
 * the level tracks; the two conditions are SWADE's own, so listing them here (in
 * the SWADE adapter) is the ruleset stating its own rule, not a cross-system leak.
 */
export function savageTraitPenalty(character: CharacterRecord): number {
  let mod = 0;
  // The damage-track model already bounds these, but clamp here too so a
  // hand-edited or imported over-max value can't produce a runaway penalty.
  // Read through the shared resolver so a `res:wounds` / `res:fatigue` temp
  // modifier reaches the penalty. Reading `.current` raw made both of those
  // targets — which the modifier picker offers — completely inert.
  const track = (id: string) =>
    character.resources?.[id] ? Math.max(0, getEffectiveValue(resKey(id), character).effective) : 0;
  mod += SAVAGE_PENALTY_PER_LEVEL * Math.min(track('wounds'), SAVAGE_MAX_WOUND_LEVELS);
  mod += SAVAGE_PENALTY_PER_LEVEL * Math.min(track('fatigue'), SAVAGE_MAX_FATIGUE_LEVELS);
  if (character.conditions?.['distracted']) mod -= 2;
  if (character.conditions?.['entangled']) mod -= 2;
  return mod;
}

/** Formats a trait die + its exploding-odds string, e.g. `d8 · 73%` (penalty folded in). */
export function formatSavageSkill(value: number, penalty = 0, wild = true): string {
  // A stored 13 is d12+1, not a d13: the die bonus joins the situational
  // penalty in the roll modifier, and the die code prints it.
  const die = decodeTraitDie(value);
  const pct = Math.round(traitChance(die.sides, 4, { wild, bonus: penalty + die.bonus }) * 100);
  const penLabel = penalty !== 0 ? ` (${penalty > 0 ? '+' : ''}${penalty})` : '';
  return `${dieCode(die.sides, die.bonus)} · ${pct}%${penLabel}`;
}

/**
 * The Savage Worlds (SWADE) ruleset as a {@link SystemEngine} — the project's
 * third system and the one that exercises trait dice, level-based Wounds, and
 * live conditions.
 *
 * @remarks
 * Traits (attributes and skills) are **die codes**, shown via `attributeReadout`
 * `'dice'` mode and `skill.display`; success maths comes from
 * `systems/savage-worlds/savageMath`. Wounds and Fatigue are
 * accumulating level tracks (`damageTrack.kind: 'levels'`); Bennies refresh per
 * session. `rest`/`death`/`advancement` are `null` — SWADE recovery is trait
 * rolls and its dying rules are status-plus-table, not a fixed procedure.
 */
export const savageWorldsEngine: SystemEngine = {
  resolution: 'trait-die-vs-tn',
  hasMagic: false,
  attributeBadge: (attributeId, character) => {
    const sides = character.attributes?.[attributeId];
    if (sides === undefined || sides === null) return null;
    const die = decodeTraitDie(sides);
    return dieCode(die.sides, die.bonus);
  },
  attributeIds: SAVAGE_WORLDS_ATTRIBUTE_IDS,
  attributeReadout: {
    mode: 'dice',
    format: (value, bonus) => dieCode(value, bonus),
  },
  skill: {
    valueLabel: 'Die',
    // Die sides, walked along the ladder rather than every integer. The ladder
    // runs past d12 as 13/14 (= d12+1, d12+2): SWADE advances beyond the top
    // die with a flat bonus, and without those rungs the snap-to-nearest edit
    // in SkillsScreen pulls a stored 13 straight back to 12, silently undoing a
    // Legendary advance the first time the field is touched.
    range: { min: SAVAGE_UNSKILLED_DIE, max: SAVAGE_TOP_DIE + SAVAGE_MAX_DIE_BONUS },
    ladder: traitLadder([SAVAGE_UNSKILLED_DIE, 6, 8, 10, SAVAGE_TOP_DIE], true, SAVAGE_MAX_DIE_BONUS),
    advancementMax: SAVAGE_TOP_DIE + SAVAGE_MAX_DIE_BONUS,
    defaultValue: SAVAGE_UNSKILLED_DIE,
    display: (value, context) => formatSavageSkill(value, context ? savageTraitPenalty(context.character) : 0),
    supportsMarks: false,
    // A skill "counts" once the character has trained it (bought a die above the
    // unskilled d4 baseline).
    isRelevant: skill => !!skill && (skill.trained || skill.value > SAVAGE_UNSKILLED_DIE),
    // The die is authored directly; unset skills sit at the unskilled d4.
    computeValue: () => SAVAGE_UNSKILLED_DIE,
    trainedAffectsValue: false,
    supportsBoonBane: false,
  },
  derivedStats: character => computeSavageWorldsDerivedValues(character),
  resourceIds: ['wounds', 'fatigue', 'bennies'],
  panels: ['attributes', 'skills', 'resources', 'edges', 'hindrances', 'bennies', 'inventory', 'combat', 'notes'],
  currency: {
    mode: 'single',
    label: 'Cash',
    denominations: [
      { id: 'cash', label: 'Cash', abbr: '$', value: 1, step: 1, quickSteps: [1, 5, 10, 50, 100] },
    ],
    baseDenominationId: 'cash',
    formatAmount: baseUnits => {
      const sign = baseUnits < 0 ? '-' : '';
      return `${sign}$${Math.abs(baseUnits).toLocaleString('en-US')}`;
    },
    read: character => ({ cash: character.wealth?.cash ?? 0 }),
    write: (character, amounts) => ({ wealth: { ...character.wealth, ...amounts } }),
  },
  outcomes: [
    { id: 'raise', label: 'Success with a Raise', tone: 'critical' },
    { id: 'success', label: 'Success', tone: 'success' },
    { id: 'failure', label: 'Failure', tone: 'failure' },
    { id: 'critical-failure', label: 'Critical Failure', tone: 'fumble' },
  ],
  rollModifiers: [
    { id: 'gang-up', label: 'Gang Up (+1 each)' },
    { id: 'cover', label: 'Cover (−2/−4)' },
    { id: 'wild-attack', label: 'Wild Attack (+2)' },
  ],
  timeUnits: [
    { id: 'round', label: 'Round', abbrev: 'RND' },
    { id: 'scene', label: 'Scene', abbrev: 'SCN' },
    { id: 'session', label: 'Session', abbrev: 'SES' },
    { id: 'permanent', label: 'Permanent', abbrev: '∞' },
  ],
  terms: {
    abilities: 'Edges',
    spells: 'Powers',
    magicResource: 'PP',
    healthResource: 'Wounds',
    roleFallback: 'Wild Card',
    reservePot: 'Party fund',
  },
  labels: {
    abilitiesScreen: null,
    resourcesPanel: 'Wounds & Fatigue',
    attributesPanel: 'Attributes',
    encumbrance: 'Load Limit',
    participantHealth: 'Wounds',
    creatureHealth: 'Wounds',
    creatureArmor: 'Armor',
    creatureMovement: 'Pace',
    conditionExamples: 'e.g. Shaken, Distracted',
    encounterTagExamples: 'e.g. chase, social, mass battle',
    locationExample: 'e.g. The Saloon',
    armorFeatures: 'Notes',
    memento: null,
    tinyItems: null,
  },
  logActions: [
    { id: 'attack', label: 'attack' },
    { id: 'spell', label: 'power' },
    { id: 'ability', label: 'edge' },
    { id: 'damage', label: 'wound' },
    { id: 'heal', label: 'heal' },
    { id: 'condition', label: 'condition' },
    { id: 'note', label: 'note' },
  ],
  // Damage total vs Toughness (2 + ½ Vigor + Armor, less any armor-piercing):
  // under = nothing; at/over = Shaken, or +1 Wound if already Shaken; +1 Wound
  // per 4 over Toughness. `raises` is intentionally unused — SWADE attack raises
  // add to the damage roll (`total`) upstream, not to the wound count here. E3.
  resolveDamage: (character, { total, ap = 0 }) => {
    const toughness = computeToughness(character, ap);
    const levels: Record<string, number> = {};
    if (total < toughness) return { levels, setsConditions: [], noEffect: true };
    const extraWounds = Math.floor((total - toughness) / 4);
    const alreadyShaken = !!character.conditions?.['shaken'];
    const wounds = (alreadyShaken ? 1 : 0) + extraWounds;
    if (wounds > 0) levels.wounds = wounds;
    return { levels, setsConditions: ['shaken'] };
  },
  primaryHealthResourceId: 'wounds',
  // Wounds is a 0–3 level counter; Fatigue a parallel 0–2 counter. A full Wounds
  // track incapacitates a Wild Card (Extras drop at 1 — handled by status rules
  // later). Modelled as a level track; damage is applied as wounds, not points.
  damageTrack: {
    kind: 'levels',
    levels: SAVAGE_MAX_WOUND_LEVELS,
    penaltyPerLevel: SAVAGE_PENALTY_PER_LEVEL,
    order: ['wounds'],
    overflowTo: [],
    downAtDepleted: 1,
    deadAtDepleted: null,
    downLabel: 'INCAPACITATED',
    deadLabel: 'DEAD',
  },
  // No Arcane Background in the base ruleset; a caster build adds a PP pool later.
  magic: null,
  rest: null,
  death: null,
  advancement: null,
  probability: {
    // Trait die + Wild Die vs TN 4 (PCs are Wild Cards), with the character's
    // current Wound/Fatigue/condition penalty folded in.
    chance: (value, _state, context) =>
      ((die => traitChance(die.sides, 4, {
        wild: true,
        bonus: (context ? savageTraitPenalty(context.character) : 0) + die.bonus,
      }))(decodeTraitDie(value))),
  },
  derivedFields: [
    { key: 'pace', label: 'Pace', shortLabel: 'Pace' },
    { key: 'parry', label: 'Parry', shortLabel: 'Parry' },
    { key: 'toughness', label: 'Toughness', shortLabel: 'Tough' },
    {
      key: 'encumbranceLimit',
      label: 'Load Limit',
      shortLabel: 'Load',
      overridable: true,
      surfaces: ['dashboard', 'print'],
    },
  ],
  modifiableStats: system => [
    ...(system?.attributes ?? []).map(a => ({
      id: attrKey(a.id),
      label: a.abbreviation,
      group: 'Attributes',
    })),
    // Only the tracks that feed `savageTraitPenalty`. Bennies are a pool you
    // spend and refresh, not a stat anything derives from — a temporary
    // modifier on them could never change a number the app shows, so offering
    // one is a control that silently does nothing.
    ...(system?.resources ?? [])
      .filter(r => r.id === 'wounds' || r.id === 'fatigue')
      .map(r => ({
        id: resKey(r.id),
        label: r.name,
        group: 'Tracks',
      })),
  ],
};
