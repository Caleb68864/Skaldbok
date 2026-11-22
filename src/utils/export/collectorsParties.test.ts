import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../storage/db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import { collectCampaignBundle, collectSessionBundle } from './collectors';

/**
 * Both exports carried one party, chosen by `getPartyByCampaign` with no
 * preference: whichever sorted first by id. A campaign with two parties lost
 * one from its backup, with its members, and a session export could carry the
 * party the campaign was not playing. Both cases fail on the old collectors.
 */

const NOW = '2026-01-01T00:00:00.000Z';
const stamp = { schemaVersion: 1, createdAt: NOW, updatedAt: NOW };

beforeEach(async () => {
  await resetDatabase();
  await db.campaigns.put({ ...stamp, id: 'camp', name: 'C', system: 'classic-fantasy', status: 'active', activePartyId: 'party-b' } as never);
  await db.sessions.put({ ...stamp, id: 'sess', campaignId: 'camp', title: 'S', status: 'ended', date: '2026-01-01', startedAt: NOW } as never);
  // 'party-a' sorts first, so the old code picked it although the campaign plays 'party-b'.
  await db.parties.bulkPut([
    { ...stamp, id: 'party-a', campaignId: 'camp', name: 'Old crew' },
    { ...stamp, id: 'party-b', campaignId: 'camp', name: 'The Company' },
  ] as never);
  await db.partyMembers.bulkPut([
    { ...stamp, id: 'm-a', partyId: 'party-a', name: 'Hireling', isActivePlayer: false },
    { ...stamp, id: 'm-b', partyId: 'party-b', name: 'Hilda', isActivePlayer: true },
  ] as never);
});

describe('parties in exports', () => {
  it('a campaign backup carries every live party and its members', async () => {
    const result = await collectCampaignBundle('camp');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.contents.parties ?? []).map((p) => p.id).sort()).toEqual(['party-a', 'party-b']);
    expect((result.contents.partyMembers ?? []).map((m) => m.id).sort()).toEqual(['m-a', 'm-b']);
  });

  it('a session export carries the party the campaign is playing', async () => {
    const result = await collectSessionBundle('sess');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.contents.parties ?? []).map((p) => p.id)).toEqual(['party-b']);
    expect((result.contents.partyMembers ?? []).map((m) => m.id)).toEqual(['m-b']);
  });
});
