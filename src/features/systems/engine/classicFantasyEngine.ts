import { computeDerivedValues } from '../../../utils/derivedValues';
import { calcNormalProb, calcBoonProb, calcBaneProb, formatProb } from '../../../utils/boonBane';
import type { BoonBaneState } from '../../../utils/boonBane';
import { applyRoundRest, applyStretchRest, applyShiftRest } from '../../../utils/restActions';
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
      return {
        resources: { wp: result.newWpCurrent },
        conditionsCleared: [],
        messages: [
          result.alreadyFull && result.recovered === 0
            ? 'Already at full WP.'
            : `Recovered ${result.recovered} WP.`,
        ],
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
  },
  derivedStats: (character, system) => computeDerivedValues(character, system),
  resourceIds: ['hp', 'wp'],
  panels: ['attributes', 'skills', 'resources', 'inventory', 'magic', 'combat', 'rest', 'death', 'notes'],
  currency: 'coins',
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
      { id: 'combat', label: 'Participated in combat' },
      { id: 'explore', label: 'Explored a new location' },
      { id: 'weakness', label: 'Role-played a weakness' },
      { id: 'heroic', label: 'Used a heroic ability' },
    ],
    usesMarks: true,
    maxSkillValue: 18,
    rollPrompt: value => `Roll above ${value} on a d20 to advance`,
  },
  probability: {
    chance: (value, state) =>
      state === 'boon' ? calcBoonProb(value) : state === 'bane' ? calcBaneProb(value) : calcNormalProb(value),
  },
  derivedFields: [
    { key: 'movement', label: 'Movement', shortLabel: 'Move', overridable: true },
    { key: 'hpMax', label: 'HP Max', overridable: true },
    { key: 'wpMax', label: 'WP Max', overridable: true },
    { key: 'damageBonus', label: 'STR Damage Bonus', shortLabel: 'STR Dmg', overridable: true },
    { key: 'aglDamageBonus', label: 'AGL Damage Bonus', shortLabel: 'AGL Dmg', overridable: true },
    { key: 'encumbranceLimit', label: 'Encumbrance Limit', shortLabel: 'Carry', overridable: true },
  ],
};
