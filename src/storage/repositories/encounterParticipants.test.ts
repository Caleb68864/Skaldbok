// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import * as encounterRepository from './encounterRepository';
import * as entityLinkRepository from './entityLinkRepository';
import { addPartyCharactersToEncounter } from '../../features/encounters/addPartyCharactersToEncounter';
import { nowISO } from '../../utils/dates';

/**
 * A participant may not be written into a soft-deleted encounter.
 *
 * @remarks
 * `useEncounter.ts` states the rule in a comment over the one site that keeps
 * it: *"A tombstoned encounter is invisible in the UI, so writing to one adds a
 * participant nobody can see or remove. The repository's `update` refuses this;
 * the participant paths need their own transaction (they touch entityLinks
 * too), so they have to make the same check."*
 *
 * Four siblings opened the identical transaction and never made the check —
 * `BestiaryScreen`, `CombatEncounterView`, `addPartyCharactersToEncounter` and
 * the summary write in `useSessionEncounter`. `BestiaryScreen` was byte-for-byte
 * the same transaction minus the `if (enc.deletedAt) return;` line. The rule was
 * stated once and implemented four times, three of them wrong, which is the
 * shape this repository keeps finding: a convention with no single owner.
 *
 * So the rule now has one implementation —
 * {@link encounterRepository.addRepresentedParticipants} — and this file tests
 * it. The other half, that the screens actually reach it rather than opening
 * their own transaction beside it, is `directDexieAccess.test.ts`: a site that
 * goes back to raw Dexie fails there before it can get here.
 *
 * **What each fixture makes possible, checked rather than assumed.** Every
 * refusal assertion below is paired with the same call against a *live*
 * encounter, because almost every way this fixture could be wrong — a missing
 * character, an unseeded encounter, an id typo — also produces "nothing was
 * added", and would read as the rule holding. A probe that cannot distinguish
 * "refused" from "never reached" proves nothing.
 */

const CAMPAIGN = 'camp-1';
const SESSION = 'sess-1';

async function seedCharacter(id: string, name: string): Promise<void> {
  await db.characters.add({
    id,
    name,
    systemId: 'classic-fantasy',
    schemaVersion: 1,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  } as never);
}

async function seedEncounter(id: string, opts: { deleted?: boolean } = {}): Promise<void> {
  const now = nowISO();
  await db.encounters.add({
    id,
    campaignId: CAMPAIGN,
    sessionId: SESSION,
    title: `encounter ${id}`,
    // Required by `encounterSchema`. Omitting it made `getById` return
    // `undefined` and three assertions failed on "cannot read participants of
    // undefined" — a fixture too incomplete to reach the subject, which is the
    // adjacent failure mode to a fixture too complete to contain the defect.
    type: 'combat',
    status: 'active',
    participants: [],
    segments: [{ startedAt: now }],
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    ...(opts.deleted ? { deletedAt: now, softDeletedBy: 'tx-probe' } : {}),
  } as never);
}

describe('adding a participant to an encounter', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('adds the participant and its represents edge together', async () => {
    await seedEncounter('enc-live');
    await seedCharacter('char-1', 'Astrid');
    // The fixture reached the subject: a row that fails `encounterSchema` reads
    // back as `undefined` and every assertion below would fail for the wrong
    // reason.
    expect(await encounterRepository.getById('enc-live')).toBeDefined();

    const added = await encounterRepository.addRepresentedParticipants('enc-live', [
      { name: 'Astrid', type: 'pc', represents: { id: 'char-1', type: 'character' } },
    ]);

    expect(added).toHaveLength(1);
    const enc = await encounterRepository.getById('enc-live');
    expect(enc?.participants.map((p) => p.name)).toEqual(['Astrid']);
    const links = await entityLinkRepository.getLinksFrom(added[0]!, 'represents');
    expect(links.map((l) => l.toEntityId)).toEqual(['char-1']);
  });

  it('refuses a soft-deleted encounter, where the same call succeeds on a live one', async () => {
    await seedEncounter('enc-dead', { deleted: true });
    await seedEncounter('enc-live');
    await seedCharacter('char-1', 'Astrid');

    // The control first: if this is empty the fixture is broken and the refusal
    // below would be indistinguishable from never reaching the subject.
    const onLive = await encounterRepository.addRepresentedParticipants('enc-live', [
      { name: 'Astrid', type: 'pc', represents: { id: 'char-1', type: 'character' } },
    ]);
    expect(onLive, 'the fixture never reached the subject').toHaveLength(1);

    const onDead = await encounterRepository.addRepresentedParticipants('enc-dead', [
      { name: 'Astrid', type: 'pc', represents: { id: 'char-1', type: 'character' } },
    ]);
    expect(onDead).toEqual([]);

    // And nothing was written, edge included — a tombstoned encounter that gains
    // a dangling `represents` edge is the half-write this transaction exists to
    // prevent.
    const dead = await db.encounters.get('enc-dead');
    expect((dead as { participants: unknown[] }).participants).toEqual([]);
    const allLinks = await db.entityLinks.toArray();
    expect(allLinks.filter((l) => l.toEntityId === 'char-1')).toHaveLength(1);
  });

  it('throws on an encounter that does not exist', async () => {
    await expect(
      encounterRepository.addRepresentedParticipants('enc-missing', [
        { name: 'Nobody', type: 'pc', represents: { id: 'char-1', type: 'character' } },
      ]),
    ).rejects.toThrow(/enc-missing/);
  });

  it('skips a PC already represented, and lets a creature repeat', async () => {
    await seedEncounter('enc-live');
    await seedCharacter('char-1', 'Astrid');

    await encounterRepository.addRepresentedParticipants('enc-live', [
      { name: 'Astrid', type: 'pc', represents: { id: 'char-1', type: 'character' } },
    ]);
    const second = await encounterRepository.addRepresentedParticipants('enc-live', [
      { name: 'Astrid', type: 'pc', represents: { id: 'char-1', type: 'character' } },
    ]);
    expect(second, 'a PC appeared twice in one encounter').toEqual([]);

    const wolfA = await encounterRepository.addRepresentedParticipants('enc-live', [
      { name: 'Wolf', type: 'monster', represents: { id: 'wolf', type: 'creature' } },
    ]);
    const wolfB = await encounterRepository.addRepresentedParticipants('enc-live', [
      { name: 'Wolf', type: 'monster', represents: { id: 'wolf', type: 'creature' } },
    ]);
    expect(wolfA, 'the GM could not add a second wolf').toHaveLength(1);
    expect(wolfB, 'the GM could not add a second wolf').toHaveLength(1);
  });

  it('keeps sortOrder unique after a mid-list removal', async () => {
    await seedEncounter('enc-live');
    for (const name of ['A', 'B', 'C']) {
      await encounterRepository.addRepresentedParticipants('enc-live', [
        { name, type: 'monster', represents: { id: `c-${name}`, type: 'creature' } },
      ]);
    }
    const before = await encounterRepository.getById('enc-live');
    const middle = before!.participants.find((p) => p.name === 'B')!;
    await encounterRepository.update('enc-live', {
      participants: before!.participants.filter((p) => p.id !== middle.id),
    });

    await encounterRepository.addRepresentedParticipants('enc-live', [
      { name: 'D', type: 'monster', represents: { id: 'c-D', type: 'creature' } },
    ]);
    const after = await encounterRepository.getById('enc-live');
    const orders = after!.participants.map((p) => p.sortOrder);
    // `length + 1` would have reused 3 here, which is what the bestiary screen
    // computed before it was moved behind this function.
    expect(new Set(orders).size, `duplicate sortOrder in ${orders.join(',')}`).toBe(orders.length);
  });

  it('adds a whole party in one commit and keeps their order', async () => {
    await seedEncounter('enc-live');
    await seedCharacter('char-1', 'Astrid');
    await seedCharacter('char-2', 'Bjorn');

    const added = await encounterRepository.addRepresentedParticipants('enc-live', [
      { name: 'Astrid', type: 'pc', represents: { id: 'char-1', type: 'character' } },
      { name: 'Bjorn', type: 'pc', represents: { id: 'char-2', type: 'character' } },
    ]);
    expect(added).toHaveLength(2);
    const enc = await encounterRepository.getById('enc-live');
    expect(enc!.participants.map((p) => p.name)).toEqual(['Astrid', 'Bjorn']);
    expect(new Set(enc!.participants.map((p) => p.sortOrder)).size).toBe(2);
  });
});

describe('addPartyCharactersToEncounter', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('refuses a soft-deleted encounter, where the same call succeeds on a live one', async () => {
    await seedEncounter('enc-dead', { deleted: true });
    await seedEncounter('enc-live');
    await seedCharacter('char-1', 'Astrid');
    await seedCharacter('char-2', 'Bjorn');

    // Control. `addPartyCharactersToEncounter` returns 0 for an empty character
    // list, an unresolvable id, and a no-op dedupe — three ways for a broken
    // fixture to look exactly like the rule being kept.
    const onLive = await addPartyCharactersToEncounter('enc-live', ['char-1', 'char-2']);
    expect(onLive, 'the fixture never reached the subject').toBe(2);

    const onDead = await addPartyCharactersToEncounter('enc-dead', ['char-1', 'char-2']);
    expect(onDead).toBe(0);
    const dead = await db.encounters.get('enc-dead');
    expect((dead as { participants: unknown[] }).participants).toEqual([]);
  });

  it('still skips a character already in the encounter', async () => {
    await seedEncounter('enc-live');
    await seedCharacter('char-1', 'Astrid');
    expect(await addPartyCharactersToEncounter('enc-live', ['char-1'])).toBe(1);
    expect(await addPartyCharactersToEncounter('enc-live', ['char-1'])).toBe(0);
  });
});
