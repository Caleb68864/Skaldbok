// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../storage/db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import * as metadataRepository from '../../storage/repositories/metadataRepository';
import { bulkRebuildGraph, KB_GRAPH_BUILT_KEY } from './linkSyncEngine';
import { getNotesByCampaign } from '../../storage/repositories/noteRepository';
import { nowISO } from '../../utils/dates';

/**
 * A rebuild reports what it actually did.
 *
 * @remarks
 * `metadataSingleRow.test.ts` covers the marker being written through the
 * repository. This covers the half that made the original defect invisible:
 * **`bulkRebuildGraph` wrapped its whole body in a `catch` that logged and
 * returned**, so every failure inside it — the marker write included — resolved
 * as success.
 *
 * That is the same shape as a test that cannot fail, in production code. The
 * `ConstraintError` from the old `put({ id: key, … })` was swallowed there; had
 * the swallow not existed, the very first rebuild would have thrown and the
 * defect would have been a visible error rather than a silent full rebuild on
 * every mount. Fixing the write without fixing the catch leaves the next failure
 * — a quota exhaustion, a blocked upgrade, a corrupt row — to disappear exactly
 * the same way.
 *
 * Two consequences the callers already assume and did not get:
 *
 * - `KnowledgeBaseScreen` has a `catch` around the rebuild it could never enter.
 * - `useImportActions` shows *"Imported, but the knowledge graph could not be
 *   rebuilt"* from a `catch` the scan recorded as unreachable, because
 *   `bulkRebuildGraph` never rejected.
 *
 * Each probe asserts that its injection was reached before asserting anything
 * about the outcome — an inert spy and a kept rule produce identical output — and
 * the last test is the control that must keep passing: the same rebuild, with
 * nothing injected, resolves and records the marker.
 */

async function seedNote(id: string) {
  const now = nowISO();
  await db.notes.add({
    id,
    campaignId: 'camp-1',
    sessionId: 'sess-1',
    // Not `log`: log entries are skipped by the sync entirely, so a log note
    // would give a rebuild with nothing to do and prove nothing.
    type: 'generic',
    title: `note ${id}`,
    body: null,
    status: 'active',
    pinned: false,
    tags: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  } as never);
}

/**
 * Asserts the seeded note is visible to the rebuild's own reader.
 *
 * @remarks
 * The first draft of this fixture omitted `status` and `pinned`, so
 * `baseNoteSchema` rejected it, `getNotesByCampaign` filtered it out and the
 * rebuild had nothing to sync. Every probe below would have measured an empty
 * campaign. The control caught it; this makes the check explicit instead.
 */
async function expectNoteReachesTheRebuild(id: string) {
  const notes = await getNotesByCampaign('camp-1');
  expect(
    notes.map(n => n.id),
    'the fixture never reached the subject: the rebuild reads no such note',
  ).toContain(id);
}

describe('bulkRebuildGraph reports its outcome', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not resolve as success when the completion marker cannot be written', async () => {
    await seedNote('n-1');
    await expectNoteReachesTheRebuild('n-1');
    await metadataRepository.set(KB_GRAPH_BUILT_KEY, 'false');
    // Fixture sanity: a marker that was never seeded would leave the final
    // assertion comparing `undefined` to `undefined` and passing for the wrong
    // reason.
    expect(await metadataRepository.get(KB_GRAPH_BUILT_KEY)).toBe('false');

    const update = vi
      .spyOn(db.metadata, 'update')
      .mockRejectedValue(new Error('probe: metadata write refused'));

    await expect(bulkRebuildGraph('camp-1')).rejects.toThrow(/metadata write refused/);

    expect(update, 'the injection was never reached — the spy is inert').toHaveBeenCalled();
    expect(
      await db.kb_nodes.get('note-n-1'),
      'the rebuild never got as far as syncing a note, so it did not reach the marker either',
    ).toBeDefined();
    expect(
      await metadataRepository.get(KB_GRAPH_BUILT_KEY),
      'the marker kept its old value, which is exactly the state the caller must be told about',
    ).toBe('false');
  });

  it('does not record the graph as built when a note failed to sync', async () => {
    await seedNote('n-1');
    await expectNoteReachesTheRebuild('n-1');
    const put = vi
      .spyOn(db.kb_nodes, 'put')
      .mockRejectedValue(new Error('probe: node write refused'));

    await expect(bulkRebuildGraph('camp-1')).rejects.toThrow(/n-1/);

    expect(put, 'the injection was never reached — the spy is inert').toHaveBeenCalled();
    expect(
      await metadataRepository.get(KB_GRAPH_BUILT_KEY),
      'no node was written and the marker says the graph is built',
    ).toBeUndefined();
  });

  it('records the graph as built when the rebuild succeeds', async () => {
    // The control. It passes before and after the fix, so a failure in either
    // probe above is the injection and not the fixture.
    await seedNote('n-1');
    await expectNoteReachesTheRebuild('n-1');

    await expect(bulkRebuildGraph('camp-1')).resolves.toBeUndefined();

    expect(await db.kb_nodes.get('note-n-1')).toBeDefined();
    expect(await metadataRepository.get(KB_GRAPH_BUILT_KEY)).toBe('true');
  });
});
