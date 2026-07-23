import { computeDerivedValues, computeSkillValue } from '../../../utils/derivedValues';
import { calcNormalProb, calcBoonProb, calcBaneProb, formatProb } from '../../../utils/boonBane';
import type { BoonBaneState } from '../../../utils/boonBane';
import { applyRoundRest, applyStretchRest, applyShiftRest } from '../../../utils/restActions';
import { attrKey, armorKey, derivedKey } from '../../../utils/statKeys';
import type { SystemEngine, RestDefinition } from './types';

/** Formats a skill's success probability string for the current boon/bane state. */
export function formatSkillProbability(value: number, state: BoonBaneState): string {
  const prob =
    state === 'boon' ? calcBoonProb(value) : state === 'bane' ? calcBaneProb(value) : calcNormalProb(value);
  return formatProb(prob);
}

/**
 * Dragonbane's three rests, expressed as data.
 *
 * @remarks
 * Each `apply` delegates to the existing pure helpers in `utils/restActions`
 * rather than restating the rules, so behaviour is unchanged.
 */
const classicFantasyRests: RestDefinition[] = [
  {
    id: 'round',
    label: 'Round Rest',
    prompt: {
      text: 'Roll a d6 for WP recovery.',
      die: 6,
      fields: [{ id: 'wp', label: 'd6 Result' }],
    },
    apply: (character, rolls) => {
      const result = applyRoundRest(character, rolls.wp ?? 0);
      const noop = result.alreadyFull && result.recovered === 0;
      return {
        resources: { wp: result.newWpCurrent },
        conditionsCleared: [],
        messages: [noop ? 'Already at full WP.' : `Recovered ${result.recovered} WP.`],
        noop,
      };
    },
  },
  {
    id: 'stretch',
    label: 'Stretch Rest',
    prompt: {
      text: 'Roll d6 for WP and HP recovery. WP is fully restored. HP is recovered by your roll result.',
      die: 6,
      fields: [
        { id: 'wp', label: 'WP d6 Result' },
        { id: 'hp', label: 'HP d6 Result' },
      ],
      clearOneCondition: true,
    },
    apply: (character, rolls, conditionToClear) => {
      const result = applyStretchRest(character, rolls.wp ?? 0, rolls.hp ?? 0, conditionToClear);
      const messages: string[] = [
        result.alreadyFullWp ? 'Already at full WP.' : 'WP restored to max.',
        result.alreadyFullHp && result.hpRecovered === 0
          ? 'Already at full HP.'
          : `Recovered ${result.hpRecovered} HP.`,
      ];
      return {
        resources: { wp: result.newWpCurrent, hp: result.newHpCurrent },
        conditionsCleared: result.conditionCleared ? [result.conditionCleared] : [],
        messages,
      };
    },
  },
  {
    id: 'shift',
    label: 'Shift Rest',
    // Ends the day: clears the round/stretch "used" marks.
    clearsRestTracker: true,
    apply: character => {
      const result = applyShiftRest(character);
      return {
        resources: {
          hp: character.resources['hp']?.max ?? 0,
          wp: character.resources['wp']?.max ?? 0,
        },
        conditionsCleared: result.conditionsCleared,
        messages: [
          result.hpRestored > 0 ? `Restored ${result.hpRestored} HP.` : 'HP already full.',
          result.wpRestored > 0 ? `Restored ${result.wpRestored} WP.` : 'WP already full.',
        ],
      };
    },
  },
];

export const classicFantasyEngine: SystemEngine = {
  resolution: 'd20-roll-under',
  hasMagic: true,
  attributeBadge: () => null,
  attributeIds: ['str', 'con', 'agl', 'int', 'wil', 'cha'],
  skill: {
    valueLabel: 'Value',
    range: { min: 0, max: 20 },
    // Dragonbane advancement stops at 18 even though the sheet accepts 20.
    advancementMax: 18,
    defaultValue: 0,
    display: (value: number) => `${value}`,
    supportsMarks: true,
    supportsBoonBane: true,
    // Roll-under: 0 means untrained, so a skill matters once trained or raised.
    isRelevant: skill => !!skill && (skill.value > 0 || skill.trained),
    computeValue: (skill, character, trained) =>
      skill.linkedAttributeId
        ? computeSkillValue(character.attributes?.[skill.linkedAttributeId] ?? 10, trained)
        : trained
          ? Math.max(skill.baseChance * 2, 1)
          : skill.baseChance,
    trainedAffectsValue: true,
  },
  derivedStats: (character, system) => computeDerivedValues(character, system),
  resourceIds: ['hp', 'wp'],
  panels: ['attributes', 'skills', 'resources', 'inventory', 'magic', 'combat', 'rest', 'death', 'notes'],
  currency: {
    mode: 'coins',
    denominations: [
      { id: 'gold', label: 'Gold', abbr: 'g', value: 100 },
      { id: 'silver', label: 'Silver', abbr: 's', value: 10 },
      { id: 'copper', label: 'Copper', abbr: 'c', value: 1 },
    ],
    read: character => ({
      gold: character.wealth?.gold ?? 0,
      silver: character.wealth?.silver ?? 0,
      copper: character.wealth?.copper ?? 0,
    }),
    write: (character, amounts) => ({
      wealth: { ...character.wealth, ...amounts },
    }),
  },
  outcomes: [
    { id: 'success', label: 'Success', tone: 'success' },
    { id: 'failure', label: 'Failure', tone: 'failure' },
    { id: 'dragon', label: 'Dragon (1)', tone: 'critical' },
    { id: 'demon', label: 'Demon (20)', tone: 'fumble' },
  ],
  rollModifiers: [
    { id: 'boon', label: 'Boon' },
    { id: 'bane', label: 'Bane' },
    { id: 'pushed', label: 'Pushed' },
  ],
  timeUnits: [
    { id: 'round', label: 'Round', abbrev: 'RND' },
    { id: 'stretch', label: 'Stretch', abbrev: 'STR' },
    { id: 'shift', label: 'Shift', abbrev: 'SHI' },
    { id: 'scene', label: 'Scene', abbrev: 'SCN' },
    { id: 'permanent', label: 'Permanent', abbrev: '∞' },
  ],
  terms: {
    abilities: 'Heroic Abilities',
    spells: 'Spells',
    magicResource: 'WP',
    healthResource: 'HP',
    roleFallback: 'Adventurer',
  },
  labels: {
    abilitiesScreen: 'Abilities / Magic',
    resourcesPanel: 'Resources',
    attributesPanel: 'Attributes',
    encumbrance: 'Encumbrance',
  },
  primaryHealthResourceId: 'hp',
  rest: classicFantasyRests,
  death: {
    triggerResourceId: 'hp',
    triggerAtOrBelow: 0,
    downLabel: 'Character is DOWN!',
    deadLabel: 'DEAD',
    stabilizedLabel: 'Stabilized!',
    tracks: [
      { id: 'deathRolls', label: 'Failures', max: 3, tone: 'danger' },
      { id: 'deathSuccesses', label: 'Successes', max: 3, tone: 'success' },
    ],
  },
  advancement: {
    sessionEvents: [
      { id: 'combat', label: '⚔️ Participated in combat' },
      { id: 'explore', label: '🗺️ Explored a new location' },
      { id: 'weakness', label: '💔 Role-played a weakness' },
      { id: 'heroic', label: '✨ Used a heroic ability' },
    ],
    usesMarks: true,
    maxSkillValue: 18,
    rollPrompt: value => `Roll above ${value} on a d20 to advance`,
  },
  probability: {
    chance: (value, state) =>
      state === 'boon' ? calcBoonProb(value) : state === 'bane' ? calcBaneProb(value) : calcNormalProb(value),
  },
  modifiableStats: system => [
    ...(system?.attributes ?? []).map(a => ({
      id: attrKey(a.id),
      label: a.abbreviation,
      group: 'Attributes',
    })),
    { id: armorKey('armor'), label: 'Armor Rating', group: 'Armor' },
    { id: armorKey('helmet'), label: 'Helmet Rating', group: 'Armor' },
    { id: derivedKey('movement'), label: 'Movement', group: 'Derived' },
    { id: derivedKey('hpMax'), label: 'Max HP', group: 'Derived' },
    { id: derivedKey('wpMax'), label: 'Max WP', group: 'Derived' },
  ],
  // Surfaces reproduce today's three distinct layouts exactly: the sheet shows
  // five rows (no encumbrance), the dashboard four (no HP/WP maxima, which the
  // vitals module already shows), and the print sheet four.
  derivedFields: [
    { key: 'movement', label: 'Movement', shortLabel: 'Move', overridable: true, surfaces: ['sheet', 'dashboard', 'print'] },
    { key: 'hpMax', label: 'HP Max', overridable: true, surfaces: ['sheet'] },
    { key: 'wpMax', label: 'WP Max', overridable: true, surfaces: ['sheet'] },
    { key: 'damageBonus', label: 'STR Damage Bonus', shortLabel: 'STR Dmg', overridable: true, surfaces: ['sheet', 'dashboard', 'print'] },
    { key: 'aglDamageBonus', label: 'AGL Damage Bonus', shortLabel: 'AGL Dmg', overridable: true, surfaces: ['sheet', 'dashboard', 'print'] },
    { key: 'encumbranceLimit', label: 'Encumbrance Limit', shortLabel: 'Carry', overridable: true, surfaces: ['dashboard', 'print'] },
  ],
};
