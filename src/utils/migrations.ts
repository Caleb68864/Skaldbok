import { characterRecordSchema } from '../../schemas/character.schema';
import { systemDefinitionSchema } from '../../schemas/system.schema';
import type { CharacterRecord, CharacterSkill } from '../types/character';
import type { SystemDefinition } from '../types/system';
import { isNamespaced, attrKey, armorKey, derivedKey } from './statKeys';

/**
 * The schema version every character record is upgraded to on read.
 *
 * @remarks
 * Bump this when adding a `migrateCharacterVnToVn+1` rung to the ladder below,
 * and add tests in `migrations.test.ts`. A record's own `schemaVersion` is
 * compared against this to decide which migrations still need to run.
 */
export const CURRENT_SCHEMA_VERSION = 5;

type MigrationFn = (data: unknown) => unknown;

/**
 * v1 → v2: system-agnostic wealth and system data.
 *
 * - `coins { gold, silver, copper }` → `wealth` keyed by denomination id.
 * - `travellerData.credits` → `wealth.credits`, so every system stores money
 *   the same way and `engine.currency` is the only thing that knows the keys.
 * - the rest of `travellerData` → `systemData`, removing a field named after a
 *   single ruleset from the shared record.
 *
 * Unknown/extra keys are preserved. Records already carrying `wealth` or
 * `systemData` pass through untouched, so re-running is safe.
 */
export function migrateCharacterV1ToV2(data: unknown): unknown {
  const rec = { ...(data as Record<string, unknown>) };

  const coins = rec.coins as Record<string, number> | undefined;
  const travellerData = rec.travellerData as Record<string, unknown> | undefined;
  const existingWealth = (rec.wealth as Record<string, number> | undefined) ?? {};

  const wealth: Record<string, number> = { ...existingWealth };
  if (coins && typeof coins === 'object') {
    for (const [id, amount] of Object.entries(coins)) {
      if (typeof amount === 'number' && wealth[id] === undefined) wealth[id] = amount;
    }
  }
  if (travellerData && typeof travellerData.credits === 'number' && wealth.credits === undefined) {
    wealth.credits = travellerData.credits;
  }

  let systemData = rec.systemData as Record<string, unknown> | undefined;
  if (travellerData && typeof travellerData === 'object') {
    // credits move to wealth; everything else is system-owned data.
    const { credits: _credits, ...rest } = travellerData;
    void _credits;
    if (Object.keys(rest).length > 0) {
      systemData = { ...(systemData ?? {}), ...rest };
    }
  }

  delete rec.coins;
  delete rec.travellerData;

  return {
    ...rec,
    wealth,
    ...(systemData ? { systemData } : {}),
    schemaVersion: 2,
  };
}

/**
 * v2 → v3: namespaced stat keys.
 *
 * @remarks
 * Temp-modifier and spell effects targeted a bare id (`str`, `hpMax`), which is
 * ambiguous once a system names a resource after an attribute — Traveller's
 * damage track uses `str`/`dex`/`end`. Rewrites stored targets to the explicit
 * namespace so a modifier can never resolve against the wrong part of the
 * record. Keys that already carry a namespace are left alone.
 *
 * Legacy targets are classified the way the old resolver did: the fixed armour
 * slots, then the three known derived keys, then anything else as an attribute
 * (the historic first-match). Skills were never offered as modifier targets by
 * the UI, so nothing is silently reclassified.
 */
const LEGACY_ARMOR_KEYS = new Set(['armor', 'helmet']);
const LEGACY_DERIVED_KEYS = new Set(['movement', 'hpMax', 'wpMax']);

function namespaceLegacyStat(stat: unknown): unknown {
  if (typeof stat !== 'string' || stat === '') return stat;
  if (isNamespaced(stat)) return stat;
  if (LEGACY_ARMOR_KEYS.has(stat)) return armorKey(stat);
  if (LEGACY_DERIVED_KEYS.has(stat)) return derivedKey(stat);
  return attrKey(stat);
}

function namespaceEffects(effects: unknown): unknown {
  if (!Array.isArray(effects)) return effects;
  return effects.map(effect => {
    if (!effect || typeof effect !== 'object') return effect;
    const e = effect as Record<string, unknown>;
    return { ...e, stat: namespaceLegacyStat(e.stat) };
  });
}

export function migrateCharacterV2ToV3(data: unknown): unknown {
  const rec = { ...(data as Record<string, unknown>) };

  if (Array.isArray(rec.tempModifiers)) {
    rec.tempModifiers = rec.tempModifiers.map(mod => {
      if (!mod || typeof mod !== 'object') return mod;
      const m = mod as Record<string, unknown>;
      return { ...m, effects: namespaceEffects(m.effects) };
    });
  }

  // Spells carry effect templates that become temp modifiers when cast.
  if (Array.isArray(rec.spells)) {
    rec.spells = rec.spells.map(spell => {
      if (!spell || typeof spell !== 'object') return spell;
      const s = spell as Record<string, unknown>;
      return s.effects === undefined ? s : { ...s, effects: namespaceEffects(s.effects) };
    });
  }

  return { ...rec, schemaVersion: 3 };
}

/**
 * v3 → v4: one abilities collection.
 *
 * @remarks
 * `spells` and `heroicAbilities` were separate required arrays, so a character
 * in a system with neither concept still carried two empty Dragonbane
 * collections. Both fold into `abilities`, tagged by type, with the
 * ruleset-specific fields moved into each entry's `systemFields` and the WP cost
 * expressed as `cost: { wp }` rather than a field named after one system's
 * resource.
 */
function spellToAbility(spell: Record<string, unknown>): Record<string, unknown> {
  const systemFields: Record<string, unknown> = {};
  for (const key of ['school', 'powerLevel', 'range', 'duration', 'rank', 'requirements', 'castingTime', 'powerScaling']) {
    if (spell[key] !== undefined) systemFields[key] = spell[key];
  }
  return {
    id: spell.id,
    type: 'spell',
    name: spell.name,
    summary: spell.summary ?? '',
    cost: typeof spell.wpCost === 'number' ? { wp: spell.wpCost } : undefined,
    prepared: spell.prepared,
    pinnedAsStamp: spell.pinnedAsStamp,
    effects: spell.effects,
    ...(Object.keys(systemFields).length > 0 ? { systemFields } : {}),
  };
}

function heroicToAbility(ability: Record<string, unknown>): Record<string, unknown> {
  const systemFields: Record<string, unknown> = {};
  for (const key of ['requirement', 'requirementSkillId', 'requirementSkillLevel']) {
    if (ability[key] !== undefined && ability[key] !== null) systemFields[key] = ability[key];
  }
  return {
    id: ability.id,
    type: 'heroic',
    name: ability.name,
    summary: ability.summary ?? '',
    cost: typeof ability.wpCost === 'number' ? { wp: ability.wpCost } : undefined,
    pinnedAsStamp: ability.pinnedAsStamp,
    ...(Object.keys(systemFields).length > 0 ? { systemFields } : {}),
  };
}

export function migrateCharacterV3ToV4(data: unknown): unknown {
  const rec = { ...(data as Record<string, unknown>) };
  const existing = Array.isArray(rec.abilities) ? (rec.abilities as Record<string, unknown>[]) : [];

  const converted: Record<string, unknown>[] = [];
  if (Array.isArray(rec.spells)) {
    for (const spell of rec.spells) {
      if (spell && typeof spell === 'object') converted.push(spellToAbility(spell as Record<string, unknown>));
    }
  }
  if (Array.isArray(rec.heroicAbilities)) {
    for (const ability of rec.heroicAbilities) {
      if (ability && typeof ability === 'object') converted.push(heroicToAbility(ability as Record<string, unknown>));
    }
  }

  // Anything already in `abilities` wins, so re-running cannot duplicate.
  const seen = new Set(existing.map(a => a.id));
  const abilities = [...existing, ...converted.filter(a => !seen.has(a.id))];

  delete rec.spells;
  delete rec.heroicAbilities;

  return { ...rec, abilities, schemaVersion: 4 };
}

/**
 * v4 → v5: retire Traveller's `sensors` skill into `electronicsSensors`.
 *
 * @remarks
 * `sensors` was never a Mongoose 2022 core skill. The book's equivalent is
 * Electronics (Sensors), which the definition now carries as
 * `electronicsSensors`, so the old id has to go — but deleting a skill id from
 * `system.json` does not delete it from any character. `SkillsScreen` iterates
 * the definition, so the stored value would simply vanish from the UI while
 * surviving on the record and reappearing as a raw-id row in the print sheet's
 * secondary slots. The data has to move before the definition drops the id.
 *
 * Scoped to Traveller characters by `systemId`: `sensors` is a plausible skill
 * name for a user-authored sci-fi system, and silently rewriting someone else's
 * skill id would be worse than leaving it alone. This is a data migration, not
 * engine behaviour, so naming a system here is not the banned `systemId ===`
 * branch — that rule is about ruleset *behaviour* leaking into screens.
 *
 * Merge rather than overwrite: a character who has both keeps the higher level
 * and stays trained if either entry was, so the migration cannot cost anyone a
 * skill level. Idempotent — the key is gone after the first run.
 */
export function migrateCharacterV4ToV5(data: unknown): unknown {
  const rec = { ...(data as Record<string, unknown>) };
  const skills = rec.skills;

  if (rec.systemId !== 'traveller' || !skills || typeof skills !== 'object') {
    return { ...rec, schemaVersion: 5 };
  }

  const bag = { ...(skills as Record<string, CharacterSkill | undefined>) };
  const legacy = bag['sensors'];
  if (!legacy) return { ...rec, schemaVersion: 5 };

  const target = bag['electronicsSensors'];
  bag['electronicsSensors'] = {
    ...target,
    value: Math.max(legacy.value ?? 0, target?.value ?? 0),
    trained: legacy.trained === true || target?.trained === true,
  };
  delete bag['sensors'];

  return { ...rec, skills: bag, schemaVersion: 5 };
}

const characterMigrations: Record<number, MigrationFn> = {
  1: migrateCharacterV1ToV2,
  2: migrateCharacterV2ToV3,
  3: migrateCharacterV3ToV4,
  4: migrateCharacterV4ToV5,
};

/**
 * Runs the migration ladder without validating the result.
 *
 * @remarks
 * Used for records read from the local database, where a single malformed
 * field should not prevent the whole library from loading. Import uses
 * {@link migrateCharacter} instead, which additionally validates — untrusted
 * input deserves the strict check, our own storage does not.
 */
export function upgradeCharacter(data: unknown): CharacterRecord {
  const record = data as { schemaVersion?: number };
  const version = typeof record.schemaVersion === 'number' ? record.schemaVersion : 1;

  let current: unknown = data;
  for (let v = version; v < CURRENT_SCHEMA_VERSION; v++) {
    const migrateFn = characterMigrations[v];
    if (migrateFn) {
      current = migrateFn(current);
    }
  }
  return current as CharacterRecord;
}

/**
 * Runs the migration ladder and validates the result against the character schema.
 *
 * @remarks
 * The import path, where the data is untrusted. Contrast with
 * {@link upgradeCharacter}, which skips validation for records read from our own
 * storage. Throws with a joined list of Zod issue paths when the upgraded record
 * fails validation, so a bad import surfaces a specific field rather than a
 * generic failure.
 */
export function migrateCharacter(data: unknown): CharacterRecord {
  const current = upgradeCharacter(data);

  const result = characterRecordSchema.safeParse(current);
  if (!result.success) {
    const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid character data: ${messages}`);
  }
  return result.data as CharacterRecord;
}

/**
 * Validates an imported system definition against its schema.
 *
 * @remarks
 * System definitions have no version ladder — they are validated, not migrated —
 * but this lives alongside {@link migrateCharacter} so the import flow has one
 * place to go for both. Throws with the offending field paths on failure.
 */
export function migrateSystem(data: unknown): SystemDefinition {
  const result = systemDefinitionSchema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid system data: ${messages}`);
  }
  return result.data as SystemDefinition;
}
