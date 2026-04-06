import type { BundleContents, BundleEnvelope } from '../../types/bundle';
import { shareFile } from './delivery';

export interface SerializeOptions {
  exportedBy?: string;
}

/**
 * Serializes bundle contents into a BundleEnvelope JSON string.
 *
 * @remarks
 * Converts attachment Blobs to base64 (if present), computes a SHA-256
 * content hash when the Web Crypto API is available, and wraps everything
 * in a version 1 envelope with `system: 'dragonbane'`.
 *
 * @param type - The export scope: character, session, or campaign.
 * @param contents - The collected (and optionally privacy-filtered) bundle contents.
 * @param options - Optional metadata (exportedBy name, etc.).
 * @returns A pretty-printed JSON string of the complete BundleEnvelope.
 */
export async function serializeBundle(
  type: 'character' | 'session' | 'campaign',
  contents: BundleContents,
  options: SerializeOptions = {}
): Promise<string> {
  // Step 1: Convert attachment Blobs to base64
  const processedContents = await convertAttachmentsToBase64(contents);

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

  // Step 4: Build envelope
  const envelope: BundleEnvelope = {
    version: 1,
    type,
    exportedAt: new Date().toISOString(),
    exportedBy: options.exportedBy,
    system: 'dragonbane',
    contentHash: contentHash ?? undefined,
    contents: processedContents,
  };

  return JSON.stringify(envelope, null, 2);
}

/**
 * Delivers a serialized bundle as a downloadable `.skaldmark.json` file.
 *
 * @param slug - Base name for the file (e.g. "campaign-abc-1234").
 * @param json - The serialized JSON string from {@link serializeBundle}.
 */
export async function deliverBundle(slug: string, json: string): Promise<void> {
  const filename = `${slug}.skaldmark.json`;
  const blob = new Blob([json], { type: 'application/json' });
  await shareFile(blob, filename);
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

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix (data:...;base64,) — keep only the base64 data
      const base64 = result.split(',')[1] ?? result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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
