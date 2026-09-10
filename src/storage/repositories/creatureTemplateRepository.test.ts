// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../db/client';
import { create, getDeleted, softDelete } from './creatureTemplateRepository';

/**
 * The bestiary is per-campaign everywhere except, until now, its trash.
 *
 * @remarks
 * `getDeleted` read the whole table. A creature deleted while running one game
 * therefore appeared in another game's Trash screen, and restoring it there put
 * it back into the campaign it came from — where the GM who deleted it was not
 * looking. `sessionRepository.getDeleted` and `noteRepository.getDeleted` both
 * take a campaignId; this was the one that did not.
 */

const NOW = '2026-01-01T00:00:00.000Z';

async function seedCreature(id: string, campaignId: string) {
  await db.creatureTemplates.add({
    id,
    campaignId,
    name: `Beast ${id}`,
    category: 'monster',
    stats: {},
    attacks: [],
    abilities: [],
    skills: [],
    tags: [],
    status: 'active',
    schemaVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
  } as never);
}

describe('creatureTemplateRepository.getDeleted', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('returns only the asked-for campaign, not every campaign at once', async () => {
    await seedCreature('mine', 'camp-a');
    await seedCreature('theirs', 'camp-b');
    await softDelete('mine');
    await softDelete('theirs');

    expect((await getDeleted('camp-a')).map((c) => c.id)).toEqual(['mine']);
    expect((await getDeleted('camp-b')).map((c) => c.id)).toEqual(['theirs']);
  });

  it('leaves live creatures out of the trash', async () => {
    await seedCreature('live', 'camp-a');
    await seedCreature('gone', 'camp-a');
    await softDelete('gone');

    expect((await getDeleted('camp-a')).map((c) => c.id)).toEqual(['gone']);
  });
});

/**
 * A write that does not land has to say so.
 *
 * @remarks
 * `create` caught every error from `db.creatureTemplates.add(record)` —
 * `QuotaExceededError` included — `console.warn`ed and returned `undefined`,
 * which the chain above it ignored all the way to `setShowForm(false)`. On a
 * full disk the user watched the form close and the creature was gone with no
 * message. This is local-first: there is no server copy and no later retry.
 */
describe('creatureTemplateRepository.create', () => {
  beforeEach(async () => {
    await db.creatureTemplates.clear();
  });

  const data = {
    campaignId: 'camp-a',
    name: 'Wolf',
    category: 'monster' as const,
    stats: {},
    attacks: [],
    abilities: [],
    skills: [],
    tags: [],
    status: 'active' as const,
  };

  it('propagates a quota failure as a message the caller can show', async () => {
    const add = vi
      .spyOn(db.creatureTemplates, 'add')
      .mockRejectedValue(new DOMException('quota', 'QuotaExceededError'));
    try {
      await expect(create(data)).rejects.toThrow(/Storage is full/);
    } finally {
      add.mockRestore();
    }
    expect(await db.creatureTemplates.count()).toBe(0);
  });

  it('propagates any other write failure rather than reporting success', async () => {
    const add = vi.spyOn(db.creatureTemplates, 'add').mockRejectedValue(new Error('disk on fire'));
    try {
      await expect(create(data)).rejects.toThrow(/disk on fire/);
    } finally {
      add.mockRestore();
    }
  });

  it('returns the written record when it lands', async () => {
    const created = await create(data);
    expect(created.name).toBe('Wolf');
    expect(await db.creatureTemplates.get(created.id)).toBeDefined();
  });
});
