import { db } from '../db/client';
import { partySchema, partyMemberSchema } from '../../types/party';
import type { Party, PartyMember } from '../../types/party';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';

export async function getPartyByCampaign(campaignId: string): Promise<Party | undefined> {
  try {
    const record = await db.parties.where('campaignId').equals(campaignId).first();
    if (!record) return undefined;
    const parsed = partySchema.safeParse(record);
    if (!parsed.success) {
      console.warn('partyRepository.getPartyByCampaign: validation failed', parsed.error);
      return undefined;
    }
    return parsed.data;
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

export async function getPartyMembers(partyId: string): Promise<PartyMember[]> {
  try {
    const records = await db.partyMembers.where('partyId').equals(partyId).toArray();
    return records
      .map(r => {
        const parsed = partyMemberSchema.safeParse(r);
        if (!parsed.success) {
          console.warn('partyRepository.getPartyMembers: validation failed', parsed.error);
          return undefined;
        }
        return parsed.data;
      })
      .filter((m): m is PartyMember => m !== undefined);
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
