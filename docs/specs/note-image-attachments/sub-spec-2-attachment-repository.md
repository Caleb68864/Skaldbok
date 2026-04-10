---
type: phase-spec
master_spec: "docs/specs/2026-03-31-note-image-attachments.md"
sub_spec_number: 2
title: "Attachment Repository"
date: 2026-03-30
dependencies: [1]
---

# Sub-Spec 2: Attachment Repository

Refined from spec.md -- Note Image Attachments.

## Intent

Create the data access layer for attachments (CRUD operations) and an image resize/compress utility. The repository follows the exact same patterns as `noteRepository.ts` -- async functions, Zod safeParse on reads, try/catch wrapping, generateId/nowISO for record creation. The image utility uses the Canvas API to resize and compress images before storage.

## Scope

1. Create `src/storage/repositories/attachmentRepository.ts` with full CRUD: create, getByNote, getByCampaign, delete single, delete all by note.
2. Create `src/utils/imageResize.ts` with a `resizeAndCompress` function that uses canvas to resize to max width and compress to JPEG.
3. The `createAttachment` function calls `resizeAndCompress` internally before storing, and generates a filename in the format `{noteId-slug}-{timestamp}.jpg`.

## Interface Contracts

### Provides
- `createAttachment(noteId: string, campaignId: string, file: File): Promise<Attachment>` -- resizes, compresses, stores
- `getAttachmentsByNote(noteId: string): Promise<Attachment[]>` -- returns validated attachments for a note
- `getAttachmentsByCampaign(campaignId: string): Promise<Attachment[]>` -- returns all attachments in a campaign
- `deleteAttachment(id: string): Promise<void>` -- deletes a single attachment
- `deleteAttachmentsByNote(noteId: string): Promise<void>` -- deletes all attachments for a note (used by cascade delete)
- `updateAttachmentCaption(id: string, caption: string): Promise<void>` -- updates caption field
- `resizeAndCompress(file: File, maxWidth: number, quality: number): Promise<Blob>` -- from imageResize.ts

### Requires
- From sub-spec 1: `Attachment` type, `attachmentSchema`, `db.attachments` table

### Shared State
- Sub-spec 3 (hook) calls all repository functions
- Sub-spec 4 (wire-in) calls `deleteAttachmentsByNote` for cascade delete
- Sub-spec 5 (export) calls `getAttachmentsByNote` and `getAttachmentsByCampaign`

## Acceptance Criteria

| ID | Type | Criterion |
|----|------|-----------|
| AC-2.1 | STRUCTURAL | `attachmentRepository` exports: `createAttachment(noteId, campaignId, file)`, `getAttachmentsByNote(noteId)`, `getAttachmentsByCampaign(campaignId)`, `deleteAttachment(id)`, `deleteAttachmentsByNote(noteId)`, `updateAttachmentCaption(id, caption)` |
| AC-2.2 | BEHAVIORAL | `createAttachment` resizes images to max 1920px wide and compresses to JPEG 80% before storing |
| AC-2.3 | MECHANICAL | `createAttachment` generates filename as `{noteId-slug}-{timestamp}.jpg` |
| AC-2.4 | STRUCTURAL | `imageResize.ts` exports `resizeAndCompress(file: File, maxWidth: number, quality: number): Promise<Blob>` using canvas API |
| AC-2.5 | BEHAVIORAL | On `QuotaExceededError`, shows toast "Storage full" instead of throwing |

## Implementation Steps

### Step 1: Create imageResize utility

- **File:** `src/utils/imageResize.ts` (create)
- **Action:** Create new file
- **Pattern:** Standalone utility function, similar in style to `src/utils/ids.ts` and `src/utils/dates.ts` (pure exported functions)
- **Changes:**
  ```typescript
  export async function resizeAndCompress(
    file: File,
    maxWidth: number = 1920,
    quality: number = 0.8
  ): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return await canvas.convertToBlob({ type: 'image/jpeg', quality });
  }
  ```
  - Uses `createImageBitmap` (works in web workers and main thread)
  - Uses `OffscreenCanvas` for headless rendering
  - Returns JPEG Blob at specified quality

### Step 2: Create attachment repository

- **File:** `src/storage/repositories/attachmentRepository.ts` (create)
- **Action:** Create new file
- **Pattern:** Follow `src/storage/repositories/noteRepository.ts` exactly -- same import structure, try/catch, Zod safeParse on reads
- **Changes:**
  ```typescript
  import { db } from '../db/client';
  import { attachmentSchema } from '../../types/attachment';
  import type { Attachment } from '../../types/attachment';
  import { generateId } from '../../utils/ids';
  import { nowISO } from '../../utils/dates';
  import { resizeAndCompress } from '../../utils/imageResize';
  ```

  Key implementation details:

  1. **`createAttachment(noteId, campaignId, file)`:**
     - Call `resizeAndCompress(file, 1920, 0.8)` to get compressed Blob
     - Generate filename: `${noteId.slice(0, 8)}-${Date.now()}.jpg`
     - Build Attachment record with `generateId()`, `nowISO()` for createdAt
     - `sizeBytes` = compressed blob.size
     - `mimeType` = 'image/jpeg' (always JPEG after compression)
     - Wrap `db.attachments.add(record)` in try/catch
     - On `QuotaExceededError` (check `e.name === 'QuotaExceededError'`), throw a tagged error that the hook layer can catch

  2. **`getAttachmentsByNote(noteId)`:**
     - `db.attachments.where('noteId').equals(noteId).toArray()`
     - Map through `attachmentSchema.safeParse()`, filter valid records
     - Sort by `createdAt` ascending

  3. **`getAttachmentsByCampaign(campaignId)`:**
     - Same pattern with `campaignId` index

  4. **`deleteAttachment(id)`:**
     - `db.attachments.delete(id)`

  5. **`deleteAttachmentsByNote(noteId)`:**
     - `db.attachments.where('noteId').equals(noteId).delete()`

  6. **`updateAttachmentCaption(id, caption)`:**
     - `db.attachments.update(id, { caption })`

### Step 3: Verify TypeScript compilation

- **Run:** `npx tsc --noEmit`
- **Expected:** No errors

### Step 4: Commit

- **Stage:** `git add src/utils/imageResize.ts src/storage/repositories/attachmentRepository.ts`
- **Message:** `feat: attachment repository and image resize utility`

## Verification Commands

- **Build:** `npx tsc --noEmit`
- **Tests:** No test framework detected -- skip TDD steps, implement directly.
- **Acceptance:**
  - AC-2.1: Inspect exports of `attachmentRepository.ts` -- confirm all 6 functions
  - AC-2.2: Read `createAttachment` -- confirm it calls `resizeAndCompress(file, 1920, 0.8)`
  - AC-2.3: Read filename generation -- confirm `${noteId.slice(0, 8)}-${Date.now()}.jpg` pattern
  - AC-2.4: Inspect `imageResize.ts` -- confirm function signature and canvas usage
  - AC-2.5: Read catch block in `createAttachment` -- confirm `QuotaExceededError` handling

## Patterns to Follow

- `src/storage/repositories/noteRepository.ts`: Repository CRUD pattern -- try/catch wrapping, Zod safeParse on reads, `generateId()` + `nowISO()` for record creation, console.warn on validation failures
- `src/utils/ids.ts`: Simple exported utility function pattern
- `src/utils/dates.ts`: Same -- single exported function

## Cross-Cutting Constraints

- Do NOT add npm dependencies (canvas resize is native browser API)
- `resizeAndCompress` must handle the case where `createImageBitmap` rejects (corrupt/unreadable image) -- let the error propagate to the caller for toast handling
- Always compress to JPEG regardless of input format (PNG, HEIC, etc.)
- The repository does NOT own toast display -- it throws errors that the hook layer catches and toasts

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/imageResize.ts` | Create | Canvas-based image resize and JPEG compression utility |
| `src/storage/repositories/attachmentRepository.ts` | Create | CRUD operations for the attachments Dexie table |
