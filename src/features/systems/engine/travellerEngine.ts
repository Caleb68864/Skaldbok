import type { CharacterRecord } from '../../../types/character';
import type { DerivedValues } from '../../../utils/derivedValues';
import { characteristicToDM, twoD6SuccessProbability } from '../../../systems/traveller/travellerMath';
import type { SystemEngine } from './types';

export const TRAVELLER_ATTRIBUTE_IDS = ['str', 'dex', 'end', 'int', 'edu', 'soc'];

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
    characteristicDMs[id] = characteristicToDM(character.attributes?.[id] ?? 0);
  }
  const initiativeDM = characteristicDMs['dex'] ?? 0;

  return {
    hpMax: character.attributes?.['end'] ?? 0,
    wpMax: 0,
    movement: 0,
    damageBonus: '+0',
    aglDamageBonus: '+0',
    encumbranceLimit: 0,
    characteristicDMs,
    initiativeDM,
  };
}

/** Formats a Traveller skill's level + 2d6-vs-8 success probability string. */
export function formatSkillDisplay(value: number): string {
  const prob = twoD6SuccessProbability(8, value);
  return `Level ${value} · ${Math.round(prob * 100)}%`;
}

export const travellerEngine: SystemEngine = {
  resolution: '2d6-plus',
  hasMagic: false,
  attributeBadge: (attributeId, character) => {
    const score = character.attributes?.[attributeId];
    if (score === undefined || score === null) return null;
    return formatDM(characteristicToDM(score));
  },
  attributeIds: TRAVELLER_ATTRIBUTE_IDS,
  skill: {
    valueLabel: 'Level',
    range: { min: 0, max: 6 },
    defaultValue: 0,
    display: formatSkillDisplay,
    supportsMarks: false,
    supportsBoonBane: true,
  },
  derivedStats: character => computeTravellerDerivedValues(character),
  resourceIds: ['str', 'dex', 'end'],
  panels: ['characteristics', 'skills', 'resources', 'finances', 'careers', 'augments', 'inventory', 'combat', 'notes'],
  currency: 'single',
};
