import type { BundleContents, BundleEnvelope } from '../../types/bundle';
import { shareFile, type DeliveryOutcome } from './delivery';
import {
  applyPrivacyFilter,
  privateNoteIdsIn,
  privateResidueIn,
  PrivacyLeakError,
} from './privacyFilter';

/** Metadata and policy for a serialized bundle envelope. */
export interface SerializeOptions {
  /**
   * Whether notes marked `visibility: 'private'` travel in this bundle.
   *
   * @remarks
   * **Required, and deliberately so.** Privacy used to be applied by the caller:
   * each of the three export actions called `applyPrivacyFilter` itself and then
   * called this function. Three call sites is three chances to forget, and a
   * fourth export path would have defaulted to shipping everything with no
   * compiler complaint. Making it a required option on the one function every
   * JSON bundle passes through means a new export path cannot be written that
   * does not answer the question.
   */
  includePrivate: boolean;
  /** Display name recorded in the envelope's `exportedBy` field. */
  exportedBy?: string;
}

/**
 * Serializes bundle contents into a BundleEnvelope JSON string.
 *
 * @remarks
 * Converts attachment Blobs to base64 (if present), computes a SHA-256
 * content hash when the Web Crypto API is available, and wraps everything
 * in a version 1 envelope. The envelope `system` is derived from the exported
 * content (campaign system, else the first character's `systemId`), so a
 * Traveller or Savage Worlds bundle carries its own system id rather than
 * being mislabelled `classic-fantasy`.
 *
 * **This is where privacy happens, for every scope.** The collectors gather; this
 * function decides what leaves. Two steps, and the second is the load-bearing
 * one: {@link applyPrivacyFilter} removes the rows, and then the serialized text
 * — the exact bytes that become the file — is checked for any surviving private
 * note id. A filter that misses a table is a silent leak; a check over the
 * finished artefact cannot miss a table, because it does not know what a table
 * is. If anything survives, {@link PrivacyLeakError} is thrown and nothing is
 * written.
 *
 * @param type - The export scope: character, session, or campaign.
 * @param contents - The collected bundle contents, unfiltered.
 * @param options - Privacy policy (required) plus optional metadata.
 * @returns A pretty-printed JSON string of the complete BundleEnvelope.
 * @throws PrivacyLeakError if a private note is still referenced after filtering.
 */
export async function serializeBundle(
  type: 'character' | 'session' | 'campaign',
  contents: BundleContents,
  options: SerializeOptions
): Promise<string> {
  // Step 0: Apply the confidentiality boundary before anything else touches the
  // rows, so every later step operates on data that is already allowed to leave.
  const privateNoteIds = options.includePrivate
    ? new Set<string>()
    : privateNoteIdsIn(contents);
  const permitted = applyPrivacyFilter(contents, options.includePrivate);

  // Step 1: Convert attachment Blobs to base64
  const processedContents = await convertAttachmentsToBase64(permitted);

  // Step 2: Compute content hash
  const contentsJson = JSON.stringify(processedContents);
  const contentHash = await computeSha256(contentsJson);

  // Step 3: Warn if bundle is large (> 20MB)
  const totalSize = new TextEncoder().encode(contentsJson).length;
  if (totalSize > 20 * 1024 * 1024) {
    console.warn(
      '[bundleSerializer] Bundle size exceeds 20MB:',
      Math.round(totalSize / 1024 / 1024) + 'MB'
    );
  }

  // Step 4: Build envelope. Derive the system id from the content so the bundle
  // is labelled with the ruleset it actually contains, not a hardcoded default.
  const system =
    processedContents.campaign?.system ??
    (processedContents.characters?.[0] as { systemId?: string } | undefined)?.systemId ??
    'classic-fantasy';
  const envelope: BundleEnvelope = {
    version: 1,
    type,
    exportedAt: new Date().toISOString(),
    exportedBy: options.exportedBy,
    system,
    contentHash: contentHash ?? undefined,
    contents: processedContents,
  };

  const json = JSON.stringify(envelope, null, 2);

  // Step 5: The promise, checked over the artefact rather than trusted of the
  // filter. See `privateResidueIn`.
  const residue = privateResidueIn(json, privateNoteIds);
  if (residue.length > 0) throw new PrivacyLeakError(residue);

  return json;
}

/**
 * Delivers a serialized bundle as a downloadable `.skaldbok.json` file.
 *
 * @remarks
 * Returns the outcome rather than `void` so a caller can tell "the file went to
 * the user" from "the user changed their mind". `exportCampaign` is the one
 * caller that must: it stamps `lastBackupAt` on the strength of this, and that
 * is the only thing in the app allowed to claim a campaign is backed up.
 *
 * @param slug - Base name for the file (e.g. "campaign-abc-1234").
 * @param json - The serialized JSON string from {@link serializeBundle}.
 * @returns How the file was delivered, or `'cancelled'` if the user declined.
 */
export async function deliverBundle(slug: string, json: string): Promise<DeliveryOutcome> {
  const filename = `${slug}.skaldbok.json`;
  const blob = new Blob([json], { type: 'application/json' });
  return shareFile(blob, filename);
}

// --- Helpers ---

async function convertAttachmentsToBase64(contents: BundleContents): Promise<BundleContents> {
  if (!contents.attachments || contents.attachments.length === 0) return contents;

  const processedAttachments = await Promise.all(
    contents.attachments.map(async (attachment) => {
      // Check if the attachment has a Blob-like data field that needs conversion.
      // In the bundle schema, blob is omitted and replaced with data/encoding.
      // If the collector passed raw blob data, convert it.
      const blobField = (attachment as Record<string, unknown>).blob;
      if (blobField instanceof Blob) {
        const base64 = await blobToBase64(blobField);
        const { ...rest } = attachment;
        return { ...rest, data: base64, encoding: 'base64' as const };
      }
      return attachment;
    })
  );

  return { ...contents, attachments: processedAttachments };
}

/**
 * Base64 of a Blob's bytes, via `arrayBuffer()` rather than `FileReader` — the
 * former exists everywhere the app runs (and in the test runtime), and skips
 * the data-URL prefix dance. Encoded in chunks so a multi-megabyte image does
 * not spread into one giant `String.fromCharCode` call.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function computeSha256(data: string): Promise<string | null> {
  try {
    const crypto = globalThis.crypto;
    if (!crypto?.subtle) return null;
    const encoded = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null; // Gracefully degrade if Web Crypto unavailable
  }
}
