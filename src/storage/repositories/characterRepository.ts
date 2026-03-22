import { db } from '../db/client';
import type { CharacterRecord } from '../../types/character';

export async function getAll(): Promise<CharacterRecord[]> {
  return db.characters.toArray();
}

export async function getById(id: string): Promise<CharacterRecord | undefined> {
  return db.characters.get(id);
}

export async function save(character: CharacterRecord): Promise<void> {
  try {
    await db.characters.put(character);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Please free up space and try again.');
    }
    throw new Error(`Failed to save character: ${String(err)}`);
  }
}

export async function remove(id: string): Promise<void> {
  try {
    await db.characters.delete(id);
  } catch (err) {
    throw new Error(`Failed to delete character: ${String(err)}`);
  }
}
