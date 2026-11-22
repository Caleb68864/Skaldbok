import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../storage/db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import { mergeBundle } from './mergeEngine';
import type { BundleContents, BundleEnvelope } from '../../types/bundle';

/**
 * Importing a bundle into a campaign that already has a party used to add the
 * bundle's party beside it, as a second live party nobody could see: the
 * campaign shows only its active party. Decided by agent 2026-11-21 (owner may
 * revisit): fold the members into the campaign's party, non-destructively. The
 * first case fails on the old merge.
 */

const NOW = '2026-01-01T00:00:00.000Z';
const stamp = { schemaVersion: 1, createdAt: NOW, updatedAt: NOW };
const ALL = new Set(['parties', 'partyMembers'] as Array<keyof BundleContents>);

function bundle(): BundleEnvelope {
  return {
    version: 1, type: 'session', exportedAt: NOW, system: 'classic-fantasy',
    contents: {
      parties: [{ ...stamp, id: 'bp', campaignId: 'other', name: 'Exported party' }],
      partyMembers: [
        { ...stamp, id: 'm-dup', partyId: 'bp', linkedCharacterId: 'c1', isActivePlayer: true },
        { ...stamp, id: 'm-new', partyId: 'bp', linkedCharacterId: 'c2', isActivePlayer: true },
        { ...stamp, id: 'm-npc', partyId: 'bp', name: 'Hireling', isActivePlayer: false },
      ],
    } as unknown as BundleContents,
  };
}

beforeEach(async () => {
  await resetDatabase();
});

describe('a bundle party imported into a campaign with a party', () => {
  beforeEach(async () => {
    await db.campaigns.put({ ...stamp, id: 'target', name: 'T', system: 'classic-fantasy', status: 'active', activePartyId: 'tp' } as never);
    await db.parties.put({ ...stamp, id: 'tp', campaignId: 'target', name: 'The Company' } as never);
    await db.partyMembers.put({ ...stamp, id: 'm-local', partyId: 'tp', linkedCharacterId: 'c1', isActivePlayer: true } as never);
  });

  it("joins the campaign's party instead of becoming a second one", async () => {
    const report = await mergeBundle(bundle(), { selectedEntityTypes: ALL, targetCampaignId: 'target' });

    expect(report.errors).toEqual([]);
    expect(await db.parties.get('bp')).toBeUndefined();
    const seats = await db.partyMembers.where('partyId').equals('tp').toArray();
    expect(seats.map((m) => m.id).sort()).toEqual(['m-local', 'm-new', 'm-npc']);
    // c1 was already seated: no second seat, and the local one is untouched.
    expect(await db.partyMembers.get('m-dup')).toBeUndefined();
    expect((await db.partyMembers.get('m-local'))?.updatedAt).toBe(NOW);
  });

  it('merges as before when the bundle party is already on the device', async () => {
    await db.parties.put({ ...stamp, id: 'bp', campaignId: 'target', name: 'Exported party' } as never);
    await mergeBundle(bundle(), { selectedEntityTypes: ALL, targetCampaignId: 'target' });
    expect((await db.partyMembers.get('m-new'))?.partyId).toBe('bp');
  });
});

describe('a bundle party imported into a campaign with no party', () => {
  it('becomes the campaign\'s party, as before', async () => {
    await db.campaigns.put({ ...stamp, id: 'target', name: 'T', system: 'classic-fantasy', status: 'active' } as never);
    await mergeBundle(bundle(), { selectedEntityTypes: ALL, targetCampaignId: 'target' });
    expect((await db.parties.get('bp'))?.campaignId).toBe('target');
    expect((await db.partyMembers.get('m-dup'))?.partyId).toBe('bp');
  });
});
