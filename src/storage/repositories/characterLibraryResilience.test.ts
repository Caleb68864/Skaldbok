import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import * as characterRepository from './characterRepository';
import { createBlankCharacter } from '../../features/characters/characterMappers';

beforeEach(async () => {
  await resetDatabase();
});
afterEach(() => vi.restoreAllMocks());

describe('characterRepository.getAll', () => {
  it('skips a row that cannot be upgraded and still lists the rest', async () => {
    // Roadmap A10. `getAll` mapped upgradeCharacter over every row with no guard,
    // so one row a migration throws on hid the whole library.
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const good = { ...createBlankCharacter('classic-fantasy'), id: 'good' };
    await db.characters.put(good);
    const poison = { id: 'poison', schemaVersion: 1 } as Record<string, unknown>;
    await db.characters.put(poison as never);

    const migrations = await import('../../utils/migrations');
    const real = migrations.upgradeCharacter;
    vi.spyOn(migrations, 'upgradeCharacter').mockImplementation(row => {
      if ((row as { id: string }).id === 'poison') throw new Error('cannot migrate');
      return real(row);
    });

    expect((await characterRepository.getAll()).map(c => c.id)).toContain('good');
    expect(warn).toHaveBeenCalled();
  });
});
