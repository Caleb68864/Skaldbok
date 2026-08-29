import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../db/client';
import { getAll, getById, save, softDelete, restore } from './characterRepository';
import { createLink, getLinksTo } from './entityLinkRepository';
import { getPartyMembers } from './partyRepository';
import { createBlankCharacter } from '../../features/characters/characterMappers';
import { nowISO } from '../../utils/dates';

/**
 * Deleting a character is the user-facing "Delete" in the library, and it used
 * to be a hard delete — the one entity where "restore" was impossible. These
 * tests pin the soft-delete cascade: the character, the party seats that link
 * to it and the `represents` edges from encounter participants all go down
 * under one transaction id, and come back together.
 */

async function seedCharacter(id: string) {
  const character = { ...createBlankCharacter('classic-fantasy'), id, name: `Hero ${id}` };
  await save(character);
  return character;
}

async function seedPartyMember(characterId: string) {
  const now = nowISO();
  const party = { id: `party-${characterId}`, campaignId: 'camp-1', schemaVersion: 1, createdAt: now, updatedAt: now };
  await db.parties.add(party as never);
  const member = {
    id: `member-${characterId}`,
    partyId: party.id,
    linkedCharacterId: characterId,
    isActivePlayer: true,
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
  await db.partyMembers.add(member as never);
  return { party, member };
}

describe('characterRepository soft delete cascade', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('hides the character from reads but keeps the row', async () => {
    await seedCharacter('c1');
    await softDelete('c1');

    expect(await getById('c1')).toBeUndefined();
    expect(await getAll()).toHaveLength(0);
    expect((await getById('c1', { includeDeleted: true }))?.deletedAt).toBeTruthy();
  });

  it('takes party seats and represents-edges down under the same transaction id', async () => {
    await seedCharacter('c1');
    const { party } = await seedPartyMember('c1');
    await createLink({
      fromEntityId: 'participant-1',
      fromEntityType: 'encounterParticipant',
      toEntityId: 'c1',
      toEntityType: 'character',
      relationshipType: 'represents',
    });

    await softDelete('c1');

    const row = await db.characters.get('c1');
    expect(row?.softDeletedBy).toBeTruthy();
    expect(await getPartyMembers(party.id)).toHaveLength(0);
    expect(await getLinksTo('c1', 'represents')).toHaveLength(0);

    const member = await db.partyMembers.get('member-c1');
    const edge = (await db.entityLinks.where('toEntityId').equals('c1').toArray())[0];
    expect(member?.softDeletedBy).toBe(row?.softDeletedBy);
    expect(edge?.softDeletedBy).toBe(row?.softDeletedBy);
  });

  it('restore brings the character, its seat and its edges back together', async () => {
    await seedCharacter('c1');
    const { party } = await seedPartyMember('c1');
    await createLink({
      fromEntityId: 'participant-1',
      fromEntityType: 'encounterParticipant',
      toEntityId: 'c1',
      toEntityType: 'character',
      relationshipType: 'represents',
    });

    await softDelete('c1');
    await restore('c1');

    expect(await getById('c1')).toBeDefined();
    expect(await getPartyMembers(party.id)).toHaveLength(1);
    expect(await getLinksTo('c1', 'represents')).toHaveLength(1);
  });

  it('does not restore a seat that was removed on its own, before the character was deleted', async () => {
    await seedCharacter('c1');
    const { party, member } = await seedPartyMember('c1');
    await db.partyMembers.update(member.id, { deletedAt: nowISO(), softDeletedBy: 'tx-earlier' });

    await softDelete('c1');
    await restore('c1');

    expect(await getPartyMembers(party.id)).toHaveLength(0);
  });
});
