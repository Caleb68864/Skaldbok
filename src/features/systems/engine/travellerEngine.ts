import type { CharacterRecord } from '../../../types/character';
import type { DerivedValues } from '../../../utils/derivedValues';
import {
  characteristicToDM,
  twoD6SuccessProbability,
  threeD6KeepTwoProbability,
} from '../../../systems/traveller/travellerMath';
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
): string {
  const effectiveModifier = value + characteristicDM;
  const prob =
    boonBane === 'boon'
      ? threeD6KeepTwoProbability(8, effectiveModifier, 'best')
      : boonBane === 'bane'
        ? threeD6KeepTwoProbability(8, effectiveModifier, 'worst')
        : twoD6SuccessProbability(8, effectiveModifier);
  const dmLabel = characteristicDM !== 0 ? ` · DM ${formatDM(characteristicDM)}` : '';
  const stateLabel = boonBane === 'boon' ? ' (boon)' : boonBane === 'bane' ? ' (bane)' : '';
  return `Level ${value}${dmLabel} · ${Math.round(prob * 100)}%${stateLabel}`;
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
    advancementMax: 6,
    defaultValue: 0,
    display: (value, context) => {
      const linkedId = context?.linkedAttributeId;
      const dm = linkedId
        ? characteristicToDM(context?.character.attributes?.[linkedId] ?? 0)
        : 0;
      return formatSkillDisplay(value, dm, context?.boonBane ?? 'none');
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
  resourceIds: ['str', 'dex', 'end'],
  panels: ['characteristics', 'skills', 'resources', 'finances', 'careers', 'augments', 'inventory', 'combat', 'notes'],
  currency: {
    mode: 'single',
    denominations: [{ id: 'credits', label: 'Credits', abbr: 'Cr', value: 1 }],
    read: character => ({ credits: character.travellerData?.credits ?? 0 }),
    write: (character, amounts) => ({
      travellerData: {
        ...character.travellerData,
        credits: amounts.credits ?? character.travellerData?.credits ?? 0,
      },
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
  },
  // Damage lands on END first in Traveller; STR/DEX overflow is a rules decision
  // the generic damage helper should not make on its own.
  primaryHealthResourceId: 'end',
  // Traveller recovery is Medic checks and downtime, not a fixed rest ladder.
  rest: null,
  // No death-roll track; a downed character is handled by the damage track.
  death: null,
  // Advancement is study/training time, not per-session rolls.
  advancement: null,
  probability: {
    // Skill level + linked-characteristic DM vs the default 8+ target.
    chance: (value, state, context) => {
      const linkedId = context?.linkedAttributeId;
      const dm = linkedId
        ? characteristicToDM(context?.character.attributes?.[linkedId] ?? 0)
        : 0;
      const modifier = value + dm;
      if (state === 'boon') return threeD6KeepTwoProbability(8, modifier, 'best');
      if (state === 'bane') return threeD6KeepTwoProbability(8, modifier, 'worst');
      return twoD6SuccessProbability(8, modifier);
    },
  },
  derivedFields: [
    { key: 'initiativeDM', label: 'Initiative DM', shortLabel: 'Init' },
  ],
};
