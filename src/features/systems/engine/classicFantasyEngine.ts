import { computeDerivedValues } from '../../../utils/derivedValues';
import { calcNormalProb, calcBoonProb, calcBaneProb, formatProb } from '../../../utils/boonBane';
import type { BoonBaneState } from '../../../utils/boonBane';
import type { SystemEngine } from './types';

/** Formats a skill's success probability string for the current boon/bane state. */
export function formatSkillProbability(value: number, state: BoonBaneState): string {
  const prob =
    state === 'boon' ? calcBoonProb(value) : state === 'bane' ? calcBaneProb(value) : calcNormalProb(value);
  return formatProb(prob);
}

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
};
