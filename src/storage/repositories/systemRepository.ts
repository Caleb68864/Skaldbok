import { db } from '../db/client';
import type { SystemDefinition } from '../../types/system';

export async function getAll(): Promise<SystemDefinition[]> {
  return db.systems.toArray();
}

export async function getById(id: string): Promise<SystemDefinition | undefined> {
  return db.systems.get(id);
}

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
