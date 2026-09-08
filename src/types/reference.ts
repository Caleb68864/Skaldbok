import { z } from 'zod';

export type ReferenceSectionType = 'table' | 'key_value_list' | 'rules_text';

export interface ReferenceSection {
  id: string;
  title: string;
  /**
   * Display name of the owning group, kept as a fallback for a section whose
   * group row has gone. `groupId` is the authoritative join — see v14.
   */
  category: string;
  /** Id of the owning {@link ReferenceGroup}. */
  groupId?: string;
  /** ISO timestamp set when soft-deleted. */
  deletedAt?: string;
  /** Transaction id shared by every row deleted in one cascade. */
  softDeletedBy?: string;
  order: number;
  pg?: string;
  type: ReferenceSectionType;
  columns?: string[];
  rows?: Record<string, string>[];
  items?: { label: string; description: string }[];
  paragraphs?: string[];
  footnote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceGroup {
  id: string;
  title: string;
  order: number;
  /** ISO timestamp set when soft-deleted. */
  deletedAt?: string;
  /** Transaction id shared by every row deleted in one cascade. */
  softDeletedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Zod schemas for the reference library rows.
 *
 * @remarks
 * The interfaces above stay the declaration of record — they predate these and
 * are what the repositories are written against. The schemas exist because the
 * reference library now travels in campaign bundles, and every entity type in a
 * bundle is validated row-by-row on import (`validateContentsEntities`). The
 * `satisfies` clause is what keeps the two honest: widen the interface without
 * widening the schema and this file stops compiling, rather than silently
 * dropping the new field out of every export.
 *
 * `passthrough()` on the section rows preserves the free-form `rows` payload
 * shape a user-authored table can carry.
 */
export const referenceGroupSchema = z.object({
  id: z.string(),
  title: z.string(),
  order: z.number(),
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodType<ReferenceGroup>;

export const referenceSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  groupId: z.string().optional(),
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
  order: z.number(),
  pg: z.string().optional(),
  type: z.enum(['table', 'key_value_list', 'rules_text']),
  columns: z.array(z.string()).optional(),
  rows: z.array(z.record(z.string(), z.string())).optional(),
  items: z.array(z.object({ label: z.string(), description: z.string() })).optional(),
  paragraphs: z.array(z.string()).optional(),
  footnote: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodType<ReferenceSection>;

export interface ReferenceImportBundle {
  referenceSections?: Partial<ReferenceSection>[];
  referencePages?: Array<{ title: string; sections: string[] }>;
  referenceGroups?: Partial<ReferenceGroup>[];
}
