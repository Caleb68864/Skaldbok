import { z } from 'zod';
import { campaignSchema } from './campaign';
import { sessionSchema } from './session';
import { partySchema, partyMemberSchema } from './party';
import { baseNoteSchema } from './note';
import { entityLinkSchema } from './entityLink';
import { attachmentSchema } from './attachment';
import { creatureTemplateSchema } from './creatureTemplate';
import { encounterSchema } from './encounter';

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
 */
export const bundleContentsSchema = z.object({
  campaign: campaignSchema.optional(),
  sessions: z.array(sessionSchema).optional(),
  parties: z.array(partySchema).optional(),
  partyMembers: z.array(partyMemberSchema).optional(),
  characters: z.array(z.record(z.any())).optional(),
  creatureTemplates: z.array(creatureTemplateSchema).optional(),
  encounters: z.array(encounterSchema).optional(),
  notes: z.array(baseNoteSchema).optional(),
  entityLinks: z.array(entityLinkSchema).optional(),
  attachments: z.array(attachmentBundleSchema).optional(),
});

/**
 * Zod schema for the top-level bundle envelope.
 *
 * @remarks
 * Every `.skaldmark.json` file is a `BundleEnvelope`. The `version` field
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
  /** Game system identifier — always `'dragonbane'` for Skaldmark. */
  system: z.literal('dragonbane'),
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
 * A complete bundle envelope, inferred from {@link bundleEnvelopeSchema}.
 */
export type BundleEnvelope = z.infer<typeof bundleEnvelopeSchema>;
