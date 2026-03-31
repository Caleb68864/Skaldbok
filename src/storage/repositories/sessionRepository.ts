import { db } from '../db/client';
import { sessionSchema } from '../../types/session';
import type { Session } from '../../types/session';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';

export async function getSessionById(id: string): Promise<Session | undefined> {
  try {
    const record = await db.sessions.get(id);
    if (!record) return undefined;
    const parsed = sessionSchema.safeParse(record);
    if (!parsed.success) {
      console.warn('sessionRepository.getSessionById: validation failed', parsed.error);
      return undefined;
    }
    return parsed.data;
  } catch (e) {
    throw new Error(`sessionRepository.getSessionById failed: ${e}`);
  }
}

export async function getSessionsByCampaign(campaignId: string): Promise<Session[]> {
  try {
    const records = await db.sessions.where('campaignId').equals(campaignId).toArray();
    return records
      .map(r => {
        const parsed = sessionSchema.safeParse(r);
        if (!parsed.success) {
          console.warn('sessionRepository.getSessionsByCampaign: validation failed', parsed.error);
          return undefined;
        }
        return parsed.data;
      })
      .filter((s): s is Session => s !== undefined);
  } catch (e) {
    throw new Error(`sessionRepository.getSessionsByCampaign failed: ${e}`);
  }
}

export async function getActiveSession(campaignId: string): Promise<Session | undefined> {
  try {
    const record = await db.sessions
      .where({ campaignId, status: 'active' })
      .first();
    if (!record) return undefined;
    const parsed = sessionSchema.safeParse(record);
    if (!parsed.success) {
      console.warn('sessionRepository.getActiveSession: validation failed', parsed.error);
      return undefined;
    }
    return parsed.data;
  } catch (e) {
    throw new Error(`sessionRepository.getActiveSession failed: ${e}`);
  }
}

export async function createSession(data: Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<Session> {
  try {
    const now = nowISO();
    const session: Session = {
      ...data,
      id: generateId(),
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.sessions.add(session);
    return session;
  } catch (e) {
    throw new Error(`sessionRepository.createSession failed: ${e}`);
  }
}

export async function updateSession(id: string, data: Partial<Session>): Promise<Session> {
  try {
    const now = nowISO();
    await db.sessions.update(id, { ...data, updatedAt: now });
    const updated = await db.sessions.get(id);
    if (!updated) throw new Error(`sessionRepository.updateSession: session ${id} not found after update`);
    return updated as Session;
  } catch (e) {
    throw new Error(`sessionRepository.updateSession failed: ${e}`);
  }
}
