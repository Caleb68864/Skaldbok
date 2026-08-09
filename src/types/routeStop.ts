import { z } from 'zod';

/**
 * One stop on a campaign's jump route.
 *
 * @remarks
 * Fields are declared per-system via `SystemDefinition.routePlanner.fields`
 * and rendered/labelled from that declaration, so this record stores field
 * values generically. `name` is promoted to a real column because every
 * route stop has one and it is the natural sort/display anchor; every other
 * declared field — regardless of its declared `type` — is stored as a string
 * in `values`, keyed by field id. Stops are dense-ordered (`order` starts at
 * 0, no gaps) and reordered inside a single Dexie transaction. Follows the
 * project's soft-delete convention.
 */
export const routeStopSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  name: z.string(),
  /** Dense order, starting at 0. */
  order: z.number().int().nonnegative(),
  /** Values for every other `routePlanner`-declared field, keyed by field id, always stored as strings. */
  values: z.record(z.string(), z.string()).default({}),

  /**
   * Estimated days for the leg *to* this stop. Ignored on the first stop —
   * you do not travel to where you already are.
   */
  estimatedDays: z.number().nonnegative().optional(),
  /**
   * Arrival that actually happened, written in the ruleset's own dating.
   *
   * @remarks
   * Stored as the user typed it rather than as a day number: the calendar is a
   * per-system declaration, and a stored integer would be unreadable if a
   * campaign ever changed ruleset. `utils/route/calendar` parses it on read.
   */
  arrivedOn: z.string().optional(),
  /** Departure that actually happened, same dating as {@link arrivedOn}. */
  departedOn: z.string().optional(),

  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
});

export type RouteStop = z.infer<typeof routeStopSchema>;
