import { db } from '../db/client';
import { sessionSchema } from '../../types/session';
import type { Session } from '../../types/session';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';

/**
 * Retrieves a single {@link Session} by its unique identifier.
 *
 * @remarks
 * The raw record is validated against {@link sessionSchema} before being
 * returned.  Records that fail validation are treated as absent and a warning
 * is logged to the console.
 *
 * @param id - The unique ID of the session to fetch.
 * @returns The validated session, or `undefined` if it does not exist or fails validation.
 * @throws {Error} If the Dexie query throws an unexpected error.
 *
 * @example
 * ```ts
 * const session = await getSessionById('session-7');
 * if (!session) console.warn('Session not found');
 * ```
 */
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

/**
 * Retrieves all {@link Session} records belonging to a given campaign.
 *
 * @remarks
 * Both active and ended sessions are returned.  Records that fail schema
 * validation are silently excluded and a warning is logged per failure.
 * The caller is responsible for sorting or filtering by `status` if needed.
 *
 * @param campaignId - The ID of the campaign whose sessions should be fetched.
 * @returns An array of validated sessions; may be empty if none exist.
 * @throws {Error} If the Dexie query throws an unexpected error.
 *
 * @example
 * ```ts
 * const sessions = await getSessionsByCampaign('campaign-1');
 * const ended = sessions.filter(s => s.status === 'ended');
 * ```
 */
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

/**
 * Retrieves the currently active {@link Session} for a campaign, if any.
 *
 * @remarks
 * A campaign should only ever have one active session at a time.  If the
 * database is in an inconsistent state with multiple active sessions, only
 * the first one returned by Dexie is used.
 *
 * @param campaignId - The ID of the campaign to query.
 * @returns The active session if one exists and validates, otherwise `undefined`.
 * @throws {Error} If the Dexie query throws an unexpected error.
 *
 * @example
 * ```ts
 * const active = await getActiveSession('campaign-1');
 * if (active) console.log(`In session: ${active.title}`);
 * ```
 */
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

/**
 * Creates a new {@link Session} record in IndexedDB and returns the persisted session.
 *
 * @remarks
 * The `id`, `createdAt`, `updatedAt`, and `schemaVersion` fields are
 * generated automatically and must not be supplied in `data`.
 *
 * @param data - All session fields except the auto-generated ones.
 * @returns The newly created session with all generated fields populated.
 * @throws {Error} If the Dexie insert fails (e.g. duplicate key or storage quota exceeded).
 *
 * @example
 * ```ts
 * const session = await createSession({
 *   campaignId: 'campaign-1',
 *   title: 'Session 8 – The Betrayal',
 *   status: 'active',
 *   date: '2026-03-31',
 *   startedAt: nowISO(),
 * });
 * console.log(session.id); // auto-generated
 * ```
 */
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

/**
 * Applies a partial update to an existing {@link Session} and returns the full
 * updated record.
 *
 * @remarks
 * `updatedAt` is automatically set to the current ISO datetime regardless of
 * whether it is included in `data`.  The full session is re-fetched from the
 * database after the update to guarantee the returned value reflects the
 * persisted state.
 *
 * @param id   - The ID of the session to update.
 * @param data - Partial session fields to merge into the existing record.
 * @returns The updated session as it exists in the database after the write.
 * @throws {Error} If the session cannot be found after the update, or if Dexie throws.
 *
 * @example
 * ```ts
 * const ended = await updateSession(session.id, {
 *   status: 'ended',
 *   endedAt: nowISO(),
 * });
 * ```
 */
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
