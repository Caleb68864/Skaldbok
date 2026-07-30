import { describe, it, expect } from 'vitest';
import { BUNDLED_SYSTEMS } from '../../../systems/registry';
import { getEngine, classicFantasyEngine, travellerEngine, savageWorldsEngine } from './index';
import { getEffectiveValue } from '../../../utils/derivedValues';
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
function syntheticCharacter(system: SystemDefinition): CharacterRecord {
  return {
    id: 'contract-test',
    name: 'Contract',
    systemId: system.id,
    schemaVersion: 99,
    attributes: Object.fromEntries(system.attributes.map(a => [a.id, a.max ?? 10])),
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

    it('every derivedFields key is actually produced by derivedStats', () => {
      const produced = engine.derivedStats(character, system) as unknown as Record<string, unknown>;
      for (const field of engine.derivedFields) {
        expect(
          Object.prototype.hasOwnProperty.call(produced, field.key),
          `derivedFields declares "${field.key}" but derivedStats does not return it`,
        ).toBe(true);
      }
    });

    it('timeUnits are non-empty with unique ids', () => {
      // AddModifierDrawer defaults its Duration row to timeUnits[0]; an empty
      // list would store an empty duration no consumer can resolve.
      expect(engine.timeUnits.length).toBeGreaterThan(0);
      const ids = engine.timeUnits.map(u => u.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every(id => id.length > 0)).toBe(true);
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
