import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../storage/db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import { mergeBundle } from './mergeEngine';
import type { BundleContents, BundleEnvelope } from '../../types/bundle';

/**
 * Importing into a chosen campaign kept or cleared `sessionId` by whether the
 * session was in the *bundle*, not whether it would exist after the import.
 * With Sessions unticked, notes pointed at a session that was never written;
 * an encounter whose session was absent had its required `sessionId` cleared
 * and then failed validation on every read; and a note pointing at a session
 * already on the device lost the link because that session was not in the
 * file. All three fail on the old merge.
 */

const NOW = '2026-01-01T00:00:00.000Z';
const stamp = { schemaVersion: 1, createdAt: NOW, updatedAt: NOW };

const note = (id: string, sessionId: string) => ({
  ...stamp, id, campaignId: 'src', sessionId, title: id, type: 'generic', body: null, status: 'active', pinned: false,
});

function bundle(contents: Record<string, unknown>): BundleEnvelope {
  return { version: 1, type: 'session', exportedAt: NOW, system: 'classic-fantasy', contents: contents as BundleContents };
}

beforeEach(async () => {
  await resetDatabase();
});

describe('sessionId when importing into a chosen campaign', () => {
  it('clears a note\'s session when Sessions was not imported', async () => {
    await mergeBundle(
      bundle({
        sessions: [{ ...stamp, id: 'sess-1', campaignId: 'src', title: 'S', status: 'ended', date: '2026-01-01', startedAt: NOW }],
        notes: [note('n1', 'sess-1')],
      }),
      { selectedEntityTypes: new Set(['notes'] as Array<keyof BundleContents>), targetCampaignId: 'target' },
    );
    expect(await db.sessions.get('sess-1')).toBeUndefined();
    expect((await db.notes.get('n1'))?.sessionId).toBeUndefined();
  });

  it('keeps a note\'s session that is already on the device', async () => {
    await db.sessions.put({ ...stamp, id: 'sess-local', campaignId: 'target', title: 'S', status: 'ended', date: '2026-01-01', startedAt: NOW } as never);
    await mergeBundle(
      bundle({ notes: [note('n2', 'sess-local')] }),
      { selectedEntityTypes: new Set(['notes'] as Array<keyof BundleContents>), targetCampaignId: 'target' },
    );
    expect((await db.notes.get('n2'))?.sessionId).toBe('sess-local');
  });

  it('keeps an encounter\'s required sessionId', async () => {
    await mergeBundle(
      bundle({ encounters: [{
        ...stamp, id: 'e1', campaignId: 'src', sessionId: 'sess-gone', title: 'Ambush', type: 'combat',
        status: 'ended', participants: [],
      }] }),
      { selectedEntityTypes: new Set(['encounters'] as Array<keyof BundleContents>), targetCampaignId: 'target' },
    );
    expect((await db.encounters.get('e1'))?.sessionId).toBe('sess-gone');
  });
});
