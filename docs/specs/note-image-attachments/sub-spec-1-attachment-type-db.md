---
type: phase-spec
master_spec: "docs/specs/2026-03-31-note-image-attachments.md"
sub_spec_number: 1
title: "Attachment Type + DB Migration"
date: 2026-03-30
dependencies: ["none"]
---

# Sub-Spec 1: Attachment Type + DB Migration

Refined from spec.md -- Note Image Attachments.

## Intent

Define the Attachment Zod schema and TypeScript type, then add a Dexie version(4) block that creates the `attachments` table in IndexedDB. This is the foundation layer -- every other sub-spec depends on this type and table existing.

## Scope

1. Create `src/types/attachment.ts` with a Zod schema and inferred type for image attachments.
2. Modify `src/storage/db/client.ts` to declare the `attachments` table on the `SkaldbokDatabase` class and add a `version(4).stores()` block with the required indexes.

The Attachment record stores: id, noteId, campaignId, filename, mimeType, sizeBytes, blob (Blob), caption (optional string), createdAt.

## Interface Contracts

### Provides
- `attachmentSchema`: Zod schema for validating Attachment records
- `Attachment`: TypeScript type inferred from the schema (`z.infer<typeof attachmentSchema>`)
- `db.attachments`: Dexie table with indexes `id, noteId, campaignId, createdAt`

### Requires
None -- no dependencies.

### Shared State
- The `Attachment` type is imported by sub-specs 2, 3, 4, and 5.
- The `db.attachments` table is used directly by sub-spec 2 (repository).

## Acceptance Criteria

| ID | Type | Criterion |
|----|------|-----------|
| AC-1.1 | STRUCTURAL | `src/types/attachment.ts` exports `attachmentSchema` and `Attachment` type with fields: id, noteId, campaignId, filename, mimeType, sizeBytes, blob, caption?, createdAt |
| AC-1.2 | MECHANICAL | `npx tsc --noEmit` passes |
| AC-1.3 | STRUCTURAL | `src/storage/db/client.ts` has `db.version(4).stores()` adding attachments table with indexes `'id, noteId, campaignId, createdAt'` |
| AC-1.4 | BEHAVIORAL | After app loads in browser, IndexedDB inspector shows `attachments` object store |

## Implementation Steps

### Step 1: Create attachment type file

- **File:** `src/types/attachment.ts` (create)
- **Action:** Create new file
- **Pattern:** Follow `src/types/party.ts` -- Zod schema with `z.object()`, then `z.infer` for the type export
- **Changes:**
  ```typescript
  import { z } from 'zod';

  export const attachmentSchema = z.object({
    id: z.string(),
    noteId: z.string(),
    campaignId: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number(),
    blob: z.instanceof(Blob),
    caption: z.string().optional(),
    createdAt: z.string(),
  });

  export type Attachment = z.infer<typeof attachmentSchema>;
  ```

### Step 2: Add attachments table to Dexie database

- **File:** `src/storage/db/client.ts` (modify)
- **Action:** Modify existing file
- **Pattern:** Follow the existing `version(3).stores()` block at line 44-51
- **Changes:**
  1. Add import: `import type { Attachment } from '../../types/attachment';`
  2. Add table declaration inside the class: `attachments!: Table<Attachment, string>;`
  3. Add after the `version(3)` block:
     ```typescript
     this.version(4).stores({
       attachments: 'id, noteId, campaignId, createdAt',
     });
     ```
  Note: Dexie is additive -- version(4) only needs to declare new/changed tables. Existing tables from versions 1-3 are preserved automatically.

### Step 3: Verify TypeScript compilation

- **Run:** `npx tsc --noEmit`
- **Expected:** No errors. The new type and table declaration should be consistent with Dexie's Table generic.

### Step 4: Commit

- **Stage:** `git add src/types/attachment.ts src/storage/db/client.ts`
- **Message:** `feat: attachment type and db migration (v4)`

## Verification Commands

- **Build:** `npx tsc --noEmit`
- **Tests:** No test framework detected -- skip TDD steps, implement directly.
- **Acceptance:**
  - AC-1.1: Inspect `src/types/attachment.ts` -- confirm all fields present with correct Zod types
  - AC-1.2: Run `npx tsc --noEmit` -- zero errors
  - AC-1.3: Inspect `src/storage/db/client.ts` -- confirm `version(4).stores({ attachments: ... })`
  - AC-1.4: Run `npx vite dev`, open browser DevTools > Application > IndexedDB > skaldbok-db -- confirm `attachments` store exists

## Patterns to Follow

- `src/types/party.ts`: Zod schema + inferred type export pattern. Use `z.object()` with `z.infer<typeof schema>`.
- `src/storage/db/client.ts` lines 44-51: Version block pattern. Each version only declares new or changed stores.

## Cross-Cutting Constraints

- Do NOT modify existing version(1), version(2), or version(3) blocks
- The `blob` field uses `z.instanceof(Blob)` -- this validates at runtime but the Blob is stored directly in IndexedDB (Dexie supports Blob storage natively)
- No new npm dependencies

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/types/attachment.ts` | Create | Zod schema and Attachment type definition |
| `src/storage/db/client.ts` | Modify | Add attachments table declaration and version(4) migration |
