// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import * as encounterRepository from './encounterRepository';
import * as entityLinkRepository from './entityLinkRepository';
import { nowISO } from '../../utils/dates';

/**
 * The two remaining writes that reached a tombstoned encounter.
 *
 * @remarks
 * `encounterParticipants.test.ts` covers the participant paths. These are the
 * other two the scan named, and they fail differently from each other:
 *
 * - **The end-of-fight summary.** `useSessionEncounter.endEncounter` read the
 *   encounter with a bare `db.encounters.get(id)`, checked only that it existed,
 *   and wrote `status: 'ended'` plus the user's summary prose into it. So the
 *   paragraph someone types at the end of a fight could land in an encounter
 *   deleted from another tab, and vanish the moment the dialog closed. It is the
 *   worst of the four in one specific way: the other three write structure the
 *   user can re-create, and this one writes text they wrote by hand.
 * - **Note reassignment.** `useSessionLog.reassignNote` checked that the target
 *   encounter existed and that its session matched, but not that it was alive. A
 *   note filed into a deleted encounter stays live itself and drops out of every
 *   encounter-scoped list — so it does not look lost, it looks *moved*, which is
 *   harder to notice and harder to undo.
 *
 * Both refusals are paired with the same call against a live encounter, for the
 * reason that keeps recurring here: a fixture fault produces "nothing happened",
 * and so does the rule being kept.
 */

const SESSION = 'sess-1';

async function seedEncounter(id: string, opts: { deleted?: boolean; session?: string } = {}) {
  const now = nowISO();
  await db.encounters.add({
    id,
    campaignId: 'camp-1',
    sessionId: opts.session ?? SESSION,
    title: `encounter ${id}`,
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

async function seedNote(id: string) {
  const now = nowISO();
  await db.notes.add({
    id,
    campaignId: 'camp-1',
    sessionId: SESSION,
    type: 'log',
    title: `note ${id}`,
    content: {},
    tags: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  } as never);
}

describe('ending an encounter with a summary', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('writes the summary and closes the segment', async () => {
    await seedEncounter('enc-live');
    const ended = await encounterRepository.endWithSummary('enc-live', { text: 'we won' });
    expect(ended, 'the fixture never reached the subject').toBeDefined();
    expect(ended!.status).toBe('ended');
    expect(ended!.summary).toEqual({ text: 'we won' });
    expect(ended!.segments[ended!.segments.length - 1]!.endedAt).toBeDefined();
  });

  it('refuses a soft-deleted encounter, where the same call succeeds on a live one', async () => {
    await seedEncounter('enc-live');
    await seedEncounter('enc-dead', { deleted: true });

    expect(
      await encounterRepository.endWithSummary('enc-live', { text: 'control' }),
      'the fixture never reached the subject',
    ).toBeDefined();

    await expect(
      encounterRepository.endWithSummary('enc-dead', { text: 'lost prose' }),
    ).rejects.toThrow(/enc-dead/);

    const dead = await db.encounters.get('enc-dead');
    expect((dead as { summary?: unknown }).summary).toBeUndefined();
    expect((dead as { status: string }).status).toBe('active');
  });

  it('throws on an encounter that does not exist', async () => {
    await expect(encounterRepository.endWithSummary('enc-missing')).rejects.toThrow(/enc-missing/);
  });

  it('leaves the summary alone when none is supplied', async () => {
    await seedEncounter('enc-live');
    await encounterRepository.endWithSummary('enc-live', { text: 'first' });
    await db.encounters.update('enc-live', { segments: [{ startedAt: nowISO() }] });
    const again = await encounterRepository.endWithSummary('enc-live');
    expect(again!.summary).toEqual({ text: 'first' });
  });
});

describe('reassigning a note to an encounter', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('moves the contains edge and tombstones the old one', async () => {
    await seedNote('note-1');
    await seedEncounter('enc-a');
    await seedEncounter('enc-b');

    await entityLinkRepository.reassignNoteToEncounter('note-1', 'enc-a');
    await entityLinkRepository.reassignNoteToEncounter('note-1', 'enc-b');

    const live = await entityLinkRepository.getLinksTo('note-1', 'contains');
    expect(live.map((l) => l.fromEntityId)).toEqual(['enc-b']);
    const all = await entityLinkRepository.getLinksTo('note-1', 'contains', { includeDeleted: true });
    expect(all).toHaveLength(2);
  });

  it('refuses a soft-deleted target, where the same call succeeds on a live one', async () => {
    await seedNote('note-1');
    await seedEncounter('enc-live');
    await seedEncounter('enc-dead', { deleted: true });

    await entityLinkRepository.reassignNoteToEncounter('note-1', 'enc-live');
    expect(
      (await entityLinkRepository.getLinksTo('note-1', 'contains')).map((l) => l.fromEntityId),
      'the fixture never reached the subject',
    ).toEqual(['enc-live']);

    await expect(
      entityLinkRepository.reassignNoteToEncounter('note-1', 'enc-dead'),
    ).rejects.toThrow(/enc-dead/);

    // And the note is still where it was — a refused reassignment must not
    // tombstone the edge it declined to replace.
    expect(
      (await entityLinkRepository.getLinksTo('note-1', 'contains')).map((l) => l.fromEntityId),
    ).toEqual(['enc-live']);
  });

  it('refuses a target in a different session', async () => {
    await seedNote('note-1');
    await seedEncounter('enc-other', { session: 'sess-2' });
    await expect(
      entityLinkRepository.reassignNoteToEncounter('note-1', 'enc-other'),
    ).rejects.toThrow(/session mismatch/);
  });

  it('detaches the note when the target is null', async () => {
    await seedNote('note-1');
    await seedEncounter('enc-a');
    await entityLinkRepository.reassignNoteToEncounter('note-1', 'enc-a');
    await entityLinkRepository.reassignNoteToEncounter('note-1', null);
    expect(await entityLinkRepository.getLinksTo('note-1', 'contains')).toEqual([]);
  });

  it('is a no-op when the note already points at the target', async () => {
    await seedNote('note-1');
    await seedEncounter('enc-a');
    await entityLinkRepository.reassignNoteToEncounter('note-1', 'enc-a');
    await entityLinkRepository.reassignNoteToEncounter('note-1', 'enc-a');
    const all = await entityLinkRepository.getLinksTo('note-1', 'contains', { includeDeleted: true });
    expect(all, 'a repeated reassignment churned the edge').toHaveLength(1);
  });
});
