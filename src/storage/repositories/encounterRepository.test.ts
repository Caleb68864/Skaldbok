import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../db/client';
import { create, getById, update, updateParticipant, addParticipant } from './encounterRepository';

/**
 * `update` and `updateParticipant` used to read the encounter, build a new
 * record from what they read, and put it back — with an await in between and no
 * transaction. Two edits landing in the same tick each read the pre-edit row,
 * so the second write silently discarded the first. The combat view does
 * exactly that when the GM blurs two participants' HP in quick succession.
 */

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function seedEncounter() {
  const encounter = (await create({
    campaignId: 'camp-1',
    sessionId: 'sess-1',
    title: 'Ambush',
    type: 'combat',
    status: 'active',
    tags: [],
    participants: [],
    segments: [],
  }))!;
  await addParticipant(encounter.id, { name: 'Goblin', type: 'monster', instanceState: {}, sortOrder: 0 });
  await addParticipant(encounter.id, { name: 'Ogre', type: 'monster', instanceState: {}, sortOrder: 1 });
  return (await getById(encounter.id))!;
}

describe('updateParticipant', () => {
  it('changes one participant and leaves the others alone', async () => {
    const encounter = await seedEncounter();
    const [goblin, ogre] = encounter.participants;

    await updateParticipant(encounter.id, goblin.id, { instanceState: { currentHp: 3 } });

    const stored = await getById(encounter.id);
    expect(stored?.participants.find(p => p.id === goblin.id)?.instanceState.currentHp).toBe(3);
    expect(stored?.participants.find(p => p.id === ogre.id)?.instanceState.currentHp).toBeUndefined();
  });

  it('keeps both edits when two participants are updated concurrently', async () => {
    // The regression: both calls read the same pre-edit participant list, and
    // whichever wrote last erased the other's change.
    const encounter = await seedEncounter();
    const [goblin, ogre] = encounter.participants;

    await Promise.all([
      updateParticipant(encounter.id, goblin.id, { instanceState: { currentHp: 3 } }),
      updateParticipant(encounter.id, ogre.id, { instanceState: { currentHp: 9 } }),
    ]);

    const stored = await getById(encounter.id);
    expect(stored?.participants.find(p => p.id === goblin.id)?.instanceState.currentHp).toBe(3);
    expect(stored?.participants.find(p => p.id === ogre.id)?.instanceState.currentHp).toBe(9);
  });

  it('returns undefined for an unknown encounter', async () => {
    expect(await updateParticipant('nope', 'p1', { name: 'x' })).toBeUndefined();
  });

  it('will not write to a soft-deleted encounter', async () => {
    const encounter = await seedEncounter();
    await db.encounters.update(encounter.id, { deletedAt: '2026-01-01T00:00:00.000Z' });

    expect(await updateParticipant(encounter.id, encounter.participants[0].id, { name: 'Zombie' })).toBeUndefined();
  });
});

describe('update', () => {
  it('keeps both writes when two fields are changed concurrently', async () => {
    const encounter = await seedEncounter();

    await Promise.all([
      update(encounter.id, { title: 'Ambush at the Ford' }),
      update(encounter.id, { location: 'Riverside' }),
    ]);

    const stored = await getById(encounter.id);
    expect(stored?.title).toBe('Ambush at the Ford');
    expect(stored?.location).toBe('Riverside');
  });
});
