import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import { appendEntriesToNote } from './noteRepository';
import * as routeRepository from './routeRepository';
import type { Note } from '../../types/note';

const NOW = '2026-01-01T00:00:00.000Z';
const note = (id: string) => ({
  id, campaignId: 'c', title: id, body: null, type: 'generic', status: 'active', pinned: false, schemaVersion: 1, createdAt: NOW, updatedAt: NOW,
});

beforeEach(async () => {
  await resetDatabase();
});

describe('promoting an entry twice (roadmap G3)', () => {
  it('leaves one live promoted_into edge', async () => {
    await db.notes.bulkPut([note('entry'), note('target')] as never);
    const entry = (await db.notes.get('entry')) as Note;
    const doc = { type: 'doc', content: [] };

    await appendEntriesToNote([entry], 'target', () => doc as never);
    await appendEntriesToNote([entry], 'target', () => doc as never);

    const edges = await db.entityLinks.where('fromEntityId').equals('entry').toArray();
    expect(edges.filter(e => e.relationshipType === 'promoted_into')).toHaveLength(1);
  });
});

describe('routeRepository.restore on a live stop (roadmap G8)', () => {
  it('does nothing, rather than moving it to the end of the route', async () => {
    const stamp = { campaignId: 'c', schemaVersion: 1, createdAt: NOW, updatedAt: NOW };
    await db.routeStops.bulkPut([{ ...stamp, id: 'a', name: 'A', order: 0 }, { ...stamp, id: 'b', name: 'B', order: 1 }] as never);

    await routeRepository.restore('a');

    expect((await db.routeStops.get('a'))?.order).toBe(0);
  });
});
