import { z } from 'zod';

/**
 * Lifecycle status of a game session.
 *
 * - `'active'`  — the session is currently in progress.
 * - `'ended'`   — the session has been concluded and is read-only.
 */
export type SessionStatus = 'active' | 'ended';

/**
 * Zod schema used for runtime validation of session records read from IndexedDB.
 *
 * @remarks
 * `date` is an ISO calendar date string (e.g. `"2026-03-31"`) that represents
 * the in-world or real-world date on which the session took place.
 * `startedAt` and `endedAt` are full ISO datetime strings with timezone offset.
 *
 * @example
 * ```ts
 * const result = sessionSchema.safeParse(rawRecord);
 * if (!result.success) console.warn(result.error);
 * ```
 */
export const sessionSchema = z.object({
  /** Unique identifier for the session. */
  id: z.string(),
  /** ID of the campaign this session belongs to. */
  campaignId: z.string(),
  /** Display title of the session, e.g. "Session 7 – The Dragon's Lair". */
  title: z.string(),
  /** Current lifecycle status. */
  status: z.enum(['active', 'ended']),
  /** ISO calendar date the session took place, e.g. `"2026-03-31"`. */
  date: z.string(),
  /** ISO datetime when the session timer was started. */
  startedAt: z.string(),
  /** ISO datetime when the session was ended; absent while still active. */
  endedAt: z.string().optional(),
  /** Schema version for forward-compatibility migrations. */
  schemaVersion: z.number(),
  /** ISO datetime when this record was first created. */
  createdAt: z.string(),
  /** ISO datetime of the most recent update to this record. */
  updatedAt: z.string(),
  /** ISO datetime when this record was soft-deleted; absent while active. */
  deletedAt: z.string().optional(),
  /** Transaction UUID identifying the cascade that soft-deleted this record. */
  softDeletedBy: z.string().optional(),
});

/**
 * A game session record inferred from {@link sessionSchema}.
 *
 * @remarks
 * Use {@link sessionSchema} to validate raw data before casting to this type.
 */
export type Session = z.infer<typeof sessionSchema>;
