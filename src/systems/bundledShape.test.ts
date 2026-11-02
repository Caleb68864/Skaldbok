import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUNDLED_SYSTEMS } from './registry';
import { createBlankCharacter } from '../features/characters/characterMappers';
import { CURRENT_SCHEMA_VERSION } from '../utils/migrations';

/** Roadmap E5/E6: what a bundled system folder holds, and that its parts agree. */

describe.each(BUNDLED_SYSTEMS.map(s => [s.id, s] as const))('%s', (id, system) => {
  const template = JSON.parse(
    readFileSync(join(process.cwd(), `sample-data/${id}.blank.character.json`), 'utf8'),
  ) as { schemaVersion: number; attributes: Record<string, number>; resources: Record<string, { max: number }> };

  it('stamps its blank template with the current character schema', () => {
    expect(template.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('gives its blank template every declared resource, at the declared maximum', () => {
    // A maximum derived from an attribute follows that attribute in the template.
    const declared = Object.fromEntries(system.resources.map(r => [
      r.id,
      r.derivedFrom ? template.attributes[r.derivedFrom] : r.defaultMax,
    ]));
    const inTemplate = Object.fromEntries(Object.entries(template.resources).map(([k, r]) => [k, r.max]));
    expect(inTemplate).toEqual(declared);
  });

  it('creates a character that carries every declared resource', () => {
    const character = createBlankCharacter(id);
    for (const resource of system.resources) expect(character.resources[resource.id], resource.id).toBeDefined();
  });

  it('keeps its index module data-only, with rules imported from where they live', () => {
    const source = readFileSync(join(process.cwd(), `src/systems/${id}/index.ts`), 'utf8');
    expect(source).not.toMatch(/export \*/);
  });
});
