// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from './db/client';
import { resetDatabase } from '../test-utils/resetDatabase';
import { createSessionLogNote, captureNpcWithNote } from './noteCreationService';
import * as entityLinkRepository from './repositories/entityLinkRepository';
import { nowISO } from '../utils/dates';

/**
 * The two composed note writes, and the atomicity that is their whole reason.
 *
 * @remarks
 * Both lived inside `useSessionLog` as raw `db.transaction(...)` blocks — the
 * last direct Dexie access outside the import and reset paths, and the one the
 * allowlist recorded as `DEBT`. The stated reason was that "their home is a
 * storage-layer service that does not exist yet". It did exist:
 * `noteCreationService` imported nothing but repositories, types and utils, and
 * was filed under `features/notes/` for no reason the code gives. Moving it into
 * `src/storage/` and putting the transactions in it changed no behaviour and
 * made both testable without a React tree, which is the second half of why they
 * had no tests.
 *
 * What each test asserts is the property a call site cannot: that a failure
 * part-way through leaves **nothing** behind. A log note whose `contains` edge
 * was not written exists in no session and appears in no list — it does not look
 * lost, it looks absent. A creature template whose note was not written is an
 * orphan stat block. Neither is visible as a failure from the screen that
 * caused it.
 *
 * Each probe asserts its injection was reached, and each is paired with the same
 * call succeeding — the pairing that keeps a fixture fault from reading as the
 * rule being kept, since both produce "nothing happened".
 */

const SESSION = { id: 'sess-1', campaignId: 'camp-1' };

async function seedActiveEncounter(id: string) {
  const now = nowISO();
  await db.encounters.add({
    id,
    campaignId: SESSION.campaignId,
    sessionId: SESSION.id,
    title: `encounter ${id}`,
    type: 'combat',
    status: 'active',
    participants: [],
    segments: [{ startedAt: now }],
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  } as never);
}

describe('createSessionLogNote', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the note and its session edge together', async () => {
    const note = await createSessionLogNote({
      session: SESSION,
      title: 'Aldric rolled Axes',
      type: 'skill-check',
      typeData: {},
      status: 'active',
      pinned: false,
    });

    expect(await db.notes.get(note.id)).toBeDefined();
    const edges = await entityLinkRepository.getLinksFrom(SESSION.id, 'contains');
    expect(edges.map(e => e.toEntityId)).toContain(note.id);
  });

  it('attaches to the session\'s active encounter, resolved at write time', async () => {
    await seedActiveEncounter('enc-1');
    const note = await createSessionLogNote({
      session: SESSION,
      title: 'first blood',
      type: 'generic',
      typeData: {},
      status: 'active',
      pinned: false,
    });

    const edges = await entityLinkRepository.getLinksFrom('enc-1', 'contains');
    expect(
      edges.map(e => e.toEntityId),
      'the encounter was open and the note did not attach to it',
    ).toContain(note.id);
  });

  it('does not attach when the caller asks for a session-level entry', async () => {
    await seedActiveEncounter('enc-1');
    const note = await createSessionLogNote({
      session: SESSION,
      targetEncounterId: null,
      title: 'between fights',
      type: 'generic',
      typeData: {},
      status: 'active',
      pinned: false,
    });

    const edges = await entityLinkRepository.getLinksFrom('enc-1', 'contains');
    expect(edges.map(e => e.toEntityId)).not.toContain(note.id);
  });

  it('leaves no note behind when the link write fails', async () => {
    // The transaction, stated as a behaviour. Split these into two sequential
    // awaits and this goes red: the note survives with nothing pointing at it.
    const add = vi
      .spyOn(db.entityLinks, 'add')
      .mockRejectedValue(new Error('probe: link write refused'));

    await expect(
      createSessionLogNote({
        session: SESSION,
        title: 'never happened',
        type: 'generic',
        typeData: {},
        status: 'active',
        pinned: false,
      }),
    ).rejects.toThrow();

    expect(add, 'the injection was never reached — the spy is inert').toHaveBeenCalled();
    expect(
      await db.notes.count(),
      'the note outlived the failed transaction, so it exists in no session',
    ).toBe(0);
  });
});

describe('captureNpcWithNote', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the creature, its note and the links in one commit', async () => {
    const { note, creatureId } = await captureNpcWithNote({
      session: SESSION,
      name: 'Bandit Chief',
      category: 'npc',
      stats: { hp: 12, armor: 2, movement: 10 },
      description: 'scarred, impatient',
    });

    const creature = await db.creatureTemplates.get(creatureId);
    expect(creature?.name).toBe('Bandit Chief');
    expect(creature?.stats, 'the stat block is written as given, not rebuilt here').toEqual({
      hp: 12, armor: 2, movement: 10,
    });
    expect(await db.notes.get(note.id)).toBeDefined();
    // An NPC note also records where it was first introduced.
    const introduced = await entityLinkRepository.getLinksFrom(note.id, 'introduced_in');
    expect(introduced.map(e => e.toEntityId)).toContain(SESSION.id);
  });

  it('leaves neither creature nor note behind when the note write fails', async () => {
    const add = vi
      .spyOn(db.notes, 'add')
      .mockRejectedValue(new Error('probe: note write refused'));

    await expect(
      captureNpcWithNote({
        session: SESSION,
        name: 'Ghost',
        category: 'monster',
        stats: { hp: 1 },
      }),
    ).rejects.toThrow();

    expect(add, 'the injection was never reached — the spy is inert').toHaveBeenCalled();
    expect(
      await db.creatureTemplates.count(),
      'the template survived without its note: an orphan stat block in the bestiary',
    ).toBe(0);
  });
});
