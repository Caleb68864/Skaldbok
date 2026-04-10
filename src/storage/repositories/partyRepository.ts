import { db } from '../db/client';
import { partySchema, partyMemberSchema } from '../../types/party';
import type { Party, PartyMember } from '../../types/party';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { excludeDeleted, generateSoftDeleteTxId } from '../../utils/softDelete';

export async function getPartyByCampaign(campaignId: string, options?: { includeDeleted?: boolean }): Promise<Party | undefined> {
  try {
    const records = await db.parties.where('campaignId').equals(campaignId).toArray();
    for (const record of records) {
      const parsed = partySchema.safeParse(record);
      if (!parsed.success) {
        console.warn('partyRepository.getPartyByCampaign: validation failed', parsed.error);
        continue;
      }
      if (!options?.includeDeleted && parsed.data.deletedAt) continue;
      return parsed.data;
    }
    return undefined;
  } catch (e) {
    throw new Error(`partyRepository.getPartyByCampaign failed: ${e}`);
  }
}

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
    throw new Error(`partyRepository.createParty failed: ${e}`);
  }
}

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
    throw new Error(`partyRepository.getPartyMembers failed: ${e}`);
  }
}

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
    throw new Error(`partyRepository.addPartyMember failed: ${e}`);
  }
}

export async function removePartyMember(memberId: string): Promise<void> {
  try {
    await db.partyMembers.delete(memberId);
  } catch (e) {
    throw new Error(`partyRepository.removePartyMember failed: ${e}`);
  }
}

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
    throw new Error(`partyRepository.softDelete failed: ${e}`);
  }
}

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
    throw new Error(`partyRepository.restore failed: ${e}`);
  }
}

export async function hardDelete(id: string): Promise<void> {
  try {
    await db.parties.delete(id);
  } catch (e) {
    throw new Error(`partyRepository.hardDelete failed: ${e}`);
  }
}

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
    throw new Error(`partyRepository.softDeletePartyMember failed: ${e}`);
  }
}

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
    throw new Error(`partyRepository.restorePartyMember failed: ${e}`);
  }
}
