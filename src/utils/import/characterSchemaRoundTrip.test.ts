import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { parseBundle } from './bundleParser';
import { characterRecordSchema } from '../../../schemas/character.schema';

/**
 * A character record must survive a round trip with everything the user put in it.
 *
 * @remarks
 * The bug this file exists for: `characterRecordSchema` was `.passthrough()` at
 * the top level only. Zod strips per object, not per document, and
 * `migrateCharacter` — the import path — returns Zod's *output*. So eleven
 * declared, written and read sub-fields were deleted from the record on every
 * single import: `CharacterSkill.dragonMarked`/`demonMarked`,
 * `Weapon.metal`/`damageType`/`strRequirement`/`damaged`/`isShield`,
 * `ArmorPiece.weight`/`bodyPart`/`movementPenalty`/`metal`. In a local-first app
 * that is data loss, not a schema nicety: a bundle restored onto a new device
 * came back with every shield demoted to a weapon and every mail shirt weightless.
 *
 * **Why the old guard did not see it.** `bundleParser.test.ts` claims to guard
 * exactly this — "preserves fields the schema does not enumerate (no silent strip
 * on import)" — and asserts `portraitUri` and two `uiState` members. Those are
 * the two keys the two existing `.passthrough()` calls already protected. The
 * test could not fail while eleven siblings were being dropped, because it
 * restated a field list rather than deriving one, and the list it restated was
 * the set that already worked. That test is kept — it is a fair statement about
 * the top-level passthrough — and this file is the one that cannot pass while a
 * field is dropped.
 *
 * So neither case below names a field. The first derives from the **schema**:
 * every object reachable from the record must be a passthrough. The second
 * derives from the **types**: every member of every interface reachable from
 * `CharacterRecord` must be present in the fixture *and* survive a real
 * `parseBundle`. Add a field to `Weapon` and forget the schema and the second
 * case names it; add a nested object to the schema and forget `.passthrough()`
 * and the first case names it.
 */

const TYPES_PATH = resolve(__dirname, '../../types/character.ts');

// --- deriving the interface graph from the declarations themselves ---------

/** Every `export interface` in `types/character.ts`, name → body text. */
function declaredInterfaces(source: string): Map<string, string> {
  const out = new Map<string, string>();
  // Bodies close on a `}` at column 0; the inline object types in this file are
  // all single-line, so no nested brace reaches the start of a line.
  for (const m of source.matchAll(/export interface (\w+)[^{]*\{([\s\S]*?)\n\}/g)) {
    out.set(m[1], m[2]);
  }
  return out;
}

/** Member names and their type text, comments removed. */
function membersOf(body: string): Array<[string, string]> {
  const stripped = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  return [...stripped.matchAll(/^\s*(\w+)\??\s*:\s*([^;]+);/gm)].map(
    (m) => [m[1], m[2].trim()] as [string, string],
  );
}

/**
 * Interfaces a persisted `CharacterRecord` can actually contain.
 *
 * @remarks
 * Reachability rather than a list, and it earns its keep immediately: `Spell`
 * and `HeroicAbility` are declared in the same file and are **views** over
 * `Ability` rather than stored shapes, so a hand-written list would have had to
 * remember to leave them out. The walk leaves them out because nothing on
 * `CharacterRecord` refers to them.
 *
 * `Debt` is declared in `features/characters/debts.ts` and so is not walked;
 * `debts` is not enumerated by the schema at all, so the whole array travels on
 * the top-level passthrough untouched. Members of single-line inline object
 * types (`uiState.restsUsed`'s three flags) are likewise not walked — they are
 * inside a member, not members themselves.
 */
function reachableInterfaces(interfaces: Map<string, string>, root: string): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const queue = [root];
  while (queue.length > 0) {
    const name = queue.shift() as string;
    if (seen.has(name) || !interfaces.has(name)) continue;
    seen.add(name);
    order.push(name);
    for (const [, typeText] of membersOf(interfaces.get(name) as string)) {
      for (const ident of typeText.matchAll(/\b([A-Z]\w*)\b/g)) {
        if (interfaces.has(ident[1]) && !seen.has(ident[1])) queue.push(ident[1]);
      }
    }
  }
  return order;
}

// --- deriving the object graph from the schema ----------------------------

/** Every ZodObject reachable from a schema, as `path → isPassthrough`. */
function objectsIn(schema: z.ZodTypeAny, path = 'characterRecord'): Array<[string, boolean]> {
  const found: Array<[string, boolean]> = [];
  const seen = new Set<unknown>();

  const walk = (node: unknown, at: string): void => {
    if (node === null || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    const def = (node as { _def?: Record<string, unknown> })._def;
    if (!def) return;
    const kind = def.typeName as string | undefined;
    switch (kind) {
      case 'ZodObject': {
        found.push([at, def.unknownKeys === 'passthrough']);
        const shape = (def.shape as () => Record<string, unknown>)();
        for (const [key, child] of Object.entries(shape)) walk(child, `${at}.${key}`);
        return;
      }
      case 'ZodArray':
        return walk(def.type, `${at}[]`);
      case 'ZodOptional':
      case 'ZodNullable':
      case 'ZodDefault':
      case 'ZodCatch':
        return walk(def.innerType, at);
      case 'ZodEffects':
        return walk(def.schema, at);
      case 'ZodRecord':
        return walk(def.valueType, `${at}{}`);
      case 'ZodUnion':
        for (const [i, option] of (def.options as unknown[]).entries()) walk(option, `${at}|${i}`);
        return;
      default:
        return;
    }
  };

  walk(schema, path);
  return found;
}

// --- the fixture ----------------------------------------------------------

/**
 * A character carrying a value for every member of every reachable interface.
 *
 * @remarks
 * Hand-written, and checked against the declarations rather than trusted: the
 * first assertion of the round-trip case is that the fixture *covers* every
 * declared member. A fixture that silently goes stale is how a guard comes to
 * assert only the fields that already work, which is the exact failure being
 * repaired here.
 */
function richCharacter(): Record<string, unknown> {
  return {
    id: 'rich-1',
    schemaVersion: 4,
    systemId: 'classic-fantasy',
    name: 'Astrid Ravenhair',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadata: { kin: 'Human' },
    attributes: { str: 13 },
    conditions: { exhausted: false },
    resources: { hp: { current: 8, max: 12 } },
    skills: { axes: { value: 12, trained: true, dragonMarked: true, demonMarked: true } },
    weapons: [{
      id: 'w1', name: 'Broadaxe', grip: 'two-handed', range: "Arm's Reach", damage: '2D8',
      durability: 12, features: 'Edged', equipped: true, metal: true, damageType: 'slashing',
      strRequirement: 13, damaged: false, isShield: false, systemFields: { reach: 1 },
    }],
    armor: {
      id: 'a1', name: 'Chainmail', rating: 4, features: 'Noisy', equipped: true,
      weight: 2, bodyPart: 'Torso', movementPenalty: 2, metal: true, systemFields: { fit: 'snug' },
    },
    helmet: {
      id: 'h1', name: 'Great Helm', rating: 2, features: '', equipped: true,
      weight: 1, bodyPart: 'Head', movementPenalty: 0, metal: true, systemFields: {},
    },
    inventory: [{
      id: 'i1', name: 'Backpack', weight: 1, quantity: 2, description: 'Roomy',
      tiny: false, consumable: false, capacityBonus: 5,
    }],
    tinyItems: ['Flint'],
    memento: 'A raven feather',
    storyBank: [{ id: 'sb1', cue: 'patience', text: 'The long road', body: 'A full anecdote.' }],
    wealth: { gold: 4 },
    abilities: [{
      id: 'ab1', type: 'spell', name: 'Ember', summary: 'A spark', cost: { wp: 2 },
      prepared: true, pinnedAsStamp: true,
      effects: [{ stat: 'attr:str', delta: 1, duration: 'stretch' }],
      systemFields: { school: 'Elementalism' },
    }],
    derivedOverrides: { movement: 14 },
    tempModifiers: [{
      id: 'tm1', label: 'Ember', duration: 'stretch', createdAt: '2026-01-01T00:00:00.000Z',
      effects: [{ stat: 'attr:str', delta: 1 }],
    }],
    uiState: { pinnedSkills: ['axes'], restsUsed: { round: true } },
    portraitUri: 'data:image/png;base64,AAAA',
    advancementChecks: { combat: true },
    deletedAt: '2026-02-01T00:00:00.000Z',
    softDeletedBy: 'tx-1',
    systemData: { dragonbane: { rests: 1 } },
    customSkills: [{
      id: 'cs1', name: 'Language (Zhodani)', categoryId: 'general',
      linkedAttributeId: 'int', groupId: 'language',
    }],
    debts: [{ id: 'd1', counterparty: 'The Guild', amount: 50, direction: 'owed' }],
  };
}

/** Every `path → value` in an object, for defined leaf and container keys alike. */
function pathsIn(value: unknown, at = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  const walk = (node: unknown, path: string): void => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (child === undefined) continue;
      const childPath = path === '' ? key : `${path}.${key}`;
      out.set(childPath, child);
      walk(child, childPath);
    }
  };
  walk(value, at);
  return out;
}

function importCharacter(character: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify({
    version: 1,
    type: 'character',
    exportedAt: '2026-01-01T00:00:00.000Z',
    system: 'classic-fantasy',
    contents: { characters: [character] },
  });
  const result = parseBundle(json);
  if (!result.success) throw new Error(`fixture did not parse: ${result.error}`);
  const warnings = result.warnings.filter((w) => w.entityType === 'characters');
  if (warnings.length > 0) {
    throw new Error(`fixture was rejected: ${warnings.map((w) => w.message).join('; ')}`);
  }
  const imported = result.bundle.contents.characters?.[0];
  if (!imported) throw new Error('fixture produced no imported character');
  return imported as Record<string, unknown>;
}

// --- the cases ------------------------------------------------------------

describe('character schema — nothing a record carries is stripped', () => {
  it('every object reachable from the character schema is a passthrough', () => {
    const objects = objectsIn(characterRecordSchema);

    // The cases by *name*, not just a count — a total alone cannot tell an added
    // object from a removed one, and this project has been bitten by exactly
    // that. `helmet` is absent because it shares the one `armorPieceSchema`
    // instance with `armor`; the walk visits each schema object once, which is
    // the right granularity for "does this object strip".
    expect(objects.map(([path]) => path)).toEqual([
      'characterRecord',
      'characterRecord.resources{}',
      'characterRecord.skills{}',
      'characterRecord.weapons[]',
      'characterRecord.armor',
      'characterRecord.inventory[]',
      'characterRecord.storyBank[]',
      'characterRecord.abilities[]',
      'characterRecord.uiState',
      'characterRecord.customSkills[]',
    ]);

    const stripping = objects.filter(([, isPassthrough]) => !isPassthrough).map(([path]) => path);
    expect(stripping).toEqual([]);
  });

  it('every member the types declare survives a real import', () => {
    const source = readFileSync(TYPES_PATH, 'utf8');
    const interfaces = declaredInterfaces(source);
    expect(interfaces.size).toBeGreaterThan(10);

    const reachable = reachableInterfaces(interfaces, 'CharacterRecord');
    // The walk's own result, pinned: 13 interfaces, and `Spell` / `HeroicAbility`
    // deliberately not among them — they are views over `Ability`, not stored.
    expect(reachable.length).toBe(13);
    expect(reachable).not.toContain('Spell');
    expect(reachable).not.toContain('HeroicAbility');

    const declaredMembers = new Set<string>();
    for (const name of reachable) {
      for (const [member] of membersOf(interfaces.get(name) as string)) declaredMembers.add(member);
    }
    expect(declaredMembers.size).toBeGreaterThan(40);

    const fixture = richCharacter();
    const fixturePaths = pathsIn(fixture);

    // Fixture sanity first. A guard whose fixture has gone stale asserts only
    // about the fields that already work — which is what the test this replaces
    // did — so the fixture is checked against the declarations before any claim
    // is made about the import.
    const uncovered = [...declaredMembers].filter(
      (member) => ![...fixturePaths.keys()].some((p) => p === member || p.endsWith(`.${member}`)),
    );
    expect(uncovered).toEqual([]);

    const imported = importCharacter(fixture);
    const importedPaths = pathsIn(imported);

    const lost: string[] = [];
    for (const [path, value] of fixturePaths) {
      const leaf = path.split('.').pop() as string;
      if (!declaredMembers.has(leaf.replace(/\[\d+\]$/, ''))) continue;
      if (!importedPaths.has(path)) lost.push(path);
      else expect([path, importedPaths.get(path)]).toEqual([path, value]);
    }
    expect(lost).toEqual([]);
  });

  it('an unenumerated key on a nested object survives too', () => {
    // The other half of the fix, and the one that covers the *next* field added
    // to a type and forgotten in the schema. Enumerating the eleven lost fields
    // alone would have fixed the instance and left the class.
    const fixture = richCharacter();
    (fixture.weapons as Record<string, unknown>[])[0].sharpness = 3;
    ((fixture.skills as Record<string, Record<string, unknown>>).axes).favoured = true;
    (fixture.armor as Record<string, unknown>).lining = 'wool';

    const imported = importCharacter(fixture);
    expect((imported.weapons as Record<string, unknown>[])[0].sharpness).toBe(3);
    expect((imported.skills as Record<string, Record<string, unknown>>).axes.favoured).toBe(true);
    expect((imported.armor as Record<string, unknown>).lining).toBe('wool');
  });

  it('still rejects a record whose declared field has the wrong type', () => {
    // The must-be-refused control. Passthrough stops Zod *stripping*; it must not
    // stop it *validating*, or "nothing is lost" would have been bought by
    // letting anything in.
    const fixture = richCharacter();
    (fixture.weapons as Record<string, unknown>[])[0].durability = 'very';
    expect(() => importCharacter(fixture)).toThrow(/durability|rejected/i);
  });
});
