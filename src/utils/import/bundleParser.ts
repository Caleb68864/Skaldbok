import {
  bundleEnvelopeSchema,
  type BundleEnvelope,
  type BundleContents,
} from '../../types/bundle';
import { creatureTemplateSchema } from '../../types/creatureTemplate';
import { encounterSchema } from '../../types/encounter';
import { baseNoteSchema } from '../../types/note';
import { sessionSchema } from '../../types/session';
import { campaignSchema } from '../../types/campaign';
import { partySchema, partyMemberSchema } from '../../types/party';
import { entityLinkSchema } from '../../types/entityLink';

/**
 * A single per-entity validation warning produced during bundle parsing.
 */
export interface ValidationWarning {
  entityType: string;
  entityIndex: number;
  path: string;
  message: string;
}

/**
 * Result of parsing a bundle file.
 */
export type ParsedBundleResult =
  | { success: true; bundle: BundleEnvelope; warnings: ValidationWarning[] }
  | { success: false; error: string; partialBundle?: Partial<BundleEnvelope> };

/**
 * Parses and validates a `.skaldbok.json` (or legacy `.skaldmark.json`) file.
 *
 * @remarks
 * This function is **synchronous**. Content hash verification is async and
 * must be done separately via {@link verifyContentHash}.
 *
 * - Invalid JSON returns a failure result.
 * - `version > 1` returns a failure with an upgrade prompt.
 * - Legacy `.skaldbok.json` files (bare CharacterRecord, no `version` field)
 *   are detected and wrapped in a v1 character envelope.
 * - Per-entity Zod failures produce warnings; the failing entity is skipped
 *   but other valid entities are retained.
 * - All Zod validation uses `safeParse()` — never `.parse()`.
 *
 * @param json - The raw JSON string from the imported file.
 * @returns A typed result with the parsed bundle and any validation warnings.
 */
export function parseBundle(json: string): ParsedBundleResult {
  // 1. Parse raw JSON
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { success: false, error: 'Invalid JSON: file could not be parsed.' };
  }

  if (typeof raw !== 'object' || raw === null) {
    return { success: false, error: 'Invalid format: expected a JSON object.' };
  }

  const obj = raw as Record<string, unknown>;

  // 2. Detect legacy .skaldbok.json (bare CharacterRecord — no version field)
  if (!('version' in obj)) {
    return handleLegacySkaldbok(obj);
  }

  // 3. Version checks
  const version = obj['version'];
  if (typeof version !== 'number') {
    return { success: false, error: 'Invalid bundle: version field is not a number.' };
  }
  if (version > 1) {
    return {
      success: false,
      error: 'Unsupported bundle version. Please upgrade Skaldmark to import this file.',
    };
  }
  if (version < 1) {
    // Apply migration transforms for pre-v1 bundles
    const migrated = migratePreV1Bundle(obj);
    return parseBundle(JSON.stringify(migrated));
  }

  // 4. Validate envelope structure
  const envelopeResult = bundleEnvelopeSchema.safeParse(obj);

  if (!envelopeResult.success) {
    return {
      success: false,
      error: `Bundle structure invalid: ${envelopeResult.error.issues[0]?.message ?? 'unknown error'}`,
      partialBundle: obj as Partial<BundleEnvelope>,
    };
  }

  const bundle = envelopeResult.data;
  const warnings: ValidationWarning[] = [];

  // 5. Per-entity validation with warnings (not hard failures)
  const validatedContents = validateContentsEntities(bundle.contents, warnings);
  // Reassign validated contents (with invalid entities stripped)
  (bundle as { contents: BundleContents }).contents = validatedContents;

  return { success: true, bundle, warnings };
}

/**
 * Handles a legacy `.skaldbok.json` file by wrapping it in a v1 character envelope.
 */
function handleLegacySkaldbok(obj: Record<string, unknown>): ParsedBundleResult {
  const warnings: ValidationWarning[] = [];

  // Legacy format is a bare CharacterRecord — no Zod schema exists for it,
  // so we do a minimal structural check (must have 'id' and 'name').
  if (!obj.id || !obj.name) {
    warnings.push({
      entityType: 'character',
      entityIndex: 0,
      path: 'id|name',
      message: 'Legacy character record missing id or name field',
    });
  }

  const wrappedBundle: BundleEnvelope = {
    version: 1,
    type: 'character',
    exportedAt: new Date().toISOString(),
    system: 'dragonbane',
    contents: {
      characters: [obj],
    },
  };

  return { success: true, bundle: wrappedBundle, warnings };
}

/**
 * Validates individual entities within bundle contents using per-type Zod schemas.
 * Invalid entities are removed and warnings are emitted.
 */
function validateContentsEntities(
  contents: BundleContents,
  warnings: ValidationWarning[]
): BundleContents {
  const validated = { ...contents };

  // Helper to validate an array of entities against a schema
  function validateArray<T>(
    items: T[] | undefined,
    entityType: string,
    schema: { safeParse: (input: unknown) => { success: boolean; error?: { issues: Array<{ path: Array<string | number>; message: string }> } } }
  ): T[] | undefined {
    if (!items) return undefined;
    return items.filter((item, index) => {
      const result = schema.safeParse(item);
      if (!result.success) {
        warnings.push({
          entityType,
          entityIndex: index,
          path: result.error?.issues[0]?.path.join('.') ?? '',
          message: result.error?.issues[0]?.message ?? 'Validation failed',
        });
        return false;
      }
      return true;
    });
  }

  validated.creatureTemplates = validateArray(contents.creatureTemplates, 'creatureTemplates', creatureTemplateSchema);
  validated.encounters = validateArray(contents.encounters, 'encounters', encounterSchema);
  validated.notes = validateArray(contents.notes, 'notes', baseNoteSchema);
  validated.sessions = validateArray(contents.sessions, 'sessions', sessionSchema);
  validated.parties = validateArray(contents.parties, 'parties', partySchema);
  validated.partyMembers = validateArray(contents.partyMembers, 'partyMembers', partyMemberSchema);
  validated.entityLinks = validateArray(contents.entityLinks, 'entityLinks', entityLinkSchema);

  // Campaign is a single object, not an array
  if (contents.campaign) {
    const result = campaignSchema.safeParse(contents.campaign);
    if (!result.success) {
      warnings.push({
        entityType: 'campaign',
        entityIndex: 0,
        path: result.error?.issues[0]?.path.join('.') ?? '',
        message: result.error?.issues[0]?.message ?? 'Validation failed',
      });
      validated.campaign = undefined;
    }
  }

  // characters — no Zod schema exists (plain TypeScript interface);
  // skip strict validation but ensure they have required fields
  if (contents.characters) {
    validated.characters = contents.characters.filter((char, index) => {
      const c = char as Record<string, unknown>;
      if (!c.id || !c.name) {
        warnings.push({
          entityType: 'characters',
          entityIndex: index,
          path: 'id|name',
          message: 'Character record missing id or name field',
        });
        return false;
      }
      return true;
    });
  }

  // attachments — validated via bundleContentsSchema already (omit re-validation)

  return validated;
}

/**
 * Applies migration transforms for pre-v1 bundles.
 * Currently no known pre-v1 format exists — returns input with version set to 1.
 */
function migratePreV1Bundle(obj: Record<string, unknown>): Record<string, unknown> {
  return { ...obj, version: 1 };
}

/**
 * Verifies the content hash of a parsed bundle asynchronously.
 *
 * @remarks
 * Uses the Web Crypto API to compute SHA-256. Returns `true` if the hash
 * matches or if no hash is present. Returns `true` (does not block) if
 * Web Crypto is unavailable.
 *
 * @param bundle - The parsed bundle envelope to verify.
 * @returns `true` if the hash matches or cannot be verified; `false` on mismatch.
 */
export async function verifyContentHash(bundle: BundleEnvelope): Promise<boolean> {
  if (!bundle.contentHash) return true;
  try {
    const crypto = globalThis.crypto;
    if (!crypto?.subtle) return true;
    const contentsJson = JSON.stringify(bundle.contents);
    const encoded = new TextEncoder().encode(contentsJson);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computed = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return computed === bundle.contentHash;
  } catch {
    return true; // Cannot verify — do not block import
  }
}
