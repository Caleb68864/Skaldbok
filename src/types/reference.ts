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

/**
 * Zod schemas for a hand-authored or third-party reference import file.
 *
 * @remarks
 * Separate from the row schemas above because an import bundle is deliberately
 * *partial* — `importBundle` synthesises missing ids, orders, categories and
 * timestamps so a bundle written by hand still imports. What it cannot
 * synthesise is a field of the wrong shape: `rows: "table"` or
 * `items: [{ label: 42 }]` was written straight to IndexedDB, where it stayed,
 * and crashed the screen on every subsequent render. Because the import
 * `bulkPut`s by id, a bad row also overwrites a good one with the same id, so
 * "delete the import and start again" was not a way out either.
 *
 * Every field is optional and every field is type-checked. The `satisfies`
 * clause keeps these honest against the interfaces, the same way the row
 * schemas above are kept honest.
 */
export const referenceImportSectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  category: z.string().optional(),
  groupId: z.string().optional(),
  order: z.number().optional(),
  pg: z.string().optional(),
  type: z.enum(['table', 'key_value_list', 'rules_text']).optional(),
  columns: z.array(z.string()).optional(),
  rows: z.array(z.record(z.string(), z.string())).optional(),
  items: z.array(z.object({ label: z.string(), description: z.string() })).optional(),
  paragraphs: z.array(z.string()).optional(),
  footnote: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}) satisfies z.ZodType<Partial<ReferenceSection>>;

export const referenceImportGroupSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  order: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}) satisfies z.ZodType<Partial<ReferenceGroup>>;

/**
 * A page entry, which supplies the category and ordering for the sections it
 * lists. Both fields are required: a page with no title names no card, and a
 * page with no section list orders nothing.
 */
export const referenceImportPageSchema = z.object({
  title: z.string(),
  sections: z.array(z.string()),
});
