import { describe, it, expect } from 'vitest';
import { BUNDLED_SYSTEMS } from '../../../systems/registry';
import { getEngine } from './index';

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
