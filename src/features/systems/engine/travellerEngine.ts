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

/**
 * Formats a Traveller skill's level + linked-characteristic DM + 2d6-vs-8
 * success probability string. `characteristicDM` is optional (and defaults to
 * 0) because `SkillEngineConfig['display']` is typed as `(value: number) =>
 * string` — callers that only have the raw level can still call this safely.
 * Wiring the actual per-skill linked-characteristic DM through requires the
 * `SkillsScreen.tsx` call site to pass it, which is outside this sub-spec's
 * in-scope files.
 */
export function formatSkillDisplay(value: number, characteristicDM = 0): string {
  const effectiveModifier = value + characteristicDM;
  const prob = twoD6SuccessProbability(8, effectiveModifier);
  const dmLabel = characteristicDM !== 0 ? ` · DM ${formatDM(characteristicDM)}` : '';
  return `Level ${value}${dmLabel} · ${Math.round(prob * 100)}%`;
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
    // Boon/Bane falls back to plain 2d6-vs-target odds rather than Traveller's
    // canonical 3d6-keep-best/worst-2 — that math isn't implemented in
    // travellerMath.ts yet (SS-04 decision: fall back rather than block).
    supportsBoonBane: true,
  },
  derivedStats: character => computeTravellerDerivedValues(character),
  resourceIds: ['str', 'dex', 'end'],
  panels: ['characteristics', 'skills', 'resources', 'finances', 'careers', 'augments', 'inventory', 'combat', 'notes'],
  currency: 'single',
};
