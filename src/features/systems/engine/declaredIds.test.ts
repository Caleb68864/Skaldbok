import { describe, expect, it } from 'vitest';
import { systemDefinitionSchema } from '../../../../schemas/system.schema';
import { classicFantasySystem } from '../../../systems/classic-fantasy';
import { savageWorldsSystem } from '../../../systems/savage-worlds';
import { travellerSystem } from '../../../systems/traveller';
import type { CharacterRecord } from '../../../types/character';
import type { SystemDefinition } from '../../../types/system';
import { getEngine } from './index';

/** Roadmap E3: attribute and resource ids come from `system.json`. */

let variant = 0;
const extended = (system: SystemDefinition, overrides: Partial<SystemDefinition>): SystemDefinition =>
  ({ ...system, ...overrides, version: system.version + 2000 + ++variant });

const psi = { id: 'psi', name: 'Psionics', abbreviation: 'PSI', min: 0, max: 15 } as SystemDefinition['attributes'][number];

describe('ids declared in JSON', () => {
  it('a characteristic added to Traveller in JSON gets a DM and a summary row', () => {
    const system = extended(travellerSystem, { attributes: [...travellerSystem.attributes, psi] });
    const engine = getEngine(system);
    const character = { attributes: { psi: 9 }, resources: {}, skills: {} } as unknown as CharacterRecord;

    const derived = engine.derivedStats(character, system) as unknown as { characteristicDMs: Record<string, number> };
    expect(derived.characteristicDMs.psi).toBe(1);
    expect(engine.attributeSummary?.(character, system)?.map(row => row.id)).toContain('psi');
  });

  it('a resource added in JSON reaches the tracker list, and a counter does not', () => {
    const stamina = { id: 'stamina', name: 'Stamina', min: 0, defaultMax: 5 };
    const tally = { id: 'tally', name: 'Tally', min: 0, defaultMax: 5, role: 'counter' as const };
    const engine = getEngine(extended(savageWorldsSystem, {
      resources: [...savageWorldsSystem.resources, stamina, tally],
    }));
    expect(engine.resourceIds).toEqual(['wounds', 'fatigue', 'bennies', 'stamina']);
  });

  it('keeps each bundled system on the list it has always had', () => {
    expect(getEngine(classicFantasySystem).resourceIds).toEqual(['hp', 'wp']);
    expect(getEngine(travellerSystem).resourceIds).toEqual(['str', 'dex', 'end']);
    expect(getEngine(savageWorldsSystem).resourceIds).toEqual(['wounds', 'fatigue', 'bennies']);
  });

  it('role survives import validation', () => {
    const parsed = systemDefinitionSchema.parse(classicFantasySystem);
    expect(parsed.resources.filter(r => r.role === 'counter').map(r => r.id)).toEqual(['deathRolls', 'deathSuccesses']);
  });

  it('the restated maxima agree with the resources they restate', () => {
    const max = (system: SystemDefinition, id: string) => system.resources.find(r => r.id === id)?.defaultMax;
    for (const track of getEngine(classicFantasySystem).death?.tracks ?? []) {
      expect(track.max, track.id).toBe(max(classicFantasySystem, track.id));
    }
    expect(getEngine(savageWorldsSystem).damageTrack?.levels).toBe(max(savageWorldsSystem, 'wounds'));
  });
});
