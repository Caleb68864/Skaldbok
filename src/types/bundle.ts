import { z } from 'zod';
import { campaignSchema } from './campaign';
import { sessionSchema } from './session';
import { partySchema, partyMemberSchema } from './party';
import { baseNoteSchema } from './note';
import { entityLinkSchema } from './entityLink';
import { attachmentSchema } from './attachment';
import { creatureTemplateSchema } from './creatureTemplate';
import { encounterSchema } from './encounter';
import { inventoryContainerSchema } from './inventoryContainer';
import { shipSchema } from './ship';
import { ledgerEntrySchema } from './ledger';
import { ledgerAccountSchema } from './ledgerAccount';
import { payoutSplitSchema } from './payoutSplit';
import { recurringBillSchema } from './recurringBill';
import { routeStopSchema } from './routeStop';
import { routePlanSchema } from './routePlan';
import { referenceGroupSchema, referenceSectionSchema } from './reference';
import { kbNodeSchema, kbEdgeSchema } from './knowledgeBase';

/**
 * Bundle-safe attachment schema.
 *
 * @remarks
 * The storage `attachmentSchema` contains a `blob: z.instanceof(Blob)` field
 * that cannot survive JSON serialisation. For bundles, the blob is replaced
 * with optional base64-encoded data.
 */
export const attachmentBundleSchema = attachmentSchema
  .omit({ blob: true })
  .extend({
    /** Base64-encoded binary data of the attachment. */
    data: z.string().optional(),
    /** Encoding format for the binary data. */
    encoding: z.literal('base64').optional(),
  });

/**
 * Zod schema for the contents section of a bundle envelope.
 *
 * @remarks
 * All fields are optional — a character bundle will only have `characters`,
 * `notes`, `entityLinks`, and `attachments`, while a campaign bundle has
 * every field populated.
 *
 * `characters` uses `z.record(z.any())` because `CharacterRecord` is a plain
 * TypeScript interface without a Zod schema. Validation of character records
 * within bundles relies on structural compatibility rather than strict Zod parsing.
 *
 * Every key here corresponds to a Dexie table via `types/bundleTables.ts`, and
 * `bundleParity.test.ts` walks `db.tables` against that registry. Ships, the
 * whole ledger (entries, accounts, payout splits, recurring bills), routes, the
 * knowledge-base graph and the reference library were all missing from this
 * object while the settings screen described a campaign export as "the only copy
 * that survives this device" — the parity test exists so that cannot recur when
 * the next table is added.
 */
export const bundleContentsSchema = z.object({
  campaign: campaignSchema.optional(),
  /**
   * The campaign's game system definition.
   *
   * @remarks
   * A user-authored system is stored only in the local `systems` table. Without
   * it, a restored campaign references a ruleset the importing device has never
   * seen. Bundled systems ship with the app and are skipped by the collector.
   *
   * Typed as a loose record for the same reason as `characters`: the strict
   * `systemDefinitionSchema` lives in `schemas/`, outside this module's import
   * graph, and rows are validated against it on import instead.
   */
  systems: z.array(z.record(z.any())).optional(),
  sessions: z.array(sessionSchema).optional(),
  parties: z.array(partySchema).optional(),
  partyMembers: z.array(partyMemberSchema).optional(),
  characters: z.array(z.record(z.any())).optional(),
  creatureTemplates: z.array(creatureTemplateSchema).optional(),
  encounters: z.array(encounterSchema).optional(),
  notes: z.array(baseNoteSchema).optional(),
  entityLinks: z.array(entityLinkSchema).optional(),
  attachments: z.array(attachmentBundleSchema).optional(),
  inventoryContainers: z.array(inventoryContainerSchema).optional(),
  ships: z.array(shipSchema).optional(),
  ledgerAccounts: z.array(ledgerAccountSchema).optional(),
  ledgerEntries: z.array(ledgerEntrySchema).optional(),
  ledgerSplits: z.array(payoutSplitSchema).optional(),
  recurringBills: z.array(recurringBillSchema).optional(),
  routeStops: z.array(routeStopSchema).optional(),
  routePlans: z.array(routePlanSchema).optional(),
  referenceGroups: z.array(referenceGroupSchema).optional(),
  referenceSections: z.array(referenceSectionSchema).optional(),
  kbNodes: z.array(kbNodeSchema).optional(),
  kbEdges: z.array(kbEdgeSchema).optional(),
});

/**
 * Zod schema for the top-level bundle envelope.
 *
 * @remarks
 * Every `.skaldbok.json` file is a `BundleEnvelope`. The `version` field
 * enables forward-compatible migrations on import. The `contentHash` is an
 * optional SHA-256 hex digest of `JSON.stringify(contents)` for integrity
 * verification.
 */
export const bundleEnvelopeSchema = z.object({
  /** Bundle format version — currently always `1`. */
  version: z.literal(1),
  /** Scope of the bundle: what was exported. */
  type: z.enum(['character', 'session', 'campaign']),
  /** ISO datetime when the export was created. */
  exportedAt: z.string(),
  /** Optional name/identifier of who created the export. */
  exportedBy: z.string().optional(),
  /**
   * Game system identifier of the exported data (e.g. `'classic-fantasy'`,
   * `'traveller'`, `'savage-worlds'`, or a user-authored system id).
   *
   * @remarks
   * This was previously pinned to `z.literal('classic-fantasy')`, a leftover
   * from the single-system era that silently rejected every Traveller or
   * Savage Worlds character bundle at import. Systems are pluggable (see the
   * system registry), so this is a free-form id, not a fixed literal.
   */
  system: z.string(),
  /** Optional SHA-256 hex digest of `JSON.stringify(contents)` for integrity verification. */
  contentHash: z.string().optional(),
  /** The actual entity data payload. */
  contents: bundleContentsSchema,
});

/**
 * The contents section of a bundle, inferred from {@link bundleContentsSchema}.
 */
export type BundleContents = z.infer<typeof bundleContentsSchema>;

/**
 * Envelope schema used to **parse** an incoming bundle.
 *
 * @remarks
 * Deliberately permissive about `contents`, unlike {@link bundleEnvelopeSchema},
 * which stays strict because it is the source of the `BundleContents` type.
 * Two problems came from parsing with the strict one:
 *
 * 1. Zod strips keys a schema does not enumerate, so every field outside the
 *    fixed shape was silently discarded before per-entity validation ran. Only
 *    `characters` survived, because it is typed `z.array(z.record(z.any()))` —
 *    which is why a Traveller or Savage Worlds bestiary imported gutted while
 *    characters came through intact.
 * 2. One malformed row failed the whole envelope parse, so the entire bundle was
 *    rejected and `validateContentsEntities`' per-entity
 *    warn-and-skip — the documented design — could never run for those types.
 *
 * Rows are validated individually by `validateContentsEntities`, which is where
 * that check belongs. This schema only asserts the envelope around them.
 */
export const bundleEnvelopeParseSchema = bundleEnvelopeSchema.extend({
  contents: z.record(z.any()),
});

/**
 * A complete bundle envelope, inferred from {@link bundleEnvelopeSchema}.
 */
export type BundleEnvelope = z.infer<typeof bundleEnvelopeSchema>;
