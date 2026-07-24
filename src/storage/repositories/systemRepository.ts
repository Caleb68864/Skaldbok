import { db } from '../db/client';
import type { SystemDefinition } from '../../types/system';

/** Every system definition cached in IndexedDB (bundled systems plus any imported/authored ones). */
export async function getAll(): Promise<SystemDefinition[]> {
  return db.systems.toArray();
}

/** One cached system definition by id, or `undefined` if it has not been stored. */
export async function getById(id: string): Promise<SystemDefinition | undefined> {
  return db.systems.get(id);
}

/**
 * Upserts a system definition into the cache.
 *
 * @remarks
 * `useSystemDefinition` only overwrites a cached copy when the incoming
 * `version` is higher, which is why editing a bundled `system.json` requires
 * bumping its version to take effect.
 */
export async function save(system: SystemDefinition): Promise<void> {
  try {
    await db.systems.put(system);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Please free up space and try again.');
    }
    throw new Error(`Failed to save system: ${String(err)}`);
  }
}
