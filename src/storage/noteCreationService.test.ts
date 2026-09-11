// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from './db/client';
import { resetDatabase } from '../test-utils/resetDatabase';
import { buildNoteRecord, createSessionLogNote, persistCanonicalNoteLinks } from './noteCreationService';
import * as entityLinkRepository from './repositories/entityLinkRepository';
import { nowISO } from '../utils/dates';

/**
 * The composed note write, and the atomicity that is its whole reason.
 *
 * @remarks
 * This lived inside `useSessionLog` as a raw `db.transaction(...)` block — the
 * last direct Dexie access outside the import and reset paths, and the one the
 * allowlist recorded as `DEBT`. The stated reason was that "their home is a
 * storage-layer service that does not exist yet". It did exist:
 * `noteCreationService` imported nothing but repositories, types and utils, and
 * was filed under `features/notes/` for no reason the code gives. Moving it into
 * `src/storage/` and putting the transaction in it changed no behaviour and
 * made it testable without a React tree, which is the second half of why it had
 * no tests.
 *
 * It had a sibling, `captureNpcWithNote`, which was moved and tested in the same
 * change and is now gone — its one caller had been deleted six weeks earlier, as
 * a *feature*, by the notes overhaul that took the capture role off the Session
 * tab. Both rounds of maintenance were paid on code no user could reach.
 *
 * What each test asserts is the property a call site cannot: that a failure
 * part-way through leaves **nothing** behind. A log note whose `contains` edge
 * was not written exists in no session and appears in no list — it does not look
 * lost, it looks absent. That is not visible as a failure from the screen that
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

describe('persistCanonicalNoteLinks', () => {
  /**
   * The `introduced_in` edge, kept covered after its other caller went.
   *
   * @remarks
   * This branch was asserted only by `captureNpcWithNote`'s test, and that
   * function has been removed for having no caller. The branch itself is very
   * much alive — `useNoteActions.createNote` runs it for every note the user
   * files as an NPC — so the coverage moves here rather than leaving with the
   * dead code that happened to be exercising it. Deleting a test along with the
   * unreachable path it was written against is how a live branch quietly loses
   * its only assertion.
   */
  beforeEach(async () => {
    await resetDatabase();
  });

  it('records where an NPC note was first introduced', async () => {
    const note = buildNoteRecord({
      campaignId: SESSION.campaignId,
      sessionId: SESSION.id,
      title: 'Bandit Chief',
      type: 'npc',
      typeData: {},
      status: 'active',
      pinned: false,
      scope: 'campaign',
    });
    await db.notes.add(note);

    await persistCanonicalNoteLinks({ note, sessionId: SESSION.id, encounterId: null });

    const introduced = await entityLinkRepository.getLinksFrom(note.id, 'introduced_in');
    expect(introduced.map(e => e.toEntityId)).toContain(SESSION.id);
  });

  it('records it only for NPC notes — the control', async () => {
    // Without this the assertion above passes on a function that links
    // everything to everything.
    const note = buildNoteRecord({
      campaignId: SESSION.campaignId,
      sessionId: SESSION.id,
      title: 'a passing thought',
      type: 'generic',
      typeData: {},
      status: 'active',
      pinned: false,
      scope: 'campaign',
    });
    await db.notes.add(note);

    await persistCanonicalNoteLinks({ note, sessionId: SESSION.id, encounterId: null });

    expect(await entityLinkRepository.getLinksFrom(note.id, 'introduced_in')).toEqual([]);
    expect(
      (await entityLinkRepository.getLinksFrom(SESSION.id, 'contains')).map(e => e.toEntityId),
      'the fixture never reached the subject — no session edge was written either',
    ).toContain(note.id);
  });
});

