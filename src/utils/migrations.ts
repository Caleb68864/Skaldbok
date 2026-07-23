import { characterRecordSchema } from '../../schemas/character.schema';
import { systemDefinitionSchema } from '../../schemas/system.schema';
import type { CharacterRecord } from '../types/character';
import type { SystemDefinition } from '../types/system';

export const CURRENT_SCHEMA_VERSION = 2;

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

const characterMigrations: Record<number, MigrationFn> = {
  1: migrateCharacterV1ToV2,
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

export function migrateCharacter(data: unknown): CharacterRecord {
  const current = upgradeCharacter(data);

  const result = characterRecordSchema.safeParse(current);
  if (!result.success) {
    const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid character data: ${messages}`);
  }
  return result.data as CharacterRecord;
}

export function migrateSystem(data: unknown): SystemDefinition {
  const result = systemDefinitionSchema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid system data: ${messages}`);
  }
  return result.data as SystemDefinition;
}
