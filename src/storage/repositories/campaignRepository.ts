import { db } from '../db/client';
import { campaignSchema } from '../../types/campaign';
import type { Campaign } from '../../types/campaign';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';

export async function getCampaignById(id: string): Promise<Campaign | undefined> {
  try {
    const record = await db.campaigns.get(id);
    if (!record) return undefined;
    const parsed = campaignSchema.safeParse(record);
    if (!parsed.success) {
      console.warn('campaignRepository.getCampaignById: validation failed', parsed.error);
      return undefined;
    }
    return parsed.data;
  } catch (e) {
    throw new Error(`campaignRepository.getCampaignById failed: ${e}`);
  }
}

export async function getAllCampaigns(): Promise<Campaign[]> {
  try {
    const records = await db.campaigns.toArray();
    return records
      .map(r => {
        const parsed = campaignSchema.safeParse(r);
        if (!parsed.success) {
          console.warn('campaignRepository.getAllCampaigns: validation failed', parsed.error);
          return undefined;
        }
        return parsed.data;
      })
      .filter((c): c is Campaign => c !== undefined);
  } catch (e) {
    throw new Error(`campaignRepository.getAllCampaigns failed: ${e}`);
  }
}

export async function createCampaign(data: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<Campaign> {
  try {
    const now = nowISO();
    const campaign: Campaign = {
      ...data,
      id: generateId(),
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.campaigns.add(campaign);
    return campaign;
  } catch (e) {
    throw new Error(`campaignRepository.createCampaign failed: ${e}`);
  }
}

export async function updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign> {
  try {
    const now = nowISO();
    await db.campaigns.update(id, { ...data, updatedAt: now });
    const updated = await db.campaigns.get(id);
    if (!updated) throw new Error(`campaignRepository.updateCampaign: campaign ${id} not found after update`);
    return updated as Campaign;
  } catch (e) {
    throw new Error(`campaignRepository.updateCampaign failed: ${e}`);
  }
}
