import { z } from 'zod';
import { bundleContentsSchema } from '../../types/bundle';
import type { BundleContents, BundleEnvelope } from '../../types/bundle';
import { BUNDLE_ENTITY_LABELS } from '../../types/bundleTables';

/**
 * Unwraps a bundle-contents field schema down to the object schema describing a
 * single row, or `null` where the field is a loose record with no declared shape.
 *
 * @remarks
 * `characters` and `systems` are `z.record(z.any())` deliberately (see
 * `types/bundle.ts`), so they have no introspectable `campaignId` — which is
 * also the truth about them: both are device-global tables, not campaign-scoped
 * ones. Returning `null` for them is the correct answer, not a gap.
 */
function rowSchemaOf(field: z.ZodTypeAny): z.ZodObject<z.ZodRawShape> | null {
  let schema: z.ZodTypeAny = field;
  while (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    schema = schema.unwrap() as z.ZodTypeAny;
  }
  if (schema instanceof z.ZodArray) {
    schema = schema.element as z.ZodTypeAny;
    while (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
      schema = schema.unwrap() as z.ZodTypeAny;
    }
  }
  return schema instanceof z.ZodObject ? (schema as z.ZodObject<z.ZodRawShape>) : null;
}

/**
 * Bundle-contents keys whose rows carry a `campaignId` and therefore need a
 * campaign to belong to.
 *
 * @remarks
 * Derived from `bundleContentsSchema` rather than written out, for the same
 * reason `types/bundleTables.ts` exists: a hand-maintained copy of "which
 * entities are campaign-scoped" is one more list to forget when a table is
 * added, and the consequence here is an import that either demands a campaign
 * it does not need or writes rows pointing at a campaign that is not there.
 *
 * `importCampaignTarget.test.ts` pins the derived set against an explicit
 * expectation, so a Zod upgrade that breaks introspection fails loudly instead
 * of quietly yielding an empty set (which would read as "nothing needs a
 * campaign" and let orphaned rows through).
 *
 * The three notable absences are all facts about the schema, not omissions:
 * `characters` and `systems` are device-global; `partyMembers` reach their
 * campaign through `partyId`; `entityLinks` are endpoint-scoped and are
 * dropped by the merge engine when an endpoint is missing; and the reference
 * library (`referenceGroups`/`referenceSections`/`referenceNotes`) is
 * device-wide.
 */
export const CAMPAIGN_SCOPED_BUNDLE_KEYS: ReadonlySet<string> = new Set(
  Object.entries(bundleContentsSchema.shape)
    .filter(([, field]) => {
      const row = rowSchemaOf(field as z.ZodTypeAny);
      return row !== null && 'campaignId' in row.shape;
    })
    .map(([key]) => key),
);

/**
 * What an import needs in the way of a campaign, given a bundle and the entity
 * groups the user has selected.
 */
export type ImportCampaignTarget =
  /**
   * The bundle carries its own campaign and the user is importing it. The
   * campaign is restored under its own id and everything else is parented onto
   * it — the user is never asked to invent a campaign to restore one into.
   */
  | { kind: 'bundled'; campaignId: string; campaignName: string }
  /**
   * Nothing selected is campaign-scoped, so no campaign is involved at all.
   * A character bundle with no notes lands here: `characters` is a global
   * table, so a character can be restored onto an empty device.
   */
  | { kind: 'not-required' }
  /**
   * Campaign-scoped rows were selected with no campaign to put them in. The
   * user has a real choice to make — an existing campaign, or dropping those
   * groups — so this asks rather than inventing one.
   */
  | { kind: 'required'; groupLabels: string[] };

/** Whether a bundle-contents group holds at least one row. */
function hasRows(contents: BundleContents, key: string): boolean {
  const value = (contents as Record<string, unknown>)[key];
  if (!value) return false;
  return Array.isArray(value) ? value.length > 0 : true;
}

/**
 * Decides what campaign, if any, an import must be given.
 *
 * @remarks
 * This replaces branching on `bundle.type`, which was wrong in both directions.
 * A `character` bundle was made to demand a target campaign even though
 * `CharacterRecord` has no `campaignId` at all — characters join a campaign
 * through `partyMembers`, so the character itself needs nothing. And on a fresh
 * install there were no campaigns to offer, which made restoring a backup
 * impossible until the user had invented a campaign first: the recovery path
 * gated on the thing being recovered.
 *
 * The question is answered from the data instead: does anything the user chose
 * to import carry a `campaignId`, and does the bundle bring a campaign of its
 * own to satisfy it?
 *
 * @param bundle - The parsed bundle.
 * @param selectedEntityTypes - Entity-group keys the user has ticked.
 * @returns The campaign requirement for this import.
 */
export function resolveImportCampaignTarget(
  bundle: BundleEnvelope,
  selectedEntityTypes: Iterable<string>,
): ImportCampaignTarget {
  const selected = new Set(selectedEntityTypes);
  const { contents } = bundle;

  // The bundle brings its own campaign and the user is keeping it: restore in
  // place, under the campaign's original id. Re-importing the same file updates
  // that campaign rather than creating a second one.
  if (selected.has('campaign') && contents.campaign?.id) {
    return {
      kind: 'bundled',
      campaignId: contents.campaign.id,
      campaignName: contents.campaign.name,
    };
  }

  const needsHome = [...selected].filter(
    (key) => CAMPAIGN_SCOPED_BUNDLE_KEYS.has(key) && hasRows(contents, key),
  );
  if (needsHome.length === 0) return { kind: 'not-required' };

  return {
    kind: 'required',
    groupLabels: needsHome.map((key) => BUNDLE_ENTITY_LABELS[key] ?? key),
  };
}
