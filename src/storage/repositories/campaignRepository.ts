import { db } from '../db/client';
import { campaignSchema } from '../../types/campaign';
import type { Campaign } from '../../types/campaign';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { excludeDeleted, generateSoftDeleteTxId } from '../../utils/softDelete';

export async function getCampaignById(id: string, options?: { includeDeleted?: boolean }): Promise<Campaign | undefined> {
  try {
    const record = await db.campaigns.get(id);
    if (!record) return undefined;
    const parsed = campaignSchema.safeParse(record);
    if (!parsed.success) {
      console.warn('campaignRepository.getCampaignById: validation failed', parsed.error);
      return undefined;
    }
    if (!options?.includeDeleted && parsed.data.deletedAt) return undefined;
    return parsed.data;
  } catch (e) {
    throw new Error(`campaignRepository.getCampaignById failed: ${e}`);
  }
}

export async function getAllCampaigns(options?: { includeDeleted?: boolean }): Promise<Campaign[]> {
  try {
    const records = await db.campaigns.toArray();
    const parsed = records
      .map(r => {
        const result = campaignSchema.safeParse(r);
        if (!result.success) {
          console.warn('campaignRepository.getAllCampaigns: validation failed', result.error);
          return undefined;
        }
        return result.data;
      })
      .filter((c): c is Campaign => c !== undefined);
    return options?.includeDeleted ? parsed : excludeDeleted(parsed);
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

export async function softDelete(id: string, txId?: string): Promise<void> {
  try {
    const row = await db.campaigns.get(id);
    if (!row) return;
    if ((row as Campaign).deletedAt) return;
    const finalTxId = txId ?? generateSoftDeleteTxId();
    const now = nowISO();
    await db.campaigns.update(id, {
      deletedAt: now,
      softDeletedBy: finalTxId,
      updatedAt: now,
    });
  } catch (e) {
    throw new Error(`campaignRepository.softDelete failed: ${e}`);
  }
}

export async function restore(id: string): Promise<void> {
  try {
    const row = await db.campaigns.get(id);
    if (!row) return;
    if (!(row as Campaign).deletedAt) return;
    await db.campaigns.update(id, {
      deletedAt: undefined,
      softDeletedBy: undefined,
      updatedAt: nowISO(),
    });
  } catch (e) {
    throw new Error(`campaignRepository.restore failed: ${e}`);
  }
}

export async function hardDelete(id: string): Promise<void> {
  try {
    await db.campaigns.delete(id);
  } catch (e) {
    throw new Error(`campaignRepository.hardDelete failed: ${e}`);
  }
}
