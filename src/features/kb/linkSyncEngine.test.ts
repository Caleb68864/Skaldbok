import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

/**
 * Concurrency guard for `syncNote`.
 *
 * @remarks
 * Every caller fires this and forgets it — `noteRepository` kicks it off with
 * `.then().catch(() => {})` from create, update and append — so two edits
 * landing close together ran two syncs over the same node at once. Each read the
 * existing edge set before either wrote, both concluded the same edges were
 * missing, and both inserted them: duplicate edges, and a backlink counted
 * twice.
 *
 * The note is mocked rather than seeded through the repository because what is
 * under test is the *ordering*, not the graph maths — the assertion is that two
 * overlapping calls never interleave their read-then-write.
 */

const noteBody = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'wikiLink', attrs: { id: null, label: 'Ostrand' } }] }],
};

vi.mock('../../storage/repositories/noteRepository', () => ({
  getNoteById: vi.fn(async (id: string) => ({
    id,
    campaignId: 'camp-1',
    title: 'Test note',
    type: 'generic',
    body: noteBody,
    tags: [],
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })),
  getNotesByCampaign: vi.fn(async () => []),
}));

describe('syncNote concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serialises concurrent syncs of the same note', async () => {
    const { syncNote } = await import('./linkSyncEngine');
    const { db } = await import('../../storage/db/client');

    await Promise.all([syncNote('note-1'), syncNote('note-1'), syncNote('note-1')]);

    const edges = await db.kb_edges.toArray();
    const seen = new Set<string>();
    for (const edge of edges) {
      const key = `${edge.fromId}->${edge.toId}:${edge.type}`;
      expect(seen.has(key), `duplicate edge ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('does not serialise unrelated notes against each other', async () => {
    const { syncNote } = await import('./linkSyncEngine');
    // Two different ids must both complete; a global lock would still pass this,
    // but a deadlock or a dropped queue entry would not.
    await expect(Promise.all([syncNote('note-a'), syncNote('note-b')])).resolves.toBeDefined();
  });

  it('a later sync still runs after an earlier one rejects', async () => {
    const { syncNote } = await import('./linkSyncEngine');
    const repo = await import('../../storage/repositories/noteRepository');
    const spy = vi.mocked(repo.getNoteById);
    const callsBefore = spy.mock.calls.length;
    spy.mockRejectedValueOnce(new Error('transient'));

    // The chain links onto `previous.catch(...)`, so a failure must not poison
    // the queue for the next caller.
    await Promise.all([syncNote('note-c'), syncNote('note-c')]);
    expect(spy.mock.calls.length).toBeGreaterThan(callsBefore + 1);
  });
});
