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

/** Per-id overrides so a test can vary a note's title, body or campaign. */
const noteOverrides = new Map<string, Record<string, unknown>>();

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
    ...(noteOverrides.get(id) ?? {}),
  })),
  getNotesByCampaign: vi.fn(async () => []),
}));

/** A doc whose only content is one `[[label]]` wikilink. */
function linkTo(label: string) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'wikiLink', attrs: { id: null, label } }] }],
  };
}

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

describe('unresolved placeholders', () => {
  beforeEach(async () => {
    const { db } = await import('../../storage/db/client');
    await db.kb_nodes.clear();
    await db.kb_edges.clear();
    noteOverrides.clear();
  });

  it('scopes a placeholder to its campaign', async () => {
    const { syncNote } = await import('./linkSyncEngine');
    const { db } = await import('../../storage/db/client');

    // The same label in two campaigns. The id used to omit campaignId entirely,
    // so both notes shared one row whose campaignId was whichever synced last —
    // one campaign's edges then pointed at a node belonging to the other.
    noteOverrides.set('n-a', { campaignId: 'camp-a', body: linkTo('Ostrand') });
    noteOverrides.set('n-b', { campaignId: 'camp-b', body: linkTo('Ostrand') });
    await syncNote('n-a');
    await syncNote('n-b');

    const stubs = await db.kb_nodes.filter(n => n.type === 'unresolved').toArray();
    const campaigns = stubs.map(n => n.campaignId).sort();
    expect(campaigns).toEqual(['camp-a', 'camp-b']);
    expect(new Set(stubs.map(n => n.id)).size).toBe(2);
  });

  it('keeps labels distinct that a slug would have merged', async () => {
    const { syncNote } = await import('./linkSyncEngine');
    const { db } = await import('../../storage/db/client');

    // 'Sir Aldric' and 'Sir-Aldric' both slugged to `sir-aldric`.
    noteOverrides.set('n-1', { body: linkTo('Sir Aldric') });
    noteOverrides.set('n-2', { body: linkTo('Sir-Aldric') });
    await syncNote('n-1');
    await syncNote('n-2');

    const stubs = await db.kb_nodes.filter(n => n.type === 'unresolved').toArray();
    expect(stubs).toHaveLength(2);
  });

  it('folds a placeholder into the note that later resolves it', async () => {
    const { syncNote } = await import('./linkSyncEngine');
    const { db } = await import('../../storage/db/client');

    // Note A links to a name that does not exist yet.
    noteOverrides.set('n-src', { body: linkTo('Ostrand') });
    await syncNote('n-src');
    expect(await db.kb_nodes.filter(n => n.type === 'unresolved').count()).toBe(1);

    // The note it was waiting for arrives.
    noteOverrides.set('n-target', { title: 'Ostrand', body: { type: 'doc', content: [] } });
    await syncNote('n-target');

    // The stub is gone and the earlier reference now points at the real note.
    expect(await db.kb_nodes.filter(n => n.type === 'unresolved').count()).toBe(0);
    const edges = await db.kb_edges.toArray();
    expect(edges).toHaveLength(1);
    expect(edges[0].fromId).toBe('note-n-src');
    expect(edges[0].toId).toBe('note-n-target');
  });

  it('reaps a placeholder once the last link to it is removed', async () => {
    const { syncNote } = await import('./linkSyncEngine');
    const { db } = await import('../../storage/db/client');

    noteOverrides.set('n-src', { body: linkTo('Ostrand') });
    await syncNote('n-src');
    expect(await db.kb_nodes.filter(n => n.type === 'unresolved').count()).toBe(1);

    // Body edited to drop the link. Placeholders were only ever created, never
    // reaped, so the stub used to survive in the graph forever.
    noteOverrides.set('n-src', { body: { type: 'doc', content: [] } });
    await syncNote('n-src');
    expect(await db.kb_nodes.filter(n => n.type === 'unresolved').count()).toBe(0);
  });

  it('does not duplicate an edge when absorbing', async () => {
    const { syncNote } = await import('./linkSyncEngine');
    const { db } = await import('../../storage/db/client');

    // One note links the same label twice over two syncs, then it resolves.
    noteOverrides.set('n-src', { body: linkTo('Ostrand') });
    await syncNote('n-src');
    noteOverrides.set('n-target', { title: 'Ostrand', body: { type: 'doc', content: [] } });
    await syncNote('n-target');
    await syncNote('n-src');

    const edges = await db.kb_edges.toArray();
    const keys = edges.map(e => `${e.fromId}->${e.toId}:${e.type}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
