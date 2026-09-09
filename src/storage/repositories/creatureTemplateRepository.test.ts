// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/client';
import { getDeleted, softDelete } from './creatureTemplateRepository';

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
