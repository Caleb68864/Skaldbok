import {
  computeCarriedWeight,
  computeDerivedValues,
  computeEncumbranceLimit,
  computeMaxPreparedSpells,
  computeSkillValue,
  effectiveAttribute,
} from '../../../utils/derivedValues';
import { isMetalEquipped } from '../../../utils/metalDetection';
import { calcNormalProb, calcBoonProb, calcBaneProb, formatProb } from '../../../utils/boonBane';
import type { BoonBaneState } from '../../../utils/boonBane';
import { applyRoundRest, applyStretchRest, applyShiftRest } from '../../../utils/restActions';
import { attrKey, armorKey, derivedKey } from '../../../utils/statKeys';
import type { SystemEngine, RestDefinition } from './types';
import {
  declaredEngineData, missingRestThrows, withAdvancementRules, withMagicRules, withRestRules,
} from './declaredEngineData';
import { classicFantasySystem } from '../../../systems/classic-fantasy';

/**
 * Skill value at or below which a roll cannot fail.
 *
 * @remarks
 * A natural 1 always succeeds, so a skill of 1 succeeds on exactly the roll it
 * needs and can never miss. Named rather than written inline because the skills
 * screen used to compute it as `supportsMarks && value === 1` — an unrelated
 * capability standing in for "is this roll-under", with the threshold hardcoded
 * beside it. The rule is Dragonbane's, so it belongs here.
 */
const CLASSIC_AUTO_SUCCESS_AT = 1;

/** Formats a skill's success probability string for the current boon/bane state. */
export function formatSkillProbability(value: number, state: BoonBaneState): string {
  const prob =
    state === 'boon' ? calcBoonProb(value) : state === 'bane' ? calcBaneProb(value) : calcNormalProb(value);
  return formatProb(prob);
}

/**
 * What Dragonbane's three rests do, keyed by the rest ids `system.json` declares.
 *
 * @remarks
 * The labels and prompts are declared data. Each function delegates to the
 * existing pure helpers in `utils/restActions` rather than restating the rules,
 * so behaviour is unchanged. Rolls arrive keyed by the declared prompt field ids
 * (`wp`, `hp`).
 */
const classicFantasyRestRules: Record<string, RestDefinition['apply']> = {
  round: (character, rolls) => {
    const result = applyRoundRest(character, rolls.wp ?? 0);
    const noop = result.alreadyFull && result.recovered === 0;
    return {
      resources: { wp: result.newWpCurrent },
      conditionsCleared: [],
      messages: [noop ? 'Already at full WP.' : `Recovered ${result.recovered} WP.`],
      noop,
    };
  },
  stretch: (character, rolls, conditionToClear) => {
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
  // Ends the day: the declared `clearsRestTracker` clears the round/stretch marks.
  shift: character => {
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
};

/** classic-fantasy's `system.json` data, which the engine below spreads. */
const declared = declaredEngineData(classicFantasySystem);

/**
 * The Dragonbane-like default ruleset, expressed as a {@link SystemEngine}.
 *
 * @remarks
 * This is the fallback engine returned by `getEngine` for any unknown system
 * id, so it doubles as the shape a user-authored system is measured against.
 * It deliberately *delegates* to the pre-existing helpers in
 * `utils/derivedValues`, `utils/restActions` and `utils/boonBane` rather than
 * restating the rules inline — that is what keeps Dragonbane behaviour provably
 * identical to before the engine abstraction existed. `damageTrack` is `null`
 * (HP is a single pool) and death is handled by the {@link features/systems/engine/types!DeathModel | DeathModel} instead.
 */
export const classicFantasyEngine: SystemEngine = {
  attributeBadge: () => null,
  attributeIds: classicFantasySystem.attributes.map(a => a.id),
  skill: {
    valueLabel: 'Value',
    range: { min: 0, max: 20 },
    // Dragonbane advancement stops at 18 even though the sheet accepts 20.
    defaultValue: 0,
    display: (value: number) => `${value}`,
    // Roll-under: the target number stands alone, with the odds beneath it.
    // `formatSkillProbability` above existed with no caller; this is it.
    //
    // `detail` is always the unmodified chance, so a screen can lead with it and
    // name the state that applies; boon and bane are offered as alternatives
    // rather than folded in, which is what lets the dashboard list all three and
    // the skills screen pick one.
    describe: (value: number) => ({
      headline: `${value}`,
      detail: formatSkillProbability(value, 'none'),
      alternatives: [
        { id: 'boon', label: 'boon', detail: formatSkillProbability(value, 'boon') },
        { id: 'bane', label: 'bane', detail: formatSkillProbability(value, 'bane') },
      ],
      note: value <= CLASSIC_AUTO_SUCCESS_AT ? 'auto-success' : undefined,
    }),
    supportsMarks: true,
    supportsBoonBane: true,
    // Roll-under: 0 means untrained, so a skill matters once trained or raised.
    isRelevant: skill => !!skill && (skill.value > 0 || skill.trained),
    computeValue: (skill, character, trained) =>
      skill.linkedAttributeId
        // Through the resolver: read raw, an `attr:` modifier moved the
        // attribute's own display and left every skill derived from it alone.
        ? computeSkillValue(effectiveAttribute(character, skill.linkedAttributeId, 10), trained)
        : trained
          ? Math.max(skill.baseChance * 2, 1)
          : skill.baseChance,
    trainedAffectsValue: true,
  },
  derivedStats: (character, system) => computeDerivedValues(character, system),
  resourceIds: classicFantasySystem.resources.filter(r => r.role !== 'counter').map(r => r.id),
  // Also `damageTrack: null` (Dragonbane damage lands on HP and stops; being at
  // 0 is handled by the death-roll model, not by a cascading track), `death`
  // (the death-roll tracks), `derivedFields` and the data halves of `magic` and `advancement`. Derived-field
  // surfaces reproduce the three layouts that existed before: the sheet shows
  // five rows (no encumbrance), the dashboard four (no HP/WP maxima, which the
  // vitals module already shows), and the print sheet four.
  ...declared,
  primaryHealthResourceId: 'hp',
  // The willpower economy is declared (a power level `n` spell costs `n * 2` WP,
  // a magic trick costs 1); these are Dragonbane's casting rules beside it. E11.
  magic: withMagicRules(declared.magic, {
    // INT's base chance caps prepared spells. Was computed by the magic screen
    // for every system, Dragonbane rule and all.
    maxPrepared: computeMaxPreparedSpells,
    // Metal armour blocks casting. The screen imported the check directly and
    // wrote its own warning, so every magical system inherited the rule.
    castingImpairment: character =>
      isMetalEquipped(character) ? 'Metal armour blocks spellcasting' : null,
  }),
  encumbrance: {
    limit: computeEncumbranceLimit,
    load: computeCarriedWeight,
  },
  rest: withRestRules(declared.rest, classicFantasyRestRules, missingRestThrows(classicFantasySystem.id)),
  // The session events are declared; this is Dragonbane's advancement roll.
  advancement: withAdvancementRules(declared.advancement, {
    usesMarks: true,
    maxSkillValue: 18,
    rollPrompt: value => `Roll above ${value} on a d20 to advance`,
  }),
  probability: {
    ...declared.probability,
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
};
