// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../storage/db/client';
import { collectCampaignBundle, collectSessionBundle } from './collectors';
import { createBlankCharacter } from '../../features/characters/characterMappers';
import { BUNDLED_SYSTEMS } from '../../systems/registry';

/**
 * A `represents` edge is the only record that a participant is a real creature.
 *
 * @remarks
 * `encounterParticipantSchema` deliberately carries no foreign-key column: its
 * own doc comment says the binding "is expressed via an `entityLink` edge of
 * type `represents` rather than a direct foreign-key column". So the edge is not
 * a convenience — it is the entire relationship.
 *
 * Both collectors used to gather entity links from
 * `[...noteIds, ...encounters.map(e => e.id)]`, a hand-written list of the two
 * endpoint kinds someone remembered. A `represents` edge has an **encounter
 * participant** at its `from` end, an id that lives nested inside an encounter
 * row and appears in no such list, so every one of them was dropped from every
 * export. The creature travelled, the encounter travelled, the participant
 * travelled inside the encounter row, and the binding between them did not —
 * in the file the settings screen calls "the only copy that survives this
 * device".
 *
 * The same enumeration is why `bundleParity.test.ts` could not see it: it seeds
 * its encounter with `participants: []`, so its round-trip passes on a bundle
 * with nothing to lose.
 *
 * These tests seed the shape the app actually writes and assert the edge comes
 * back out. They are deliberately about the *relationship*, not about which
 * ids a collector happens to enumerate, so they keep holding if the collection
 * strategy changes again.
 */

const NOW = '2026-01-01T00:00:00.000Z';
const CAMPAIGN_ID = 'camp-represents';
const SYSTEM_ID = BUNDLED_SYSTEMS[0].id;

/**
 * A campaign with one session, one encounter holding two participants, one
 * bestiary creature and one player character — plus the two `represents` edges
 * binding the participants to them.
 */
async function seedEncounterWithParticipants(): Promise<void> {
  const stamp = { schemaVersion: 1, createdAt: NOW, updatedAt: NOW };

  await db.campaigns.add({
    id: CAMPAIGN_ID,
    name: 'The Iron Circle',
    system: SYSTEM_ID,
    status: 'active',
    ...stamp,
  } as never);

  await db.sessions.add({
    id: 'sess-1',
    campaignId: CAMPAIGN_ID,
    title: 'Session One',
    status: 'ended',
    date: '2026-01-01',
    startedAt: NOW,
    ...stamp,
  } as never);

  await db.creatureTemplates.add({
    id: 'creature-1',
    campaignId: CAMPAIGN_ID,
    name: 'Wolf',
    category: 'animal',
    stats: {},
    attacks: [],
    abilities: [],
    skills: [],
    tags: [],
    status: 'active',
    ...stamp,
  } as never);

  // In the party, so both collectors gather the character by their own rules
  // and the edge is judged on its own merits rather than on `withLinkedCharacters`.
  await db.characters.add({
    ...createBlankCharacter(SYSTEM_ID),
    id: 'char-1',
    name: 'Astrid',
  } as never);
  await db.parties.add({ id: 'party-1', campaignId: CAMPAIGN_ID, name: 'The Crew', ...stamp } as never);
  await db.partyMembers.add({
    id: 'member-1',
    partyId: 'party-1',
    linkedCharacterId: 'char-1',
    ...stamp,
  } as never);

  await db.encounters.add({
    id: 'enc-1',
    sessionId: 'sess-1',
    campaignId: CAMPAIGN_ID,
    title: 'Ambush',
    type: 'combat',
    status: 'ended',
    tags: [],
    segments: [],
    participants: [
      { id: 'part-wolf', name: 'Wolf', type: 'monster', instanceState: {}, sortOrder: 0 },
      { id: 'part-astrid', name: 'Astrid', type: 'pc', instanceState: {}, sortOrder: 1 },
    ],
    ...stamp,
  } as never);

  await db.entityLinks.add({
    id: 'link-wolf',
    fromEntityId: 'part-wolf',
    fromEntityType: 'encounterParticipant',
    toEntityId: 'creature-1',
    toEntityType: 'creature',
    relationshipType: 'represents',
    ...stamp,
  } as never);

  await db.entityLinks.add({
    id: 'link-astrid',
    fromEntityId: 'part-astrid',
    fromEntityType: 'encounterParticipant',
    toEntityId: 'char-1',
    toEntityType: 'character',
    relationshipType: 'represents',
    ...stamp,
  } as never);
}

/** The ids of every `represents` edge in a collected bundle. */
function representsEdgeIds(entityLinks: unknown): string[] {
  if (!Array.isArray(entityLinks)) return [];
  return entityLinks
    .filter((l) => (l as { relationshipType?: string }).relationshipType === 'represents')
    .map((l) => (l as { id: string }).id)
    .sort();
}

describe('participant-to-creature bindings survive export', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await seedEncounterWithParticipants();
  });

  it('carries every `represents` edge in a campaign bundle', async () => {
    const result = await collectCampaignBundle(CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(
      representsEdgeIds(result.contents.entityLinks),
      'a campaign export that carries the creature and the encounter but not the '
      + 'edge between them restores every participant as a bare name with no stat '
      + 'block and no bestiary or PC identity — permanently, because this file is '
      + 'the only copy that survives the device.',
    ).toEqual(['link-astrid', 'link-wolf']);

    // The rows the edges point at travel too, or the importer would reject them.
    expect(result.contents.creatureTemplates?.map((c) => (c as { id: string }).id)).toContain('creature-1');
    expect(
      (result.contents.characters as Array<{ id: string }> | undefined)?.map((c) => c.id),
    ).toContain('char-1');
  });

  it('carries every `represents` edge in a session bundle', async () => {
    const result = await collectSessionBundle('sess-1');
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(representsEdgeIds(result.contents.entityLinks)).toEqual(['link-astrid', 'link-wolf']);
  });

  it('does not carry an edge whose endpoints are outside the bundle', async () => {
    // A participant belonging to some other campaign's encounter, pointing at a
    // creature that is in this bundle. Widening the collection must not widen it
    // to "every edge that mentions anything we happen to be carrying".
    await db.entityLinks.add({
      id: 'link-foreign',
      fromEntityId: 'part-elsewhere',
      fromEntityType: 'encounterParticipant',
      toEntityId: 'creature-1',
      toEntityType: 'creature',
      relationshipType: 'represents',
      schemaVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
    } as never);

    const result = await collectCampaignBundle(CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(representsEdgeIds(result.contents.entityLinks)).toEqual(['link-astrid', 'link-wolf']);
  });

  it('does not carry a soft-deleted edge', async () => {
    await db.entityLinks.update('link-wolf', {
      deletedAt: NOW,
      softDeletedBy: 'tx-1',
    } as never);

    const result = await collectCampaignBundle(CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(representsEdgeIds(result.contents.entityLinks)).toEqual(['link-astrid']);
  });
});
