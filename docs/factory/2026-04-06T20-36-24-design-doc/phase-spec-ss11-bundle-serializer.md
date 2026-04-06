# Phase Spec — SS-11: Bundle Serializer + Delivery

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 2.3 — Feature B: Bundle Serializer + Delivery
**Depends on:** SS-02 (bundle.ts Zod schema), SS-09 (collectors), SS-10 (privacy filter) must be completed first.
**Delivery order note:** Step 11 in execution sequence.

---

## Objective

Wrap collected + filtered bundle contents into a `BundleEnvelope`, compute an optional SHA-256 `contentHash` using the Web Crypto API, convert attachment Blobs to base64, and deliver the file via existing delivery utilities. Output file extension must be `.skaldmark.json`.

---

## Files to Create

- `src/utils/export/bundleSerializer.ts` — **create new**

## Files to Inspect (Do NOT Create)

- `src/utils/export/delivery.ts` — read existing delivery function signatures before writing

---

## Implementation Steps

### Step 1: Inspect existing delivery utility

Read `src/utils/export/delivery.ts` to find:
- The exact function name(s) for file download/share (likely `shareFile`, `downloadFile`, or similar)
- What parameters it accepts (filename, content type, data)
- Whether it expects a `Blob`, `string`, or `File`
- Any existing usage patterns

### Step 2: Implement `src/utils/export/bundleSerializer.ts`

```typescript
import { BundleContents, BundleEnvelope } from '../../types/bundle';
import { deliverFile } from './delivery'; // adjust to actual function name

export interface SerializeOptions {
  includePrivate?: boolean;
  exportedBy?: string;
}

/**
 * Serializes bundle contents into a BundleEnvelope JSON string.
 * Converts attachment Blobs to base64 if present.
 * Computes SHA-256 contentHash when Web Crypto API is available.
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

  // Step 3: Warn if attachment size is large (> 20MB total)
  const totalSize = new TextEncoder().encode(contentsJson).length;
  if (totalSize > 20 * 1024 * 1024) {
    console.warn('[bundleSerializer] Bundle size exceeds 20MB:', Math.round(totalSize / 1024 / 1024) + 'MB');
    // Toast warning if a toast utility is available — import from existing toast utility
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
 * Delivers a serialized bundle JSON string as a downloadable file.
 * File naming: {slug}.skaldmark.json
 */
export async function deliverBundle(slug: string, json: string): Promise<void> {
  const filename = `${slug}.skaldmark.json`;
  // Delegate to existing delivery utility
  await deliverFile(filename, json, 'application/json'); // adjust signature to match delivery.ts
}

// --- Helpers ---

async function convertAttachmentsToBase64(contents: BundleContents): Promise<BundleContents> {
  if (!contents.attachments || contents.attachments.length === 0) return contents;

  const processedAttachments = await Promise.all(
    contents.attachments.map(async (attachment) => {
      // If the attachment has a Blob field (inspect actual attachmentMetaSchema for field name)
      const blob = (attachment as any).blob ?? (attachment as any).data;
      if (blob instanceof Blob) {
        const base64 = await blobToBase64(blob);
        return { ...attachment, blob: undefined, data: base64, encoding: 'base64' };
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
    const crypto = globalThis.crypto ?? (globalThis as any).msCrypto;
    if (!crypto?.subtle) return null;
    const encoded = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null; // Gracefully degrade if Web Crypto unavailable
  }
}
```

### Step 3: Adjust delivery call to match actual `delivery.ts` API

After inspecting `delivery.ts`, adjust the `deliverBundle` function's call to `deliverFile` / `shareFile` / `downloadFile` to match the exact signature. Do not invent a new delivery API.

### Step 4: Inspect attachment schema

Before finalizing `convertAttachmentsToBase64`, read the actual `attachmentMetaSchema` definition to find which field holds the Blob/binary data. Adjust the field names in the converter accordingly.

---

## Verification Commands

```bash
npx tsc --noEmit
npm run build
```

**Manual verification:**
- Export a character bundle — a `.skaldmark.json` file is downloaded/shared.
- Open the downloaded file — it is valid JSON with structure: `{ version: 1, type: 'character', system: 'dragonbane', contentHash: '...', contents: { ... } }`.
- `bundleEnvelopeSchema.safeParse(JSON.parse(fileContents))` returns `{ success: true }`.
- If attachments are present, the base64 field is a string (not `[object Object]`).
- Check DevTools console — no errors about attachment conversion.
- Bundle > 20MB: a console warning (and optional toast) appears.

---

## Acceptance Criteria

- [ ] Output JSON parses as valid `BundleEnvelope` (`version: 1`, `system: 'dragonbane'`)
- [ ] `contentHash` field is present and matches SHA-256 of `JSON.stringify(contents)` when Web Crypto API is available
- [ ] When Web Crypto API is unavailable, `contentHash` is absent — no error thrown
- [ ] Attachment Blobs are converted to base64 strings in output (not raw Blob objects)
- [ ] File delivered via existing `shareFile`/download pattern from `utils/export/delivery.ts`
- [ ] File extension is `.skaldmark.json`
- [ ] Attachment size warning logged (and optionally toasted) when total bundle exceeds 20MB
- [ ] `npx tsc --noEmit` passes with no errors

---

## Constraints

- No new npm dependencies — use Web Crypto API (`globalThis.crypto.subtle`) for SHA-256
- Use existing delivery utility (`delivery.ts`) — do not create a new file download mechanism
- Gracefully degrade if Web Crypto is unavailable (no error — just omit `contentHash`)
- `serializeBundle` and `deliverBundle` must be separate functions (as specified)
- Do not toast inside `serializeBundle` if no toast utility is importable without coupling — log to console instead; toast can be handled by the caller hook in SS-15
