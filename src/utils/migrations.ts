import { characterRecordSchema } from '../../schemas/character.schema';
import { systemDefinitionSchema } from '../../schemas/system.schema';
import type { CharacterRecord } from '../types/character';
import type { SystemDefinition } from '../types/system';

export const CURRENT_SCHEMA_VERSION = 1;

type MigrationFn = (data: unknown) => unknown;

const characterMigrations: Record<number, MigrationFn> = {
  // Version 1: initial version, no migration needed
  // Add future migrations here: 1: (data) => ({...data, newField: defaultValue})
};

export function migrateCharacter(data: unknown): CharacterRecord {
  const record = data as { schemaVersion?: number };
  const version = typeof record.schemaVersion === 'number' ? record.schemaVersion : 1;

  let current: unknown = data;
  for (let v = version; v < CURRENT_SCHEMA_VERSION; v++) {
    const migrateFn = characterMigrations[v];
    if (migrateFn) {
      current = migrateFn(current);
    }
  }

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
