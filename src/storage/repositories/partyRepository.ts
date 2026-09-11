import { db } from '../db/client';
import { partySchema, partyMemberSchema } from '../../types/party';
import type { Party, PartyMember } from '../../types/party';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { excludeDeleted, generateSoftDeleteTxId, onlyDeleted } from '../../utils/softDelete';

/**
 * The party for a campaign, if one exists.
 *
 * @remarks
 * A campaign is *meant* to have at most one party, and every flow that makes one
 * creates it only when none exists. Two live parties are still reachable —
 * restore a party from Trash after a replacement was lazily created, or import a
 * bundle from another device — and the invariant is a convention, not an index.
 *
 * `preferPartyId` is what `campaignSchema.activePartyId` is for. That field was
 * written by **three real UI flows** (campaign creation, the Manage Party drawer,
 * and adding a character from the library) and read by nobody: this function
 * returned whichever row Dexie handed back first, so in the one case where the
 * field carries information — more than one live party — the user's recorded
 * choice was the thing being ignored. `campaign.activeCharacterMemberId`, one
 * line above it in the same schema and the same shape, has been read all along;
 * this is the sibling that never was.
 *
 * Preference, not requirement: an `activePartyId` naming a deleted or foreign
 * row falls through to the scan, so a stale pointer degrades to the old
 * behaviour rather than leaving the campaign with no party at all.
 *
 * Rows that fail validation are skipped with a warning.
 */
export async function getPartyByCampaign(
  campaignId: string,
  options?: { includeDeleted?: boolean; preferPartyId?: string },
): Promise<Party | undefined> {
  try {
    const records = await db.parties.where('campaignId').equals(campaignId).toArray();
    const usable: Party[] = [];
    for (const record of records) {
      const parsed = partySchema.safeParse(record);
      if (!parsed.success) {
        console.warn('partyRepository.getPartyByCampaign: validation failed', parsed.error);
        continue;
      }
      if (!options?.includeDeleted && parsed.data.deletedAt) continue;
      usable.push(parsed.data);
    }
    if (options?.preferPartyId) {
      const chosen = usable.find(party => party.id === options.preferPartyId);
      if (chosen) return chosen;
    }
    return usable[0];
  } catch (e) {
    throw new Error(`partyRepository.getPartyByCampaign failed: ${e}`, { cause: e });
  }
}

/** Creates a party, generating its id, timestamps, and schema version. */
export async function createParty(data: Omit<Party, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<Party> {
  try {
    const now = nowISO();
    const party: Party = {
      ...data,
      id: generateId(),
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.parties.add(party);
    return party;
  } catch (e) {
    throw new Error(`partyRepository.createParty failed: ${e}`, { cause: e });
  }
}

/** The members of a party, excluding soft-deleted rows unless opted in; invalid rows are dropped with a warning. */
export async function getPartyMembers(partyId: string, options?: { includeDeleted?: boolean }): Promise<PartyMember[]> {
  try {
    const records = await db.partyMembers.where('partyId').equals(partyId).toArray();
    const parsed = records
      .map(r => {
        const result = partyMemberSchema.safeParse(r);
        if (!result.success) {
          console.warn('partyRepository.getPartyMembers: validation failed', result.error);
          return undefined;
        }
        return result.data;
      })
      .filter((m): m is PartyMember => m !== undefined);
    return options?.includeDeleted ? parsed : excludeDeleted(parsed);
  } catch (e) {
    throw new Error(`partyRepository.getPartyMembers failed: ${e}`, { cause: e });
  }
}

/** Adds a member to a party, generating its id, timestamps, and schema version. */
export async function addPartyMember(data: Omit<PartyMember, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<PartyMember> {
  try {
    const now = nowISO();
    const member: PartyMember = {
      ...data,
      id: generateId(),
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.partyMembers.add(member);
    return member;
  } catch (e) {
    throw new Error(`partyRepository.addPartyMember failed: ${e}`, { cause: e });
  }
}

/**
 * Hard-removes a party member row.
 *
 * @remarks
 * Predates the soft-delete convention; {@link softDeletePartyMember} is the
 * reversible path. This is retained for callers that intend a permanent removal.
 */
export async function removePartyMember(memberId: string): Promise<void> {
  try {
    await db.partyMembers.delete(memberId);
  } catch (e) {
    throw new Error(`partyRepository.removePartyMember failed: ${e}`, { cause: e });
  }
}

/** Soft-deletes a party. Enlist in a cascade via `txId`. No-op if missing or already deleted. */
export async function softDelete(id: string, txId?: string): Promise<void> {
  try {
    const row = await db.parties.get(id);
    if (!row) return;
    if ((row as Party).deletedAt) return;
    const finalTxId = txId ?? generateSoftDeleteTxId();
    const now = nowISO();
    await db.parties.update(id, {
      deletedAt: now,
      softDeletedBy: finalTxId,
      updatedAt: now,
    });
  } catch (e) {
    throw new Error(`partyRepository.softDelete failed: ${e}`, { cause: e });
  }
}

/** Restores a soft-deleted party. No-op if missing or already live. */
export async function restore(id: string): Promise<void> {
  try {
    const row = await db.parties.get(id);
    if (!row) return;
    if (!(row as Party).deletedAt) return;
    await db.parties.update(id, {
      deletedAt: undefined,
      softDeletedBy: undefined,
      updatedAt: nowISO(),
    });
  } catch (e) {
    throw new Error(`partyRepository.restore failed: ${e}`, { cause: e });
  }
}

/** Permanently removes a party row. Internal only — never called from UI, which soft-deletes. */
export async function hardDelete(id: string): Promise<void> {
  try {
    await db.parties.delete(id);
  } catch (e) {
    throw new Error(`partyRepository.hardDelete failed: ${e}`, { cause: e });
  }
}

/** Soft-deletes one party member (reversible). Enlist in a cascade via `txId`. No-op if missing or already deleted. */
export async function softDeletePartyMember(memberId: string, txId?: string): Promise<void> {
  try {
    const row = await db.partyMembers.get(memberId);
    if (!row) return;
    if ((row as PartyMember).deletedAt) return;
    const finalTxId = txId ?? generateSoftDeleteTxId();
    const now = nowISO();
    await db.partyMembers.update(memberId, {
      deletedAt: now,
      softDeletedBy: finalTxId,
      updatedAt: now,
    });
  } catch (e) {
    throw new Error(`partyRepository.softDeletePartyMember failed: ${e}`, { cause: e });
  }
}

/**
 * Every soft-deleted member of a campaign's party, newest deletion first.
 *
 * @remarks
 * `PartyMember` carries a `partyId`, not a `campaignId`, so the campaign scope
 * has to come through the party — and through the *deleted-inclusive* lookup,
 * because a party that was itself soft-deleted still owns the members the user
 * is looking for. Returns nothing when the campaign has no party at all.
 *
 * Removing a member from the party drawer has always been a soft delete; there
 * was simply nothing that listed the result, so the seat was unrecoverable in
 * practice.
 *
 * @param campaignId - Campaign whose trash is being listed.
 */
export async function getDeletedMembers(campaignId: string): Promise<PartyMember[]> {
  try {
    const party = await getPartyByCampaign(campaignId, { includeDeleted: true });
    if (!party) return [];
    const rows = await db.partyMembers.where('partyId').equals(party.id).toArray();
    return onlyDeleted(rows as PartyMember[]);
  } catch (e) {
    throw new Error(`partyRepository.getDeletedMembers failed: ${e}`, { cause: e });
  }
}

/** Restores a soft-deleted party member. No-op if missing or already live. */
export async function restorePartyMember(memberId: string): Promise<void> {
  try {
    const row = await db.partyMembers.get(memberId);
    if (!row) return;
    if (!(row as PartyMember).deletedAt) return;
    await db.partyMembers.update(memberId, {
      deletedAt: undefined,
      softDeletedBy: undefined,
      updatedAt: nowISO(),
    });
  } catch (e) {
    throw new Error(`partyRepository.restorePartyMember failed: ${e}`, { cause: e });
  }
}
