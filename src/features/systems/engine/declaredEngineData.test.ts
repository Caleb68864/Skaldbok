import { describe, expect, it } from 'vitest';
import { systemDefinitionSchema } from '../../../../schemas/system.schema';
import { BUNDLED_SYSTEMS } from '../../../systems/registry';
import { declaredEngineData } from './declaredEngineData';
import { getEngine } from './index';
import { classicFantasySystem } from '../../../systems/classic-fantasy';
import type { SystemDefinition } from '../../../types/system';

const bundled = BUNDLED_SYSTEMS.map(s => [s.id, s] as const);

/** An imported copy of classic-fantasy with `patch` applied, as import would see it. */
function imported(id: string, patch: Partial<SystemDefinition>): SystemDefinition {
  return systemDefinitionSchema.parse({ ...classicFantasySystem, id, ...patch }) as SystemDefinition;
}

/** A bundled system with one declared field removed. */
function without(system: SystemDefinition, key: keyof SystemDefinition): SystemDefinition {
  const copy: Record<string, unknown> = { ...system };
  delete copy[key];
  return copy as unknown as SystemDefinition;
}

describe('engine data declared in system.json (roadmap E1)', () => {
  it.each(BUNDLED_SYSTEMS.map(s => [s.id, s] as const))('%s keeps its data through schema validation', (_id, system) => {
    // Import validates through this schema and Zod strips unknown keys, so any
    // field missing from it works for a bundled system and vanishes when the same
    // file is imported. `timeUnits[].expiresOn` did exactly that.
    const parsed = systemDefinitionSchema.parse(system);
    expect(parsed.timeUnits).toEqual(system.timeUnits);
    expect(parsed.terms).toEqual(system.terms);
    expect(parsed.labels).toEqual(system.labels);
    expect(parsed.outcomes).toEqual(system.outcomes);
    expect(parsed.logActions).toEqual(system.logActions);
    expect(parsed.rollModifiers).toEqual(system.rollModifiers);
    expect(parsed.panels).toEqual(system.panels);
    expect(parsed.currency).toEqual(system.currency);
  });

  it('an imported system with no adapter keeps its modifier expiry', () => {
    const imported = systemDefinitionSchema.parse({
      ...classicFantasySystem,
      id: 'imported-e1',
      timeUnits: [{ id: 'round', label: 'Round', abbrev: 'RND', expiresOn: { encounterEnd: true } }],
    });
    expect(getEngine(imported as never).timeUnits[0].expiresOn).toEqual({ encounterEnd: true });
  });

  it('refuses a bundled system that has lost part of its data', () => {
    const { outcomes: _outcomes, ...incomplete } = classicFantasySystem;
    expect(() => declaredEngineData(incomplete)).toThrow(/does not declare/);
  });
});

describe('derivedFields declared in system.json (roadmap E1)', () => {
  it.each(bundled)('%s declares its derived fields and keeps them through import', (_id, system) => {
    expect(system.derivedFields, 'no derivedFields in system.json').toBeDefined();
    expect(systemDefinitionSchema.parse(system).derivedFields).toEqual(system.derivedFields);
    expect(getEngine(system).derivedFields).toEqual(system.derivedFields);
  });

  it('an imported system relabels its derived fields', () => {
    const fields = [{ key: 'movement', label: 'Speed', shortLabel: 'Spd', overridable: true, surfaces: ['sheet' as const] }];
    expect(getEngine(imported('imported-e1-derived', { derivedFields: fields })).derivedFields).toEqual(fields);
  });

  it('refuses a bundled system without them', () => {
    expect(() => declaredEngineData(without(classicFantasySystem, 'derivedFields'))).toThrow(/does not declare/);
  });
});


describe('death declared in system.json (roadmap E1)', () => {
  it.each(bundled)('%s declares its death model, or null, and keeps it through import', (_id, system) => {
    expect(system.death, 'no death in system.json').toBeDefined();
    expect(systemDefinitionSchema.parse(system).death).toEqual(system.death);
    expect(getEngine(system).death).toEqual(system.death);
  });

  it('an imported system rewords its death model', () => {
    const death = { ...classicFantasySystem.death!, downLabel: 'Bleeding out' };
    expect(getEngine(imported('imported-e1-death', { death })).death?.downLabel).toBe('Bleeding out');
  });

  it('an imported system can declare that it has no death model', () => {
    // `null` is a declaration, not an absence: `??` would bring Dragonbane's back.
    expect(getEngine(imported('imported-e1-no-death', { death: null })).death).toBeNull();
  });

  it('rejects a death track that names no resource', () => {
    const death = { ...classicFantasySystem.death!, triggerResourceId: 'hitPoints' };
    expect(() => imported('imported-e1-bad-death', { death })).toThrow(/death.*hitPoints/);
  });

  it('refuses a bundled system without it', () => {
    expect(() => declaredEngineData(without(classicFantasySystem, 'death'))).toThrow(/does not declare/);
  });
});
