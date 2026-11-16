import { describe, expect, it, vi } from 'vitest';
import { systemDefinitionSchema } from '../../../../schemas/system.schema';
import { BUNDLED_SYSTEMS } from '../../../systems/registry';
import { declaredEngineData, missingRestThrows, withRestRules } from './declaredEngineData';
import type { RestDefinition } from './types';
import { classicFantasyEngine, getEngine } from './index';
import { classicFantasySystem } from '../../../systems/classic-fantasy';
import type { SystemDefinition } from '../../../types/system';
import type { CharacterRecord } from '../../../types/character';
import { savageWorldsSystem } from '../../../systems/savage-worlds';
import { savageTraitPenalty } from './savageWorldsEngine';
import { travellerSystem } from '../../../systems/traveller';
import { TRAVELLER_DEFAULT_TARGET } from './travellerEngine';

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

describe('damageTrack declared in system.json (roadmap E1)', () => {
  it.each(bundled)('%s declares its damage track, or null, and keeps it through import', (_id, system) => {
    expect(system.damageTrack, 'no damageTrack in system.json').toBeDefined();
    expect(systemDefinitionSchema.parse(system).damageTrack).toEqual(system.damageTrack);
    expect(getEngine(system).damageTrack).toEqual(system.damageTrack);
  });

  it('an imported system declares a damage track of its own', () => {
    const damageTrack = {
      order: ['hp'], overflowTo: [], downAtDepleted: 1, deadAtDepleted: null,
      downLabel: 'OUT', deadLabel: 'DEAD',
    };
    expect(getEngine(imported('imported-e1-track', { damageTrack })).damageTrack).toEqual(damageTrack);
  });

  it('rejects a damage track that names no resource or condition', () => {
    const base = { overflowTo: [], downAtDepleted: 1, deadAtDepleted: null, downLabel: 'OUT', deadLabel: 'DEAD' };
    expect(() => imported('imported-e1-bad-track', { damageTrack: { ...base, order: ['body'] } }))
      .toThrow(/damageTrack.*body/);
    expect(() => imported('imported-e1-bad-status', {
      damageTrack: { ...base, order: ['hp'], statusConditions: { down: ['ko'] } },
    })).toThrow(/damageTrack.*ko/);
  });

  it("Savage Worlds' trait penalty follows the declared levels and penalty", () => {
    const character = { resources: { wounds: { current: 3, max: 3 } } } as unknown as CharacterRecord;
    expect(savageTraitPenalty(character, savageWorldsSystem)).toBe(-3);
    const harsher = {
      ...savageWorldsSystem,
      damageTrack: { ...savageWorldsSystem.damageTrack!, levels: 2, penaltyPerLevel: -2 },
    };
    expect(savageTraitPenalty(character, harsher)).toBe(-4);
  });

  it('refuses a bundled system without it', () => {
    expect(() => declaredEngineData(without(classicFantasySystem, 'damageTrack'))).toThrow(/does not declare/);
  });
});

describe('magic declared in system.json (roadmap E1)', () => {
  it.each(bundled)('%s declares its magic economy, or null, and keeps it through import', (_id, system) => {
    expect(system.magic, 'no magic in system.json').toBeDefined();
    expect(systemDefinitionSchema.parse(system).magic).toEqual(system.magic);
    // The declared data, with the adapter's rule functions alongside it.
    const engineMagic = getEngine(system).magic;
    if (system.magic === null) expect(engineMagic).toBeNull();
    else expect(engineMagic).toMatchObject(system.magic!);
  });

  it("classic-fantasy keeps Dragonbane's casting rules beside the declared data", () => {
    expect(classicFantasyEngine.magic?.maxPrepared).toBeTypeOf('function');
    expect(classicFantasyEngine.magic?.castingImpairment).toBeTypeOf('function');
  });

  it('an imported system re-prices its spells and keeps the adapter rules', () => {
    const magic = { ...classicFantasySystem.magic!, costPerLevel: 3, powerLevels: [1, 2] };
    const engineMagic = getEngine(imported('imported-e1-magic', { magic })).magic;
    expect(engineMagic).toMatchObject({ costPerLevel: 3, powerLevels: [1, 2] });
    expect(engineMagic?.castingImpairment).toBeTypeOf('function');
  });

  it('an imported system can declare that it has no magic', () => {
    expect(getEngine(imported('imported-e1-no-magic', { magic: null })).magic).toBeNull();
  });

  it('rejects a magic economy that spends no declared resource', () => {
    const magic = { ...classicFantasySystem.magic!, resourceId: 'mana' };
    expect(() => imported('imported-e1-bad-magic', { magic })).toThrow(/magic.*mana/);
  });

  it('refuses a bundled system without it', () => {
    expect(() => declaredEngineData(without(classicFantasySystem, 'magic'))).toThrow(/does not declare/);
  });
});

describe('advancement.sessionEvents declared in system.json (roadmap E1)', () => {
  it.each(bundled)('%s declares its session events, or null, and keeps them through import', (_id, system) => {
    expect(system.advancement, 'no advancement in system.json').toBeDefined();
    expect(systemDefinitionSchema.parse(system).advancement).toEqual(system.advancement);
    const engineAdvancement = getEngine(system).advancement;
    if (system.advancement === null) expect(engineAdvancement).toBeNull();
    else expect(engineAdvancement?.sessionEvents).toEqual(system.advancement!.sessionEvents);
  });

  it('an imported system lists its own session events and keeps the adapter rules', () => {
    const sessionEvents = [{ id: 'survived', label: 'Survived the session' }];
    const advancement = getEngine(imported('imported-e1-advancement', { advancement: { sessionEvents } })).advancement;
    expect(advancement?.sessionEvents).toEqual(sessionEvents);
    expect(advancement?.maxSkillValue).toBe(classicFantasyEngine.advancement?.maxSkillValue);
    expect(advancement?.rollPrompt(12)).toBe(classicFantasyEngine.advancement?.rollPrompt(12));
  });

  it('an imported system can declare that it has no advancement', () => {
    expect(getEngine(imported('imported-e1-no-advancement', { advancement: null })).advancement).toBeNull();
  });

  it('rejects duplicate session event ids', () => {
    const sessionEvents = [{ id: 'combat', label: 'A' }, { id: 'combat', label: 'B' }];
    expect(() => imported('imported-e1-dupe-events', { advancement: { sessionEvents } })).toThrow(/session event.*combat/);
  });

  it('refuses a bundled system without it', () => {
    expect(() => declaredEngineData(without(classicFantasySystem, 'advancement'))).toThrow(/does not declare/);
  });
});

describe('probability.difficulty declared in system.json (roadmap E1)', () => {
  it.each(bundled)('%s declares its difficulty ladder, or null, and keeps it through import', (_id, system) => {
    expect(system.probability?.difficulty, 'no probability.difficulty in system.json').toBeDefined();
    expect(systemDefinitionSchema.parse(system).probability).toEqual(system.probability);
    expect(getEngine(system).probability.difficulty ?? null).toEqual(system.probability!.difficulty);
  });

  it("Traveller's default target is the declared one", () => {
    expect(TRAVELLER_DEFAULT_TARGET).toBe(travellerSystem.probability?.difficulty?.defaultValue);
  });

  it('an imported system declares a difficulty ladder and keeps the adapter maths', () => {
    const difficulty = { label: 'Target', defaultValue: 10, options: [{ value: 10, label: 'Hard' }] };
    const engine = getEngine(imported('imported-e1-difficulty', { probability: { difficulty } }));
    expect(engine.probability.difficulty).toEqual(difficulty);
    expect(engine.probability.chance).toBe(classicFantasyEngine.probability.chance);
  });

  it('an imported system can declare that it has no difficulty ladder', () => {
    const engine = getEngine(imported('imported-e1-no-difficulty', {
      engine: '2d6-plus', probability: { difficulty: null },
    }));
    expect(engine.probability.difficulty).toBeUndefined();
  });

  it('rejects a default target that is not on the ladder', () => {
    const difficulty = { label: 'Target', defaultValue: 9, options: [{ value: 10, label: 'Hard' }] };
    expect(() => imported('imported-e1-bad-difficulty', { probability: { difficulty } })).toThrow(/difficulty.*9/);
  });

  it('refuses a bundled system without it', () => {
    expect(() => declaredEngineData(without(travellerSystem, 'probability'))).toThrow(/does not declare/);
  });
});

describe('rest[] declared in system.json (roadmap E1)', () => {
  /** A rest as system.json declares it: everything but the adapter's `apply`. */
  const dataOf = (rests: RestDefinition[] | null) => rests && rests.map(({ apply: _apply, ...data }) => data);

  it.each(bundled)('%s declares its rests, or null, and keeps them through import', (_id, system) => {
    expect(system.rest, 'no rest in system.json').toBeDefined();
    expect(systemDefinitionSchema.parse(system).rest).toEqual(system.rest);
    const rests = getEngine(system).rest;
    expect(dataOf(rests)).toEqual(system.rest);
    for (const rest of rests ?? []) expect(rest.apply, `${rest.id} has no apply`).toBeTypeOf('function');
  });

  it('an imported system relabels a rest and keeps its rules', () => {
    const rest = classicFantasySystem.rest!.map(r => (r.id === 'shift' ? { ...r, label: 'Night Watch' } : r));
    const shift = getEngine(imported('imported-e1-rest', { rest })).rest?.find(r => r.id === 'shift');
    expect(shift?.label).toBe('Night Watch');
    expect(shift?.apply).toBe(classicFantasyEngine.rest?.find(r => r.id === 'shift')?.apply);
  });

  it('an imported system can declare that it has no rests', () => {
    // Its time units can no longer expire on a rest, or the schema refuses it.
    const timeUnits = classicFantasySystem.timeUnits!.filter(u => !u.expiresOn?.rest);
    expect(getEngine(imported('imported-e1-no-rest', { rest: null, timeUnits })).rest).toBeNull();
  });

  it('drops, and reports, an imported rest its adapter has no rules for', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rest = [...classicFantasySystem.rest!, { id: 'meditate', label: 'Meditate' }];
    const rests = getEngine(imported('imported-e1-unknown-rest', { rest })).rest;
    expect(rests?.map(r => r.id)).toEqual(['round', 'stretch', 'shift']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('meditate'));
    warn.mockRestore();
  });

  it('a bundled adapter refuses a declared rest it has no rules for', () => {
    expect(() => withRestRules([{ id: 'meditate', label: 'Meditate' }], {}, missingRestThrows('classic-fantasy')))
      .toThrow(/meditate/);
  });

  it('rejects a time unit that expires on an undeclared rest', () => {
    const rest = classicFantasySystem.rest!.filter(r => r.id !== 'shift');
    expect(() => imported('imported-e1-orphan-unit', { rest })).toThrow(/timeUnit.*shift/);
  });

  it('refuses a bundled system without it', () => {
    expect(() => declaredEngineData(without(classicFantasySystem, 'rest'))).toThrow(/does not declare/);
  });
});
