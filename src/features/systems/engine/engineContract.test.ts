import { describe, it, expect } from 'vitest';
import { BUNDLED_SYSTEMS } from '../../../systems/registry';
import { getEngine, classicFantasyEngine, travellerEngine, savageWorldsEngine } from './index';
import { getEffectiveValue, resolveDerivedField, resolveArmorRating, resolveSkillValue } from '../../../utils/derivedValues';
import { parseStatKey, attrKey } from '../../../utils/statKeys';
import type { SystemEngine } from './types';
import type { SystemDefinition } from '../../../types/system';
import type { CharacterRecord } from '../../../types/character';

describe('getEngine declarative-array overrides', () => {
  // +1000 keeps the memo cache key distinct from the real bundled system.
  const base = BUNDLED_SYSTEMS[0];

  it('replaces logActions from system.json wholesale, keeps others', () => {
    const engine = getEngine({ ...base, version: base.version + 1000, logActions: [{ id: 'zap', label: 'Zap' }] });
    expect(engine.logActions).toEqual([{ id: 'zap', label: 'Zap' }]);
    // An un-overridden array still comes from the adapter default.
    expect(engine.outcomes).toEqual(getEngine(base).outcomes);
  });
});

/**
 * Referential-integrity contract every SystemEngine adapter must satisfy.
 *
 * @remarks
 * Table-driven over `BUNDLED_SYSTEMS` so registering a system in `registry.ts`
 * auto-enrolls it here — a 4th adapter (or a Traveller edit) that names a
 * resource/attribute that doesn't exist, ships a currency with no unit coin, or
 * drifts its id lists from `system.json` fails this suite instead of silently
 * misbehaving at the table. tsc already guarantees the interface *shape*; this
 * guards the string-id references tsc can't see.
 */
describe.each(BUNDLED_SYSTEMS.map(s => [s.displayName, s] as const))(
  'engine contract: %s',
  (_name, system) => {
    const engine = getEngine(system);
    const resourceIds = new Set(engine.resourceIds);

    it('primaryHealthResourceId is null or names a real resource', () => {
      if (engine.primaryHealthResourceId !== null) {
        expect(resourceIds.has(engine.primaryHealthResourceId)).toBe(true);
      }
    });

    it('damageTrack references only real resources', () => {
      if (engine.damageTrack) {
        for (const id of [...engine.damageTrack.order, ...engine.damageTrack.overflowTo]) {
          expect(resourceIds.has(id)).toBe(true);
        }
      }
    });

    it('death.triggerResourceId names a real resource', () => {
      if (engine.death) expect(resourceIds.has(engine.death.triggerResourceId)).toBe(true);
    });

    it('magic.resourceId names a real resource', () => {
      if (engine.magic) expect(resourceIds.has(engine.magic.resourceId)).toBe(true);
    });

    it('attributeIds match the system definition in order (no drift)', () => {
      expect(engine.attributeIds).toEqual(system.attributes.map(a => a.id));
    });

    it('every resourceId exists in the system definition', () => {
      // resourceIds is intentionally a SUBSET, not an exact match: Dragonbane's
      // system.json also declares deathRolls/deathSuccesses (death-track
      // counters surfaced via the DeathModel, not as normal resources), so the
      // adapter deliberately omits them. Only the subset relationship is a bug
      // if violated (an engine naming a resource the definition doesn't have).
      const sysResIds = new Set(system.resources.map(r => r.id));
      for (const id of engine.resourceIds) expect(sysResIds.has(id)).toBe(true);
    });

    it('currency has a unit (value 1) base denomination with unique positive-value ids', () => {
      const denoms = engine.currency.denominations;
      expect(denoms.some(d => d.value === 1)).toBe(true);
      expect(denoms.every(d => d.value > 0)).toBe(true);
      expect(new Set(denoms.map(d => d.id)).size).toBe(denoms.length);
    });

    it('derivedFields keys are unique', () => {
      const keys = engine.derivedFields.map(f => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('skill defaultValue and advancementMax are within range', () => {
      const { range, defaultValue, advancementMax } = engine.skill;
      expect(defaultValue).toBeGreaterThanOrEqual(range.min);
      expect(defaultValue).toBeLessThanOrEqual(range.max);
      expect(advancementMax).toBeLessThanOrEqual(range.max);
    });
  },
);

/**
 * Synthetic character for invoking the engine's function-valued fields.
 *
 * @remarks
 * Built from the system definition rather than hand-written per system, so a
 * newly registered system gets a valid character without editing this file.
 * Values are arbitrary but in-range; these assertions are about a function
 * running and returning the right *shape*, not about specific arithmetic.
 */
/**
 * A mid-range value for one attribute, on its ladder if it has one.
 *
 * @remarks
 * These used to be seeded at `a.max`, which quietly defeated the modifier probe
 * below: every formula that steps at a threshold (Dragonbane's damage bonus at
 * 13 and 17, the skill base-chance table, a Savage Worlds die ladder) is already
 * saturated at the maximum, so a +3 probe moved nothing and the test could not
 * tell a saturated threshold from a modifier no consumer reads.
 */
function midRangeAttribute(a: SystemDefinition['attributes'][number]): number {
  const mid = Math.round(((a.min ?? 1) + (a.max ?? 18)) / 2);
  const ladder = a.scale?.kind === 'die-ladder' ? a.scale.ladder : null;
  if (!ladder || ladder.length === 0) return mid;
  const below = ladder.filter(rung => rung <= mid);
  return below.length > 0 ? Math.max(...below) : Math.min(...ladder);
}

function syntheticCharacter(system: SystemDefinition): CharacterRecord {
  return {
    id: 'contract-test',
    name: 'Contract',
    systemId: system.id,
    schemaVersion: 99,
    attributes: Object.fromEntries(system.attributes.map(a => [a.id, midRangeAttribute(a)])),
    resources: Object.fromEntries(
      system.resources.map(r => [r.id, { current: 1, max: 5 }]),
    ),
    skills: {},
    abilities: [],
    conditions: {},
    tempModifiers: [],
    inventory: [],
    wealth: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as unknown as CharacterRecord;
}

/**
 * The adapter each registered system id must resolve to.
 *
 * @remarks
 * `baseEngineFor` falls back to `classicFantasyEngine` for an unmapped id behind
 * a **DEV-only** `console.warn`, so a production build gave the user no signal
 * that their system was silently rendering as Dragonbane. `registry.ts` and that
 * branch are two hand-maintained lists; this map is the third, and it is the one
 * that fails loudly when they drift.
 */
const EXPECTED_ADAPTER: Record<string, SystemEngine> = {
  'classic-fantasy': classicFantasyEngine,
  traveller: travellerEngine,
  'savage-worlds': savageWorldsEngine,
};

describe.each(BUNDLED_SYSTEMS.map(s => [s.displayName, s] as const))(
  'engine contract (behavioural): %s',
  (_name, system) => {
    const engine = getEngine(system);
    const character = syntheticCharacter(system);

    it('resolves to the adapter intended for its id', () => {
      const expected = EXPECTED_ADAPTER[system.id];
      expect(
        expected,
        `registry has "${system.id}" but EXPECTED_ADAPTER does not — add it here and to baseEngineFor`,
      ).toBeDefined();
      // Function identity survives the `{...base}` merge, so this pins the
      // adapter rather than any value system.json could have overridden.
      expect(engine.derivedStats).toBe(expected.derivedStats);
    });

    // ── Producer/consumer key agreement ──────────────────────────────
    // Four independent key spaces had zero assertions between them. Each pair
    // below is a producer emitting ids and a consumer expected to resolve them.

    it('every modifiableStats id resolves to a real value', () => {
      const stats = engine.modifiableStats(system);
      expect(stats.length).toBeGreaterThan(0);
      for (const stat of stats) {
        // Namespaced, per utils/statKeys — a bare id is ambiguous when a
        // resource and an attribute share a name (Traveller's str/dex/end).
        expect(stat.id, `${stat.id} is not namespaced`).toMatch(/^[a-z]+:/);
        const resolved = getEffectiveValue(stat.id, character);
        expect(Number.isFinite(resolved.base), `${stat.id} did not resolve`).toBe(true);
      }
    });

    it('every modifiableStats id points at something the system actually has', () => {
      // `getEffectiveValue` returns 0 for a key it cannot resolve, so the
      // finite-number check above passes for a target that names nothing. This
      // one checks the id against the definition per namespace.
      const attrIds = new Set(system.attributes.map(a => a.id));
      const sysResIds = new Set(system.resources.map(r => r.id));
      const derivedKeys = new Set(
        Object.keys(engine.derivedStats(character, system) as unknown as Record<string, unknown>),
      );

      for (const stat of engine.modifiableStats(system)) {
        const { namespace, id } = parseStatKey(stat.id);
        expect(namespace, `${stat.id} has an unrecognised namespace`).not.toBeNull();
        if (namespace === 'attr') {
          expect(attrIds.has(id), `${stat.id} names no attribute in ${system.id}`).toBe(true);
        } else if (namespace === 'res') {
          expect(sysResIds.has(id), `${stat.id} names no resource in ${system.id}`).toBe(true);
        } else if (namespace === 'derived') {
          // A derived target whose key derivedStats never returns resolves to
          // undefined in resolveDerivedField, so the modifier is inert.
          expect(derivedKeys.has(id), `${stat.id} names no key derivedStats returns`).toBe(true);
        } else if (namespace === 'armor') {
          // The record has exactly two armour slots; any other id reads 0.
          expect(['armor', 'helmet']).toContain(id);
        }
      }
    });

    it('every modifiableStats target changes something the app displays', () => {
      // THE anti-regression test for the 2026-08-08 modifier bug. Every one of
      // these targets was offered by the picker, written by the UI, listed in
      // the buff bar — and read by nothing. They all "resolved" fine; they just
      // never reached a consumer. So this asserts the only thing that matters:
      // adding the modifier must move a number the user can see.
      //
      // Deliberately a fingerprint over the engine's whole visible output rather
      // than a per-namespace probe. A new namespace, or a new consumer, is
      // covered without editing this test — and a target that moves nothing
      // fails loudly instead of shipping as decoration.
      const equipped = {
        ...character,
        armor: { name: 'Test plate', rating: 3 },
        helmet: { name: 'Test helm', rating: 2 },
      } as CharacterRecord;

      const fingerprint = (c: CharacterRecord, options?: { withoutAttrs?: boolean }): string => {
        const derived = engine.derivedStats(c, system) as unknown as Record<string, unknown>;
        return JSON.stringify({
          derived,
          badges: engine.attributeIds.map(id => engine.attributeBadge(id, c)),
          fields: engine.derivedFields.map(f => resolveDerivedField(c, derived as Record<string, number | string | undefined>, f).display),
          armor: resolveArmorRating(c, 'armor'),
          helmet: resolveArmorRating(c, 'helmet'),
          // Every attribute as the sheet reads it. Omitted by the downstream
          // probe below, because this line alone moves for any `attr:` target
          // and so cannot tell "the attribute display changed" from "something
          // computed from the attribute changed".
          attrs: options?.withoutAttrs
            ? null
            : engine.attributeIds.map(id => getEffectiveValue(attrKey(id), c).effective),
          // The skills screen's own line. Function-valued and previously never
          // invoked here, so a state penalty that feeds only the roll display
          // (SWADE's wound/fatigue penalty) was invisible to this suite.
          skill: engine.attributeIds.map(id =>
            engine.skill.display(engine.skill.defaultValue, { character: c, linkedAttributeId: id }),
          ),
          // Every declared skill as the skills screen resolves it, so a
          // `skill:` target is covered too.
          skills: system.skillCategories
            .flatMap(cat => cat.skills)
            .map(s => resolveSkillValue(c, s.id, engine.skill.defaultValue).effective),
          // The engine's own skill formula. `resolveSkillValue` above folds
          // modifiers into a *stored* value and never calls this, so a skill
          // computed from a linked attribute — Dragonbane's whole skill list —
          // was outside the fingerprint entirely. Without it an `attr:` target
          // whose only consumers are skills reads as inert.
          computedSkills: system.skillCategories
            .flatMap(cat => cat.skills)
            .map(s => engine.skill.computeValue(s, c, false)),
        });
      };

      const before = fingerprint(equipped);

      for (const stat of engine.modifiableStats(system)) {
        const withModifier = {
          ...equipped,
          tempModifiers: [
            {
              id: `probe-${stat.id}`,
              label: 'Probe',
              effects: [{ stat: stat.id, delta: 3 }],
              duration: 'scene',
              createdAt: '2026-08-08T00:00:00.000Z',
            },
          ],
        } as unknown as CharacterRecord;

        expect(
          fingerprint(withModifier),
          `a +3 modifier on "${stat.id}" (${stat.label}) changes nothing the app displays — ` +
            `it is offered by the modifier picker but no consumer reads it`,
        ).not.toBe(before);
      }

      // The stricter half. The fingerprint above includes every attribute's own
      // effective value, so an `attr:` target moves it whatever else happens —
      // which is why the original test passed while a +2 CON left HP max, a +2
      // STR left the damage bonus, and a +2 Vigor left Toughness all unmoved.
      // Re-run the attribute targets against a fingerprint with that line
      // removed, so the modifier has to reach something computed *from* the
      // attribute: a derived stat, a badge, or a skill.
      const beforeDownstream = fingerprint(equipped, { withoutAttrs: true });

      for (const stat of engine.modifiableStats(system).filter(s => s.id.startsWith('attr:'))) {
        const withModifier = {
          ...equipped,
          tempModifiers: [
            {
              id: `probe-${stat.id}`,
              label: 'Probe',
              effects: [{ stat: stat.id, delta: 3 }],
              duration: 'scene',
              createdAt: '2026-08-08T00:00:00.000Z',
            },
          ],
        } as unknown as CharacterRecord;

        expect(
          fingerprint(withModifier, { withoutAttrs: true }),
          `a +3 modifier on "${stat.id}" (${stat.label}) moves the attribute's own display and ` +
            `nothing else — no derived stat, badge or skill computed from it reads the modifier`,
        ).not.toBe(beforeDownstream);
      }
    });

    it('every derivedFields key is actually produced by derivedStats', () => {
      const produced = engine.derivedStats(character, system) as unknown as Record<string, unknown>;
      for (const field of engine.derivedFields) {
        expect(
          Object.prototype.hasOwnProperty.call(produced, field.key),
          `derivedFields declares "${field.key}" but derivedStats does not return it`,
        ).toBe(true);
      }
    });

    it('the encumbrance model returns usable numbers', () => {
      // Three formulas used to live in three places with nothing tying them
      // together, and only one honoured an item's capacityBonus.
      if (engine.encumbrance === null) return;
      const limit = engine.encumbrance.limit(character);
      const load = engine.encumbrance.load(character);
      expect(Number.isFinite(limit), `${system.id}: encumbrance.limit is not finite`).toBe(true);
      expect(Number.isFinite(load), `${system.id}: encumbrance.load is not finite`).toBe(true);
      expect(limit).toBeGreaterThanOrEqual(0);
      expect(load).toBeGreaterThanOrEqual(0);
    });

    it('encumbrance.load counts an item by quantity', () => {
      // The party screen summed weight with a literal `* 1` in place of the
      // quantity, so ten 2 kg rations weighed 2.
      if (engine.encumbrance === null) return;
      const one = { ...character, inventory: [{ id: 'i1', name: 'Ration', weight: 2, quantity: 1, description: '' }] } as CharacterRecord;
      const ten = { ...character, inventory: [{ id: 'i1', name: 'Ration', weight: 2, quantity: 10, description: '' }] } as CharacterRecord;
      expect(engine.encumbrance.load(ten)).toBeGreaterThan(engine.encumbrance.load(one));
    });

    it('a system that declares an encumbrance limit also declares the field', () => {
      // The panel reads the limit through resolveDerivedField, so the key has to
      // exist in derivedStats or the override and modifier channels resolve to
      // nothing and the screen silently reads 0.
      if (engine.encumbrance === null) return;
      const derived = engine.derivedStats(character, system) as unknown as Record<string, unknown>;
      expect(
        Object.prototype.hasOwnProperty.call(derived, 'encumbranceLimit'),
        `${system.id}: declares an encumbrance model but derivedStats has no encumbranceLimit`,
      ).toBe(true);
    });

    it('timeUnits are non-empty with unique ids', () => {
      // AddModifierDrawer defaults its Duration row to timeUnits[0]; an empty
      // list would store an empty duration no consumer can resolve.
      expect(engine.timeUnits.length).toBeGreaterThan(0);
      const ids = engine.timeUnits.map(u => u.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every(id => id.length > 0)).toBe(true);
    });

    it('every time unit either expires on something or says it is permanent', () => {
      // A modifier's duration is a TimeUnit id, and expiry used to happen only
      // when a rest of the same id was pressed. Traveller and Savage Worlds
      // declare rest: null, so a duration there could never end. A unit with no
      // `expiresOn` is a deliberate never-expires; a unit naming a rest that
      // does not exist is a modifier the user can never be rid of.
      for (const unit of engine.timeUnits) {
        const restId = unit.expiresOn?.rest;
        if (restId === undefined) continue;
        expect(
          (engine.rest ?? []).some(r => r.id === restId),
          `${system.id}: time unit "${unit.id}" expires on rest "${restId}", which this system does not define`,
        ).toBe(true);
      }
    });

    it('outcome and rollModifier ids are unique', () => {
      const outcomeIds = engine.outcomes.map(o => o.id);
      expect(new Set(outcomeIds).size).toBe(outcomeIds.length);
      const modIds = engine.rollModifiers.map(m => m.id);
      expect(new Set(modIds).size).toBe(modIds.length);
    });

    // ── Capability coherence ─────────────────────────────────────────

    it('hasMagic agrees with the nullable magic model', () => {
      expect(engine.hasMagic).toBe(engine.magic !== null);
    });

    it('damage thresholds are reachable within the track', () => {
      const track = engine.damageTrack;
      if (!track) return;
      const total = new Set([...track.order, ...track.overflowTo]).size;
      expect(track.downAtDepleted).toBeLessThanOrEqual(total);
      if (track.deadAtDepleted !== null) {
        expect(track.deadAtDepleted).toBeLessThanOrEqual(total);
      }
    });

    it('statusConditions name real conditions', () => {
      const declared = engine.damageTrack?.statusConditions;
      if (!declared) return;
      const known = new Set((system.conditions ?? []).map(c => c.id));
      for (const id of [...(declared.down ?? []), ...(declared.dead ?? [])]) {
        expect(known.has(id), `statusConditions names unknown condition "${id}"`).toBe(true);
      }
    });

    // ── Function-valued fields actually invoked ──────────────────────
    // The old suite never called one of these, which is why a broken
    // implementation behind a correct-looking signature passed cleanly.

    it('currency round-trips through read and write', () => {
      const denoms = engine.currency.denominations;
      const amounts = Object.fromEntries(denoms.map((d, i) => [d.id, i + 1]));
      const written = engine.currency.write(character, amounts);
      const readBack = engine.currency.read({ ...character, ...written } as CharacterRecord);
      for (const d of denoms) {
        expect(readBack[d.id], `${d.id} did not survive a write/read round trip`)
          .toBe(amounts[d.id]);
      }
    });

    it('attributeBadge returns a string or null for every attribute', () => {
      for (const id of engine.attributeIds) {
        const badge = engine.attributeBadge(id, character);
        expect(badge === null || typeof badge === 'string').toBe(true);
      }
    });
  },
);

/**
 * The Dragonbane-shaped keys the derived block used to mandate.
 *
 * @remarks
 * `DerivedValues` once required all six of these from every adapter, so every
 * non-Dragonbane engine returned filler. Filler that *looks* like a real value
 * is a landmine: Traveller once returned `hpMax: END`, and Savage Worlds
 * returned `movement: 6` — Pace's value under Dragonbane's name. Neither was
 * read, because neither adapter declares the key in `derivedFields`… until a
 * system cloned from one of them does, at which point it silently prints a
 * number nobody computed.
 *
 * The shape is now open, so the guarantee is stronger than "the filler is
 * neutral": a stat a ruleset has no concept of is **absent**, and reading it
 * yields `undefined` rather than a plausible zero. This test holds that line —
 * reintroducing a placeholder to satisfy some consumer would restore exactly the
 * landmine described above.
 */
const FORMERLY_MANDATED_KEYS = [
  'hpMax',
  'wpMax',
  'movement',
  'encumbranceLimit',
  'damageBonus',
  'aglDamageBonus',
] as const;

describe.each(BUNDLED_SYSTEMS.map(s => [s.displayName, s] as const))(
  'a derived stat a ruleset does not declare is absent: %s',
  (_name, system) => {
    const engine = getEngine(system);
    const declared = new Set(engine.derivedFields.map(f => f.key));
    const derived = engine.derivedStats(syntheticCharacter(system), system) as unknown as Record<
      string,
      unknown
    >;

    it.each(FORMERLY_MANDATED_KEYS)('%s', key => {
      if (declared.has(key)) return; // A declared field is a real value.
      expect(
        derived[key],
        `${system.id} does not declare "${key}" in derivedFields, so it must be ` +
          `absent from the derived block. A placeholder — even a neutral one — ` +
          `prints as a real stat the moment a system cloned from this adapter ` +
          `declares the key`,
      ).toBeUndefined();
    });
  },
);
