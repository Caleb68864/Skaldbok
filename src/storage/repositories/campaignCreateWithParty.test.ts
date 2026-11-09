// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import { createCampaignWithParty, getAllCampaigns, getCampaignById } from './campaignRepository';

/**
 * `createCampaignWithParty` — the campaign, its default party and the
 * `activePartyId` pointer are one write.
 *
 * @remarks
 * `CampaignCreateModal` used to make these as three separate writes, so a
 * failure after the first left a campaign with no party. The import dialog now
 * creates campaigns too, on the fresh-install recovery path, which is the worst
 * place to leave half a campaign behind.
 */
beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createCampaignWithParty', () => {
  it('creates the campaign with its party seated as the active party', async () => {
    const campaign = await createCampaignWithParty({ name: 'Spinward', system: 'traveller', status: 'active' });

    const stored = await getCampaignById(campaign.id);
    expect(stored?.name).toBe('Spinward');
    expect(stored?.system).toBe('traveller');
    expect(stored?.activePartyId).toBeTruthy();
    expect(stored?.activePartyId).toBe(campaign.activePartyId);

    const party = await db.parties.get(campaign.activePartyId!);
    expect(party?.campaignId).toBe(campaign.id);
    expect(party?.name).toBe('Spinward Party');
  });

  it('leaves nothing behind when the party write fails', async () => {
    vi.spyOn(db.parties, 'add').mockRejectedValueOnce(new Error('QuotaExceededError'));

    await expect(
      createCampaignWithParty({ name: 'Spinward', system: 'traveller', status: 'active' }),
    ).rejects.toThrow(/createCampaignWithParty failed/);

    expect(await getAllCampaigns()).toEqual([]);
    expect(await db.parties.count()).toBe(0);
  });
});
