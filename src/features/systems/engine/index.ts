import type { SystemDefinition } from '../../../types/system';
import { useSystemDefinition } from '../useSystemDefinition';
import { useActiveCharacter } from '../../../context/ActiveCharacterContext';
import { classicFantasyEngine } from './classicFantasyEngine';
import { travellerEngine } from './travellerEngine';
import { savageWorldsEngine } from './savageWorldsEngine';
import type { SystemEngine } from './types';
import { makeFormatAmount } from '../../../utils/currency';
import { DEFAULT_SYSTEM_ID } from '../../../systems/registry';

export type { SystemEngine, PanelKey, SystemTerms, SystemLabels, SkillDisplayContext } from './types';
export { classicFantasyEngine } from './classicFantasyEngine';
export { travellerEngine } from './travellerEngine';
export { savageWorldsEngine } from './savageWorldsEngine';

/**
 * Every system id that has a rules adapter.
 *
 * @remarks
 * A map rather than a chain of `if (system.id === …)` so that "does this system
 * have an adapter?" is a question the code can answer, not just a fallthrough.
 * `fallbackAdapter.test.ts` asserts this stays in lockstep with
 * `BUNDLED_SYSTEMS`, in both directions; CLAUDE.md names these as two
 * hand-maintained lists, and a bundled system registered without an adapter
 * used to be invisible.
 *
 * This comment used to credit an `engineRegistryParity` test that has never
 * existed — worse than no citation, because it stops the next reader looking
 * for the guard that does. `testCitations.test.ts` now fails on a comment
 * naming a test file that is not there.
 */
export const SYSTEM_ADAPTERS: Record<string, SystemEngine> = {
  'classic-fantasy': classicFantasyEngine,
  traveller: travellerEngine,
  'savage-worlds': savageWorldsEngine,
};

/** Ids already reported, so a warning during render does not repeat every frame. */
const warnedSystemIds = new Set<string>();

/** Base adapter for a system id, before any system.json overrides are applied. */
function baseEngineFor(system: SystemDefinition | undefined | null): SystemEngine {
  if (!system) return classicFantasyEngine;
  const adapter = SYSTEM_ADAPTERS[system.id];
  if (adapter) return adapter;

  // classic-fantasy is the fail-safe default, but it is not a neutral one: it
  // brings Dragonbane's derived stats, rest, death and encumbrance rules with
  // it. This warning used to be `import.meta.env.DEV`-gated, so in a production
  // build a user-authored system ran another ruleset's maths in total silence —
  // the exact failure the "author your own system" feature cannot survive. The
  // engine also carries `fallbackRulesFor` from here, so the UI can say so.
  if (!warnedSystemIds.has(system.id)) {
    warnedSystemIds.add(system.id);
    console.warn(
      `getEngine: no rules adapter for system "${system.id}". ` +
      `Falling back to classic-fantasy's rules, which are almost certainly not this system's.`,
    );
  }
  return classicFantasyEngine;
}

/**
 * Folds a system's declared money over the adapter's.
 *
 * @remarks
 * `read` and `write` stay in code: they know where on the character record the
 * money lives, which is not something JSON can state. Everything else — the
 * purse label, the denominations, which one is the base unit — is data.
 *
 * Declaring `denominations` also **rebuilds `formatAmount`**. The adapter's
 * closes over its own hardcoded list, so without this a ruleset could declare
 * its own coins, see them in the purse and the inputs, and still watch every
 * total in the ledger decompose into the adapter's — a declaration that half
 * works, which is worse than one that does not work at all.
 */
function mergeCurrency(
  base: SystemEngine['currency'],
  declared: SystemDefinition['currency'],
): SystemEngine['currency'] {
  if (!declared) return base;
  const denominations = declared.denominations ?? base.denominations;
  return {
    ...base,
    label: declared.label ?? base.label,
    denominations,
    baseDenominationId: declared.baseDenominationId ?? base.baseDenominationId,
    formatAmount: declared.denominations ? makeFormatAmount(denominations) : base.formatAmount,
  };
}

/**
 * Memo cache so `getEngine` returns a stable object identity per system.
 *
 * @remarks
 * Consumers call this during render; returning a fresh object each time would
 * defeat memoisation downstream. Keyed by system id + version so editing a
 * system definition picks up new labels.
 */
const engineCache = new Map<string, SystemEngine>();

/**
 * Resolves the SystemEngine adapter for a given system definition.
 *
 * @remarks
 * `terms` and `labels` declared in the system's JSON override the adapter's
 * defaults, so a user-authored ruleset can rename user-facing vocabulary (for
 * example the abilities/magic tab) without touching code. Setting
 * `labels.abilitiesScreen` to `null` hides that tab entirely.
 */
export function getEngine(system: SystemDefinition | undefined | null): SystemEngine {
  const base = baseEngineFor(system);
  if (!system) return base;

  const key = `${system.id}@${system.version}`;
  const cached = engineCache.get(key);
  if (cached) return cached;

  const merged: SystemEngine = {
    ...base,
    // Undefined, not `false`, for a system that has its own adapter: the field
    // is the id of the system whose rules are missing, so its absence is the
    // normal case and its presence is the whole message.
    fallbackRulesFor: SYSTEM_ADAPTERS[system.id] ? undefined : system.id,
    // Derive attributeIds from the definition so adding/renaming a characteristic
    // in system.json fully wires it (DM badge, characteristic grid, modifier
    // targets) without also editing the adapter's hardcoded array.
    // engineContract.test.ts pins engine.attributeIds === system.attributes ids
    // in order for every bundled system. resourceIds is deliberately NOT derived:
    // an adapter may expose a subset (Dragonbane omits the deathRolls/
    // deathSuccesses death-track counters that its system.json still declares).
    attributeIds: system.attributes.map(a => a.id),
    terms: { ...base.terms, ...system.terms },
    labels: { ...base.labels, ...system.labels },
    // Declarative display arrays: when system.json provides one it REPLACES the
    // adapter default wholesale, so a JSON-only system can define its own
    // log-action palette / outcome labels / roll modifiers / time units without
    // code. Absent → the adapter default is kept.
    logActions: system.logActions ?? base.logActions,
    outcomes: system.outcomes ?? base.outcomes,
    rollModifiers: system.rollModifiers ?? base.rollModifiers,
    timeUnits: system.timeUnits ?? base.timeUnits,
    panels: system.panels ?? base.panels,
    currency: mergeCurrency(base.currency, system.currency),
  };
  engineCache.set(key, merged);
  return merged;
}

/** Resolves the SystemEngine for the currently active character's system. */
export function useSystemEngine(): SystemEngine {
  const { character } = useActiveCharacter();
  const { system } = useSystemDefinition(character?.systemId ?? DEFAULT_SYSTEM_ID);
  return getEngine(system);
}

/**
 * Resolves the SystemEngine for an explicit system id.
 *
 * @remarks
 * Session-layer screens are scoped to a *campaign*, not to whichever character
 * happens to be active — a GM running a Traveller game may have no active
 * character at all, or one from another campaign. Those screens pass the
 * campaign's system id here rather than using {@link useSystemEngine}.
 */
export function useSystemEngineFor(systemId: string | undefined | null): SystemEngine {
  const { system } = useSystemDefinition(systemId ?? DEFAULT_SYSTEM_ID);
  return getEngine(system);
}
