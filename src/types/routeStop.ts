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

  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
});

export type RouteStop = z.infer<typeof routeStopSchema>;
