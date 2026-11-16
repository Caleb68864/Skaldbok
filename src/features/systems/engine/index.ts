import type { SystemDefinition } from '../../../types/system';
import { useSystemDefinition } from '../useSystemDefinition';
import { useActiveCharacter } from '../../../context/ActiveCharacterContext';
import { classicFantasyEngine } from './classicFantasyEngine';
import { travellerEngine } from './travellerEngine';
import { savageWorldsEngine } from './savageWorldsEngine';
import type { RulesEngineId, SystemEngine } from './types';
import { currencyFromDenominations, withAdvancementRules, withMagicRules, withRestRules } from './declaredEngineData';
import { BUNDLED_SYSTEMS, DEFAULT_SYSTEM_ID } from '../../../systems/registry';

export type { SystemEngine, PanelKey, SystemTerms, SystemLabels, SkillDisplayContext } from './types';
export { classicFantasyEngine } from './classicFantasyEngine';
export { travellerEngine } from './travellerEngine';
export { savageWorldsEngine } from './savageWorldsEngine';

/** The rules adapters, keyed by what a `system.json` declares in `engine`. */
const ENGINE_ADAPTERS: Record<RulesEngineId, SystemEngine> = {
  'd20-roll-under': classicFantasyEngine,
  '2d6-plus': travellerEngine,
  'trait-die-vs-tn': savageWorldsEngine,
};

/**
 * Every bundled system id with its adapter.
 *
 * @remarks
 * Derived from each bundled system's own `engine` declaration, so the registry
 * and this map can no longer drift. It stays as a lookup for a copy of a bundled
 * system that predates the field: an older export still carries the id and no
 * `engine`, and must not fall back to another ruleset's rules on import.
 * `fallbackAdapter.test.ts` fails if a bundled system declares no adapter.
 */
export const SYSTEM_ADAPTERS: Record<string, SystemEngine> = Object.fromEntries(
  BUNDLED_SYSTEMS.flatMap(s => {
    const adapter = s.engine && ENGINE_ADAPTERS[s.engine];
    return adapter ? [[s.id, adapter]] : [];
  }),
);

/**
 * A nullable model a system may declare: absent keeps the adapter's, `null`
 * removes it. `??` would treat the `null` as absent and bring the adapter's back.
 */
function declaredOr<T>(declared: T | null | undefined, base: T | null): T | null {
  return declared === undefined ? base : declared;
}

const hasOwn = (map: object, key: string) => Object.prototype.hasOwnProperty.call(map, key);

/** The adapter a system resolves to, or undefined when it has to fall back. */
function adapterFor(system: SystemDefinition): SystemEngine | undefined {
  // Own-property lookups: both values can come from an imported file, and
  // `"constructor"` would otherwise resolve to a function.
  if (system.engine && hasOwn(ENGINE_ADAPTERS, system.engine)) return ENGINE_ADAPTERS[system.engine];
  return hasOwn(SYSTEM_ADAPTERS, system.id) ? SYSTEM_ADAPTERS[system.id] : undefined;
}

/** Ids already reported, so a warning during render does not repeat every frame. */
const warnedSystemIds = new Set<string>();

/** Base adapter for a system id, before any system.json overrides are applied. */
function baseEngineFor(system: SystemDefinition | undefined | null): SystemEngine {
  if (!system) return classicFantasyEngine;
  const adapter = adapterFor(system);
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
 * The purse label, the denominations and the base unit are data. `read` and
 * `write` follow the denominations, see {@link currencyFromDenominations}.
 *
 * Declaring `denominations` therefore **rebuilds the whole model**: a formatter
 * or a `read` left closing over the adapter's coins would make a declaration
 * that half works, which is worse than one that does not work at all.
 */
function mergeCurrency(
  base: SystemEngine['currency'],
  declared: SystemDefinition['currency'],
): SystemEngine['currency'] {
  if (!declared) return base;
  const merged = {
    ...base,
    label: declared.label ?? base.label,
    baseDenominationId: declared.baseDenominationId ?? base.baseDenominationId,
  };
  return declared.denominations
    ? currencyFromDenominations(merged.label, merged.baseDenominationId, declared.denominations)
    : merged;
}

/**
 * Folds a system's declared difficulty ladder over the adapter's probability.
 *
 * @remarks
 * `chance` is always the adapter's. Absent keeps its ladder, `null` removes it.
 */
function mergeProbability(
  base: SystemEngine['probability'],
  declared: SystemDefinition['probability'],
): SystemEngine['probability'] {
  const difficulty = declared?.difficulty;
  if (difficulty === undefined) return base;
  if (difficulty === null) {
    const { difficulty: _removed, ...rest } = base;
    return rest;
  }
  return { ...base, difficulty };
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
 *
 * @param system - The resolved definition, or `null`/`undefined` when there is none.
 * @param unresolvedSystemId - The id that was asked for and **failed to load**.
 *
 * @remarks
 * `unresolvedSystemId` is how `useSystemDefinition`'s `error` reaches a screen.
 * That error was computed at one place and dropped at all eighteen call sites —
 * every one destructured `{ system }` and nothing else — so a campaign whose
 * ruleset had gone missing silently got classic-fantasy's maths, which is the
 * one thing `fallbackRulesFor` exists to prevent. The flag could not be set
 * from here because `getEngine` alone cannot tell a failed load from a load
 * that has not finished: both arrive as `system === null`. Only the hook knows,
 * so the hook says.
 *
 * A missing `unresolvedSystemId` therefore still means "still loading" or
 * "legacy record" and still sets no flag — otherwise the notice would appear on
 * every cold start.
 */
export function getEngine(
  system: SystemDefinition | undefined | null,
  unresolvedSystemId?: string,
): SystemEngine {
  const base = baseEngineFor(system);
  if (!system) return unresolvedSystemId ? { ...base, fallbackRulesFor: unresolvedSystemId } : base;

  const key = `${system.id}@${system.version}`;
  const cached = engineCache.get(key);
  if (cached) return cached;

  const merged: SystemEngine = {
    ...base,
    // Undefined, not `false`, for a system that has its own adapter: the field
    // is the id of the system whose rules are missing, so its absence is the
    // normal case and its presence is the whole message.
    fallbackRulesFor: adapterFor(system) ? undefined : system.id,
    // Derive attributeIds from the definition so adding/renaming a characteristic
    // in system.json fully wires it (DM badge, characteristic grid, modifier
    // targets) without also editing the adapter's hardcoded array.
    // engineContract.test.ts pins engine.attributeIds === system.attributes ids
    // in order for every bundled system. Resources are the same, minus any the
    // system marks `role: 'counter'` (Dragonbane's death-roll tallies), which a
    // rules model reads and which never appear as a tracker.
    attributeIds: system.attributes.map(a => a.id),
    resourceIds: system.resources?.filter(r => r.role !== 'counter').map(r => r.id) ?? base.resourceIds,
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
    derivedFields: system.derivedFields ?? base.derivedFields,
    death: declaredOr(system.death, base.death),
    damageTrack: declaredOr(system.damageTrack, base.damageTrack),
    // Declared data, the adapter's casting rules.
    magic: system.magic === undefined ? base.magic : withMagicRules(system.magic, base.magic ?? undefined),
    advancement: system.advancement === undefined
      ? base.advancement
      : withAdvancementRules(system.advancement, base.advancement),
    probability: mergeProbability(base.probability, system.probability),
    // Declared labels and prompts, the adapter's `apply` for each id.
    rest: system.rest === undefined
      ? base.rest
      : withRestRules(
        system.rest,
        Object.fromEntries((base.rest ?? []).map(r => [r.id, r.apply])),
        restId => console.warn(
          `getEngine: system "${system.id}" declares rest "${restId}", which its rules adapter cannot run. Left out.`,
        ),
      ),
    currency: mergeCurrency(base.currency, system.currency),
  };
  engineCache.set(key, merged);
  return merged;
}

/**
 * Resolves the SystemEngine for the currently active character's system.
 *
 * @remarks
 * `error` is destructured and passed on deliberately: it is the only thing that
 * distinguishes "this ruleset failed to load" from "this ruleset has not
 * finished loading", and dropping it — which every consumer of
 * `useSystemDefinition` did — is what let the second case be served as the
 * first, silently, with another system's maths.
 */
export function useSystemEngine(): SystemEngine {
  const { character } = useActiveCharacter();
  const systemId = character?.systemId ?? DEFAULT_SYSTEM_ID;
  const { system, error } = useSystemDefinition(systemId);
  return getEngine(system, error ? systemId : undefined);
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
  const resolvedId = systemId ?? DEFAULT_SYSTEM_ID;
  const { system, error } = useSystemDefinition(resolvedId);
  return getEngine(system, error ? resolvedId : undefined);
}
