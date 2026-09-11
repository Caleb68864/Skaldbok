import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../db/client';
import { getPartyByCampaign } from './partyRepository';
import { nowISO } from '../../utils/dates';

/**
 * `campaignSchema.activePartyId` is written by three UI flows and was read by none.
 *
 * @remarks
 * Campaign creation (`CampaignCreateModal`), the Manage Party drawer and
 * "add a character from the library" all persist it through
 * `campaignRepository.updateCampaign`. The app then resolved the active party by
 * *querying* — `db.parties.where('campaignId')`, first non-deleted row — so in
 * the one situation where the field carries information, more than one live
 * party, the user's recorded choice was the thing being ignored.
 *
 * Two live parties for one campaign are reachable without an import: the app's
 * three creation flows are each guarded by "only if none exists", but restoring
 * a party from Trash after a replacement was lazily created leaves two, and so
 * does merging a bundle from another device. The invariant is a convention, not
 * an index.
 *
 * The counter-example is one line above it in the same schema:
 * `campaign.activeCharacterMemberId` is the same shape and has been read all
 * along, in four places. `activePartyId` is the sibling that never was.
 *
 * Every case here fails against the previous `getPartyByCampaign`, which took no
 * preference and returned `records[0]`.
 */

const now = nowISO();

async function seedParty(id: string, campaignId: string, over: Record<string, unknown> = {}) {
  await db.parties.add({
    id,
    campaignId,
    name: `${id} party`,
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    ...over,
  } as never);
}

beforeEach(async () => {
  await db.parties.clear();
});

describe('getPartyByCampaign honours the campaign’s recorded party', () => {
  it('returns the preferred party rather than the one the scan would pick', async () => {
    // The ids matter and are adversarial on purpose. The first version of this
    // seeded `party-old` then `party-chosen` and preferred `party-chosen` —
    // and it was **a test that could not fail**: Dexie returns an index scan in
    // primary-key order, not insertion order, and `party-chosen` sorts before
    // `party-old`, so the unpreferred scan already produced the expected answer.
    // Deleting the preference left it green. Measured, not reasoned about.
    //
    // So the preferred id sorts *last*: `party-zzz` is the row the old code
    // could never have returned while `party-aaa` exists.
    await seedParty('party-aaa', 'camp-1');
    await seedParty('party-zzz', 'camp-1');

    const party = await getPartyByCampaign('camp-1', { preferPartyId: 'party-zzz' });
    expect(party?.id).toBe('party-zzz');
  });

  it('falls back to the scan’s own answer when no preference is given', async () => {
    // The unchanged behaviour, pinned so the fallback cannot quietly become
    // "some other row" — and pinned with the same two ids as the case above, so
    // the pair together prove the preference is what moved the answer.
    await seedParty('party-aaa', 'camp-1');
    await seedParty('party-zzz', 'camp-1');

    expect((await getPartyByCampaign('camp-1'))?.id).toBe('party-aaa');
  });

  it('falls back rather than returning nothing when the pointer is stale', async () => {
    // A campaign whose `activePartyId` names a party that has since been deleted
    // must not end up with no party at all. Preference, not requirement.
    await seedParty('party-live', 'camp-1');

    expect((await getPartyByCampaign('camp-1', { preferPartyId: 'party-gone' }))?.id)
      .toBe('party-live');
  });

  it('never returns a soft-deleted party even when it is the preferred one', async () => {
    // The preference is applied *after* the soft-delete filter, not before it —
    // otherwise restoring the replacement would hand back the tombstone.
    await seedParty('party-deleted', 'camp-1', { deletedAt: now, softDeletedBy: 'tx-1' });
    await seedParty('party-live', 'camp-1');

    const party = await getPartyByCampaign('camp-1', { preferPartyId: 'party-deleted' });
    expect(party?.id).toBe('party-live');
  });

  it('never returns another campaign’s party, whatever the pointer says', async () => {
    await seedParty('party-elsewhere', 'camp-2');
    await seedParty('party-here', 'camp-1');

    const party = await getPartyByCampaign('camp-1', { preferPartyId: 'party-elsewhere' });
    expect(party?.id).toBe('party-here');
  });

  it('returns undefined when the campaign has no party', async () => {
    expect(await getPartyByCampaign('camp-1', { preferPartyId: 'party-x' })).toBeUndefined();
  });

  it('can still surface a deleted party when the caller opts in', async () => {
    await seedParty('party-deleted', 'camp-1', { deletedAt: now, softDeletedBy: 'tx-1' });

    const party = await getPartyByCampaign('camp-1', {
      includeDeleted: true,
      preferPartyId: 'party-deleted',
    });
    expect(party?.id).toBe('party-deleted');
  });
});
