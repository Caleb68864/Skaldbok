import type { CharacterRecord } from '../../../types/character';
import type { DerivedValues } from '../../../utils/derivedValues';
import { dieCode, traitChance } from '../../../systems/savage-worlds/savageMath';
import { attrKey, resKey } from '../../../utils/statKeys';
import type { SystemEngine } from './types';

export const SAVAGE_WORLDS_ATTRIBUTE_IDS = ['agility', 'smarts', 'spirit', 'strength', 'vigor'];

/** A trait die's sides for a character, defaulting to d4 when unset. */
function dieSides(character: CharacterRecord, id: string): number {
  return character.attributes?.[id] ?? 4;
}

/** DerivedValues shape carrying Savage Worlds' Pace / Parry / Toughness. */
export interface SavageWorldsDerivedValues extends DerivedValues {
  pace: number;
  parry: number;
  toughness: number;
}

/**
 * Pace 6, Parry `2 + ½ Fighting`, Toughness `2 + ½ Vigor + armor`, Load Limit
 * `Strength × 5`. Parry reads a *skill* and Toughness folds in *equipped armor* —
 * the first derived stats to depend on more than attributes.
 */
export function computeSavageWorldsDerivedValues(character: CharacterRecord): SavageWorldsDerivedValues {
  const vigor = dieSides(character, 'vigor');
  const strength = dieSides(character, 'strength');
  const fighting = character.skills?.['fighting']?.value ?? 0;
  const armor = character.armor?.rating ?? 0;
  return {
    // Mandatory DerivedValues keys are unused by Savage Worlds (E14 would drop
    // them); kept at neutral values so the shared type is satisfied.
    hpMax: 0,
    wpMax: 0,
    movement: 6,
    damageBonus: '+0',
    aglDamageBonus: '+0',
    encumbranceLimit: strength * 5,
    pace: 6,
    parry: 2 + (fighting >= 4 ? Math.floor(fighting / 2) : 0),
    toughness: 2 + Math.floor(vigor / 2) + armor,
  };
}

/** Formats a trait die + its exploding-odds string, e.g. `d8 · 73%`. */
export function formatSavageSkill(value: number, wild = true): string {
  const pct = Math.round(traitChance(value, 4, { wild }) * 100);
  return `${dieCode(value)} · ${pct}%`;
}

/**
 * The Savage Worlds (SWADE) ruleset as a {@link SystemEngine} — the project's
 * third system and the one that exercises trait dice, level-based Wounds, and
 * live conditions.
 *
 * @remarks
 * Traits (attributes and skills) are **die codes**, shown via `attributeReadout`
 * `'dice'` mode and `skill.display`; success maths comes from
 * {@link ../../../systems/savage-worlds/savageMath}. Wounds and Fatigue are
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
    return dieCode(sides);
  },
  attributeIds: SAVAGE_WORLDS_ATTRIBUTE_IDS,
  attributeReadout: {
    mode: 'dice',
    format: (value, bonus) => dieCode(value, bonus),
  },
  skill: {
    valueLabel: 'Die',
    // Die sides, walked along the ladder rather than every integer.
    range: { min: 4, max: 12 },
    ladder: [4, 6, 8, 10, 12],
    advancementMax: 12,
    defaultValue: 4,
    display: (value) => formatSavageSkill(value),
    supportsMarks: false,
    // A skill "counts" once the character has trained it (bought a die above the
    // unskilled d4 baseline).
    isRelevant: skill => !!skill && (skill.trained || skill.value > 4),
    // The die is authored directly; unset skills sit at the unskilled d4.
    computeValue: () => 4,
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
  },
  labels: {
    abilitiesScreen: null,
    resourcesPanel: 'Wounds & Fatigue',
    attributesPanel: 'Attributes',
    encumbrance: 'Load Limit',
    participantHealth: 'Wounds',
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
  // Damage total vs Toughness (2 + ½ Vigor + Armor): under = nothing; at/over =
  // Shaken, or +1 Wound if already Shaken; +1 Wound per 4 over Toughness. E3.
  resolveDamage: (character, { total }) => {
    const toughness = computeSavageWorldsDerivedValues(character).toughness;
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
    levels: 3,
    penaltyPerLevel: -1,
    order: ['wounds'],
    overflowTo: [],
    downAtDepleted: 1,
    deadAtDepleted: null,
    downLabel: 'INCAPACITATED',
    deadLabel: 'DEAD',
  },
  rest: null,
  death: null,
  advancement: null,
  probability: {
    // Trait die + Wild Die vs TN 4 (PCs are Wild Cards). Boon/bane unused —
    // SWADE modifiers are numeric and folded into the target elsewhere.
    chance: value => traitChance(value, 4, { wild: true }),
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
    ...(system?.resources ?? []).map(r => ({
      id: resKey(r.id),
      label: r.name,
      group: 'Tracks',
    })),
  ],
};
