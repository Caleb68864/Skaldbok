import { z } from 'zod';

/**
 * A node in the per-campaign knowledge-base graph.
 *
 * @remarks
 * Derived content: nodes are projected from notes and their mentions, not
 * authored directly. `sourceId` points back at the entity a node was materialised
 * from; `scope` distinguishes campaign-local nodes from shared ones.
 *
 * The schema lives here rather than beside the Dexie table because bundles must
 * validate KB rows on import the same way every other entity type is validated,
 * and `types/` cannot import `storage/db/client` without a cycle. `client.ts`
 * re-exports the inferred types, so existing importers are unaffected.
 */
export const kbNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['note', 'character', 'location', 'item', 'tag', 'unresolved']),
  label: z.string(),
  scope: z.enum(['campaign', 'shared']),
  campaignId: z.string(),
  sourceId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** A node in the per-campaign knowledge-base graph. */
export type KBNode = z.infer<typeof kbNodeSchema>;

/**
 * A directed edge in the knowledge-base graph, linking two {@link KBNode}s.
 *
 * @remarks
 * Distinct from the domain `entityLinks` table: KB edges model the derived
 * wiki-link/mention/descriptor graph rendered in the KB view, whereas
 * `entityLinks` express authored domain relationships.
 */
export const kbEdgeSchema = z.object({
  id: z.string(),
  fromId: z.string(),
  toId: z.string(),
  type: z.enum(['wikilink', 'mention', 'descriptor']),
  campaignId: z.string(),
  createdAt: z.string(),
});

/** A directed edge in the knowledge-base graph. */
export type KBEdge = z.infer<typeof kbEdgeSchema>;
