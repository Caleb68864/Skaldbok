import { describe, expect, it } from 'vitest';
import { systemDefinitionSchema } from '../../../../schemas/system.schema';
import { BUNDLED_SYSTEMS } from '../../../systems/registry';
import { declaredEngineData } from './declaredEngineData';
import { getEngine } from './index';
import { classicFantasySystem } from '../../../systems/classic-fantasy';

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
