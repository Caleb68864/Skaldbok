import { describe, it, expect } from 'vitest';
import { parseCreatureImport } from './parseCreatureImport';
import type { CreatureStatField } from '../../types/system';

/**
 * The point of this parser is that a file written by something that never read
 * `system.creatures` still lands. These cases are the shapes a generator
 * plausibly produces, not a spec somebody agreed to.
 */

const FIELDS: CreatureStatField[] = [
  { id: 'hp', label: 'Hits', abbr: 'Hits', summary: true },
  { id: 'armor', label: 'Armour', summary: true },
  { id: 'movement', label: 'Speed (m)', abbr: 'Spd', summary: true },
  { id: 'str', label: 'STR' },
];

const ok = (text: string) => {
  const result = parseCreatureImport(text, FIELDS);
  if (!result.ok) throw new Error(`expected success, got: ${result.error}`);
  return result;
};

describe('shapes a generator plausibly produces', () => {
  it('reads a wrapped creatures array', () => {
    const { creatures } = ok('{"creatures":[{"name":"Wolf","stats":{"hp":12}}]}');
    expect(creatures).toHaveLength(1);
    expect(creatures[0].name).toBe('Wolf');
  });

  it('reads a bare array', () => {
    expect(ok('[{"name":"Wolf"},{"name":"Bear"}]').creatures).toHaveLength(2);
  });

  it('reads a single unwrapped creature', () => {
    // "give me a stat block for a wolf" produces exactly this.
    expect(ok('{"name":"Wolf","stats":{"hp":12}}').creatures[0].name).toBe('Wolf');
  });

  it('reads the other plausible wrapper keys', () => {
    expect(ok('{"bestiary":[{"name":"Wolf"}]}').creatures).toHaveLength(1);
    expect(ok('{"animals":[{"name":"Wolf"}]}').creatures).toHaveLength(1);
  });

  it('rejects a file with no creatures in it, by name', () => {
    expect(parseCreatureImport('{"foo":1}', FIELDS)).toEqual({
      ok: false,
      error: expect.stringContaining('Could not find any creatures'),
    });
  });

  it('rejects invalid JSON with a plain message', () => {
    expect(parseCreatureImport('not json', FIELDS)).toEqual({
      ok: false,
      error: "That file isn't valid JSON.",
    });
  });
});

describe('stat matching', () => {
  it('matches on id, label and abbreviation, loosely', () => {
    const { creatures } = ok(
      '{"name":"Wolf","stats":{"hp":12,"Armour":1,"Spd":8,"STR":7}}',
    );
    expect(creatures[0].stats).toEqual({ hp: 12, armor: 1, movement: 8, str: 7 });
  });

  it('is case- and separator-insensitive', () => {
    expect(ok('{"name":"W","stats":{"speed (m)":8}}').creatures[0].stats).toEqual({ movement: 8 });
  });

  it('reads stats spread across the creature itself', () => {
    // No nested block at all — a very common generated shape.
    expect(ok('{"name":"Wolf","hp":12,"armor":1}').creatures[0].stats).toEqual({ hp: 12, armor: 1 });
  });

  it('drops an undeclared stat and reports it', () => {
    const result = ok('{"name":"Wolf","stats":{"hp":12,"morale":7}}');
    expect(result.creatures[0].stats).toEqual({ hp: 12 });
    expect(result.warnings.join(' ')).toContain('morale');
  });

  it('does not report ordinary top-level properties as ignored stats', () => {
    // "habitat" is a fact about the animal, not a mistyped stat. Reporting it
    // would bury the warning that actually matters.
    const result = ok('{"name":"Wolf","habitat":"forest","sources":["wiki"],"stats":{"hp":12}}');
    expect(result.warnings).toEqual([]);
  });

  it('reads a number out of a qualified string', () => {
    expect(ok('{"name":"W","stats":{"hp":"12 (average)","movement":"8m"}}').creatures[0].stats)
      .toEqual({ hp: 12, movement: 8 });
  });

  it('omits a stat with no number rather than storing 0', () => {
    // 0 would read as "this creature has no hits", which is a different claim
    // from "the file did not say".
    expect(ok('{"name":"W","stats":{"hp":"varies"}}').creatures[0].stats).toEqual({});
  });
});

describe('the rest of the creature', () => {
  it('reads attacks, abilities, skills and tags', () => {
    const { creatures } = ok(`{
      "name": "Grey Wolf",
      "category": "animal",
      "attacks": [{ "name": "Bite", "damage": "2d6", "notes": "knockdown" }],
      "abilities": [{ "name": "Pack hunter", "description": "+1 flanking" }],
      "skills": [{ "name": "Survival", "value": 2 }],
      "tags": ["forest", "pack"],
      "description": "Lean and grey."
    }`);
    const c = creatures[0];
    expect(c.category).toBe('animal');
    expect(c.attacks[0]).toEqual({ name: 'Bite', damage: '2d6', range: '', skill: '', special: 'knockdown' });
    expect(c.abilities[0]).toEqual({ name: 'Pack hunter', description: '+1 flanking' });
    expect(c.skills[0]).toEqual({ name: 'Survival', value: 2 });
    expect(c.tags).toEqual(['forest', 'pack']);
    expect(c.description).toBe('Lean and grey.');
  });

  it('accepts skills as a name/level object', () => {
    expect(ok('{"name":"W","skills":{"Survival":2,"Recon":1}}').creatures[0].skills).toEqual([
      { name: 'Survival', value: 2 },
      { name: 'Recon', value: 1 },
    ]);
  });

  it('accepts a bare string attack rather than dropping it', () => {
    expect(ok('{"name":"W","attacks":["Bite 2d6"]}').creatures[0].attacks[0].name).toBe('Bite 2d6');
  });

  it('accepts tags as a comma-separated string', () => {
    expect(ok('{"name":"W","tags":"forest, pack"}').creatures[0].tags).toEqual(['forest', 'pack']);
  });

  it('maps category synonyms onto the three the record allows', () => {
    expect(ok('{"name":"W","category":"beast"}').creatures[0].category).toBe('animal');
    expect(ok('{"name":"W","type":"humanoid"}').creatures[0].category).toBe('npc');
    // Anything unrecognised lands on the bestiary's own default.
    expect(ok('{"name":"W","category":"eldritch"}').creatures[0].category).toBe('monster');
  });

  it('reads abilities from a "traits" key', () => {
    expect(ok('{"name":"W","traits":[{"name":"Keen nose"}]}').creatures[0].abilities[0].name)
      .toBe('Keen nose');
  });
});

describe('the shipped example file', () => {
  it('imports cleanly against the Traveller stat block, with no warnings', async () => {
    // The file exists to be handed to an AI as the shape to follow. If it ever
    // stops importing cleanly it is teaching the wrong shape, and the person
    // finding that out is the one whose stat blocks came back wrong.
    const example = await import('../../../sample-data/creatures.example.json');
    const travellerFields: CreatureStatField[] = [
      { id: 'hp', label: 'Hits' },
      { id: 'armor', label: 'Armour' },
      { id: 'movement', label: 'Speed (m)' },
      { id: 'str', label: 'STR' },
      { id: 'dex', label: 'DEX' },
      { id: 'end', label: 'END' },
    ];
    const result = parseCreatureImport(JSON.stringify(example.default), travellerFields);
    if (!result.ok) throw new Error(result.error);
    expect(result.warnings).toEqual([]);
    expect(result.creatures.map(c => c.name)).toEqual(['Grey Wolf', 'Cave Bear']);
    expect(result.creatures[0].stats).toEqual({ hp: 12, armor: 1, movement: 8, str: 7, dex: 8, end: 6 });
    expect(result.creatures[0].attacks).toHaveLength(1);
  });
});

describe('bad entries', () => {
  it('skips a nameless creature and says which one', () => {
    const result = ok('[{"name":"Wolf"},{"stats":{"hp":1}}]');
    expect(result.creatures).toHaveLength(1);
    expect(result.warnings.join(' ')).toContain('Creature 2');
  });

  it('fails when nothing had a name', () => {
    expect(parseCreatureImport('[{"stats":{"hp":1}}]', FIELDS)).toEqual({
      ok: false,
      error: 'None of the creatures in that file had a name.',
    });
  });

  it('refuses a runaway file rather than rendering it', () => {
    const many = JSON.stringify(Array.from({ length: 201 }, (_, i) => ({ name: `c${i}` })));
    expect(parseCreatureImport(many, FIELDS)).toEqual({
      ok: false,
      error: expect.stringContaining('more than 200'),
    });
  });
});
