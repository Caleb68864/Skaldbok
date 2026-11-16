import type { SystemDefinition } from '../../../types/system';
import { makeFormatAmount } from '../../../utils/currency';
import type {
  AdvancementDeclaration, AdvancementModel, AdvancementRules,
  CurrencyModel, MagicDeclaration, MagicModel, MagicRules, ProbabilityModel, SystemEngine,
} from './types';

/** The parts of an engine that are pure data and live in `system.json` (roadmap E1). */
export type DeclaredEngineData = Pick<
  SystemEngine,
  | 'terms' | 'labels' | 'logActions' | 'outcomes' | 'rollModifiers' | 'timeUnits' | 'panels' | 'currency'
  | 'derivedFields' | 'death' | 'damageTrack'
> & {
  /** The data half only; the adapter adds its rules with {@link withMagicRules}. */
  magic: MagicDeclaration | null;
  /** The session events only; the adapter adds the roll with {@link withAdvancementRules}. */
  advancement: AdvancementDeclaration | null;
  /** The difficulty ladder only; the adapter adds `chance`. */
  probability: Omit<ProbabilityModel, 'chance'>;
};

/**
 * Declared session events with an adapter's advancement roll.
 *
 * @remarks
 * `null` if either half is: events with no roll to feed, or a roll with no
 * events declared, are not an advancement model.
 */
export function withAdvancementRules(
  declared: AdvancementDeclaration | null,
  rules: AdvancementRules | null | undefined,
): AdvancementModel | null {
  return declared && rules ? { ...rules, sessionEvents: declared.sessionEvents } : null;
}

/**
 * A declared spell economy with an adapter's rule functions beside it.
 *
 * @remarks
 * `null` stays `null`: a system that declares no magic gets none, whatever the
 * adapter could compute.
 */
export function withMagicRules(declared: MagicDeclaration | null, rules: MagicRules | undefined): MagicModel | null {
  return declared && { ...declared, maxPrepared: rules?.maxPrepared, castingImpairment: rules?.castingImpairment };
}

/**
 * Money, built entirely from what a system declares (roadmap E2).
 *
 * @remarks
 * `read` and `write` follow the denominations rather than coming from an
 * adapter. All three adapters wrote the same two functions, each spelling its own
 * coin ids, so a system declaring different denominations kept the adapter's
 * `read`: the purse offered the new coins and every one of them read as absent.
 */
export function currencyFromDenominations(
  label: string,
  baseDenominationId: string,
  denominations: CurrencyModel['denominations'],
): CurrencyModel {
  return {
    mode: denominations.length > 1 ? 'coins' : 'single',
    label,
    denominations,
    baseDenominationId,
    formatAmount: makeFormatAmount(denominations),
    read: character =>
      Object.fromEntries(denominations.map(d => [d.id, character.wealth?.[d.id] ?? 0])),
    write: (character, amounts) => ({ wealth: { ...character.wealth, ...amounts } }),
  };
}

/**
 * Reads a bundled system's declared data for its adapter to spread.
 *
 * @remarks
 * `system.json` is the one home for this data, so an adapter holds functions
 * only. The optional fields are optional for user-authored systems, which fall
 * back to their base adapter; a *bundled* system has no such fallback, so a
 * missing one throws at module load instead of leaving a hole in the engine.
 */
export function declaredEngineData(system: SystemDefinition): DeclaredEngineData {
  const { terms, labels, logActions, outcomes, rollModifiers, timeUnits, panels, currency, derivedFields, death, damageTrack, magic,
    advancement, probability } = system;
  if (
    !terms || !labels || !logActions || !outcomes || !rollModifiers || !timeUnits || !panels || !derivedFields ||
    // Nullable models: `null` declares the mechanic absent, so only `undefined` is missing.
    death === undefined || damageTrack === undefined || magic === undefined ||
    advancement === undefined || probability?.difficulty === undefined ||
    !currency?.label || !currency.baseDenominationId || !currency.denominations
  ) {
    throw new Error(`Bundled system "${system.id}" does not declare all of its engine data in system.json`);
  }
  return {
    terms: terms as SystemEngine['terms'],
    labels: labels as SystemEngine['labels'],
    logActions,
    outcomes,
    rollModifiers,
    timeUnits,
    panels,
    currency: currencyFromDenominations(currency.label, currency.baseDenominationId, currency.denominations),
    derivedFields,
    death,
    damageTrack,
    magic,
    advancement,
    probability: probability.difficulty ? { difficulty: probability.difficulty } : {},
  };
}
