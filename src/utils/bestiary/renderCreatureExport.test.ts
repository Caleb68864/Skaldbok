import { describe, it, expect } from 'vitest';
import { creatureExportFilename, renderCreaturesToJson } from './renderCreatureExport';
import { parseCreatureImport } from './parseCreatureImport';
import type { CreatureTemplate } from '../../types/creatureTemplate';
import type { CreatureStatField } from '../../types/system';

const FIELDS: CreatureStatField[] = [
  { id: 'hp', label: 'Hits' },
  { id: 'armor', label: 'Armour' },
  { id: 'movement', label: 'Speed (m)' },
];

const template = (overrides: Partial<CreatureTemplate> = {}): CreatureTemplate =>
  ({
    id: 'c1',
    campaignId: 'camp1',
    name: 'Grey Wolf',
    category: 'animal',
    stats: { hp: 12, armor: 1, movement: 8 },
    attacks: [{ name: 'Bite', damage: '2d6', range: 'Melee', skill: 'Melee (natural)', special: 'Knockdown' }],
    abilities: [{ name: 'Pack hunter', description: '+1 DM when flanking' }],
    skills: [{ name: 'Survival', value: 2 }],
    tags: ['forest'],
    status: 'active',
    createdAt: 'x',
    updatedAt: 'x',
    schemaVersion: 1,
    ...overrides,
  }) as CreatureTemplate;

describe('round-tripping through the importer', () => {
  it('re-imports to the same creature', () => {
    // The whole point of matching the import format. If this drifts, a stat
    // block exported to share with somebody comes back different.
    const json = renderCreaturesToJson([template()]);
    const result = parseCreatureImport(json, FIELDS);
    if (!result.ok) throw new Error(result.error);
    expect(result.warnings).toEqual([]);
    expect(result.creatures[0]).toEqual({
      name: 'Grey Wolf',
      category: 'animal',
      role: undefined,
      affiliation: undefined,
      stats: { hp: 12, armor: 1, movement: 8 },
      attacks: [{ name: 'Bite', damage: '2d6', range: 'Melee', skill: 'Melee (natural)', special: 'Knockdown' }],
      abilities: [{ name: 'Pack hunter', description: '+1 DM when flanking' }],
      skills: [{ name: 'Survival', value: 2 }],
      tags: ['forest'],
      description: undefined,
    });
  });

  it('round-trips a sparse creature', () => {
    const bare = template({ attacks: [], abilities: [], skills: [], tags: [], stats: { hp: 3 } });
    const result = parseCreatureImport(renderCreaturesToJson([bare]), FIELDS);
    if (!result.ok) throw new Error(result.error);
    expect(result.creatures[0].name).toBe('Grey Wolf');
    expect(result.creatures[0].stats).toEqual({ hp: 3 });
    expect(result.creatures[0].attacks).toEqual([]);
  });

  it('round-trips several creatures at once', () => {
    const json = renderCreaturesToJson([template(), template({ name: 'Cave Bear', category: 'monster' })]);
    const result = parseCreatureImport(json, FIELDS);
    if (!result.ok) throw new Error(result.error);
    expect(result.creatures.map(c => c.name)).toEqual(['Grey Wolf', 'Cave Bear']);
  });
});

describe('what the file contains', () => {
  it('omits empty optional fields rather than emitting them blank', () => {
    const json = JSON.parse(renderCreaturesToJson([
      template({ attacks: [], abilities: [], skills: [], tags: [] }),
    ]));
    const entry = json.creatures[0];
    expect(entry).not.toHaveProperty('attacks');
    expect(entry).not.toHaveProperty('tags');
    expect(entry).not.toHaveProperty('role');
    // Stats are always present: a creature with none is still a claim worth making.
    expect(entry).toHaveProperty('stats');
  });

  it('omits an empty attack field but keeps the name', () => {
    const json = JSON.parse(renderCreaturesToJson([
      template({ attacks: [{ name: 'Claw', damage: '3d6', range: '', skill: '' }] }),
    ]));
    expect(json.creatures[0].attacks[0]).toEqual({ name: 'Claw', damage: '3d6' });
  });

  it('exports a stat the current ruleset does not declare', () => {
    // The file records the creature, not one system's view of it. Dropping it
    // here loses data silently; the importer drops it *with a warning*, which
    // is the right place for that decision.
    const json = JSON.parse(renderCreaturesToJson([template({ stats: { hp: 12, ferocity: 3 } })]));
    expect(json.creatures[0].stats).toEqual({ hp: 12, ferocity: 3 });
  });

  it('exports a plain-text description but not a Tiptap document', () => {
    // A document node means nothing to whatever reads the file, and would come
    // back through the importer as "[object Object]".
    const asText = JSON.parse(renderCreaturesToJson([template({ description: 'Lean and grey.' })]));
    expect(asText.creatures[0].description).toBe('Lean and grey.');
    const asDoc = JSON.parse(renderCreaturesToJson([
      template({ description: { type: 'doc', content: [] } as unknown as string }),
    ]));
    expect(asDoc.creatures[0]).not.toHaveProperty('description');
  });

  it('is indented, since a person reads it', () => {
    expect(renderCreaturesToJson([template()])).toContain('\n  ');
  });
});

describe('creatureExportFilename', () => {
  it('slugs the campaign name', () => {
    expect(creatureExportFilename('Spinward Run')).toBe('spinward-run-bestiary.json');
    expect(creatureExportFilename('Pirates: The Main!')).toBe('pirates-the-main-bestiary.json');
  });

  it('falls back when the name slugs to nothing', () => {
    expect(creatureExportFilename('!!!')).toBe('campaign-bestiary.json');
  });
});
