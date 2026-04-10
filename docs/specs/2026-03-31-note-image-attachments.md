---
date: 2026-03-31
title: Note Image Attachments with Obsidian Export
author: Caleb Bennett
status: ready
score: 33/35
source: docs/plans/2026-03-30-note-image-attachments-design.md
---

# Note Image Attachments with Obsidian Export

## Meta

- Client: Personal
- Project: Skaldmark
- Repo: Skaldmark
- Date: 2026-03-31
- Author: Caleb Bennett
- Quality Score: 33/35 (Outcome: 5, Scope: 5, Decisions: 5, Edges: 5, Criteria: 4, Decomposition: 4, Purpose: 5)
- Status: Ready

## Outcome

Users can attach up to 10 photos (camera or gallery) to any note type in Skaldmark. Images display as inline thumbnails with tap-to-edit captions. On export, each image appears as a binary file in `attachments/{session-slug}/` with both an `![[image]]` embed in the parent note's markdown and a standalone sidecar `.md` file containing YAML metadata. An AI model processing the exported vault can read any sidecar and route the image to the correct note, session, and campaign.

## Intent

**Trade-off Hierarchy:**
1. Offline-first PWA integrity over feature richness (no cloud, no external services)
2. Obsidian compatibility over custom formats (wikilinks, YAML front matter, standard images)
3. Existing pattern consistency over ideal architecture (follow repository/hook/export patterns)
4. Storage efficiency over image quality (compress before storage)

**Decision Boundaries — Agent Decides:**
- File/folder organization for new components
- Internal implementation of resize/compress canvas utility
- Hook API shape (useNoteAttachments return type)
- Sidecar YAML field ordering
- Variable/function naming, error message wording

**Decision Boundaries — Escalate:**
- Dexie v4 migration causes data loss or upgrade failures
- bundleToZip change breaks existing callers
- Image compression makes text in photos unreadable
- A new npm dependency is needed

## Context

- Skaldmark is a Dragonbane tabletop RPG PWA with campaign/session/note management
- DB is Dexie v3 with 11 tables (characters, systems, appSettings, referenceNotes, metadata, campaigns, sessions, notes, entityLinks, parties, partyMembers)
- Note system has 9 types (generic, npc, combat, location, loot, rumor, quote, skill-check, recap) with tags support
- Export pipeline produces Obsidian-compatible markdown with YAML front matter, wiki-links, and zip bundles via JSZip
- `bundleToZip` currently takes `Map<string, string>` — needs to support `string | Blob`
- Note creation flows use Tiptap editor with @-mentions + TagPicker
- Hooks-as-services pattern: hooks own cross-table orchestration, repositories stay single-table
- Repository pattern: try/catch, Zod validation, generateId/nowISO

## Requirements

1. A new `attachments` table exists in IndexedDB (Dexie v4) with indexes: `id, noteId, campaignId, createdAt`
2. Attachment records store: id, noteId, campaignId, filename, mimeType, sizeBytes, blob (Blob), caption (string, optional), createdAt
3. Images are resized/compressed before storage (max 1920px wide, JPEG 80% quality, target ~200-500KB)
4. Maximum 10 attachments per note (enforced at the hook level, show toast if exceeded)
5. An "Attach" button appears on all note creation/editing flows (QuickNoteDrawer, QuickNPCDrawer, QuickLocationDrawer, and note detail view)
6. Attachment thumbnails render as a horizontal scrollable strip below the note editor
7. Tapping a thumbnail allows inline caption editing
8. Long-press or swipe on a thumbnail shows a delete option
9. Deleting a note cascades to delete all its attachments (in useNoteActions.deleteNote)
10. Single-note export auto-upgrades to zip when the note has attachments
11. Session/campaign bundle exports include image blobs in `attachments/{session-slug}/` and sidecar `.md` files
12. Sidecar metadata includes: title (parent note), type (note type), noteId, sessionId, campaignId, caption, originalFilename, createdAt
13. Note markdown includes `![[filename]]` embeds in an "Attachments" section at the bottom
14. `bundleToZip` accepts `Map<string, string | Blob>` (backward-compatible)
15. Existing exports without attachments continue to work unchanged

## Sub-Specs

### Sub-Spec 1: Attachment Type + DB Migration
**Scope:** Define the Attachment Zod schema/type. Add Dexie v4 schema with `attachments` table.
**Files:** `src/types/attachment.ts` (create), `src/storage/db/client.ts` (modify)
**Dependencies:** None
**Acceptance Criteria:**
- [STRUCTURAL] `src/types/attachment.ts` exports `attachmentSchema` and `Attachment` type with fields: id, noteId, campaignId, filename, mimeType, sizeBytes, blob, caption?, createdAt
- [MECHANICAL] `npx tsc --noEmit` passes
- [STRUCTURAL] `src/storage/db/client.ts` has `db.version(4).stores()` adding attachments table with indexes `'id, noteId, campaignId, createdAt'`
- [BEHAVIORAL] After app loads in browser, IndexedDB inspector shows `attachments` object store

### Sub-Spec 2: Attachment Repository
**Scope:** CRUD operations for the attachments table. Image resize/compress utility.
**Files:** `src/storage/repositories/attachmentRepository.ts` (create), `src/utils/imageResize.ts` (create)
**Dependencies:** Sub-Spec 1
**Acceptance Criteria:**
- [STRUCTURAL] `attachmentRepository` exports: `createAttachment(noteId, campaignId, file)`, `getAttachmentsByNote(noteId)`, `getAttachmentsByCampaign(campaignId)`, `deleteAttachment(id)`, `deleteAttachmentsByNote(noteId)`
- [BEHAVIORAL] `createAttachment` resizes images to max 1920px wide and compresses to JPEG 80% before storing
- [MECHANICAL] `createAttachment` generates filename as `{noteId-slug}-{timestamp}.jpg`
- [STRUCTURAL] `imageResize.ts` exports a `resizeAndCompress(file: File, maxWidth: number, quality: number): Promise<Blob>` function using canvas API
- [BEHAVIORAL] On `QuotaExceededError`, shows toast "Storage full" instead of throwing

### Sub-Spec 3: useNoteAttachments Hook + UI Components
**Scope:** Hook for loading/managing attachments. AttachButton and AttachmentThumbs components.
**Files:** `src/features/notes/useNoteAttachments.ts` (create), `src/components/notes/AttachButton.tsx` (create), `src/components/notes/AttachmentThumbs.tsx` (create)
**Dependencies:** Sub-Spec 2
**Acceptance Criteria:**
- [STRUCTURAL] `useNoteAttachments(noteId)` returns `{ attachments, addAttachment, removeAttachment, isLoading }`
- [BEHAVIORAL] Hook creates object URLs via `URL.createObjectURL` and revokes them on unmount/noteId change
- [BEHAVIORAL] `addAttachment` enforces 10-attachment limit — shows toast if exceeded
- [STRUCTURAL] `AttachButton` renders `<input type="file" accept="image/*">` with camera capture option
- [STRUCTURAL] `AttachmentThumbs` renders horizontal scrollable strip of `<img>` thumbnails from object URLs
- [BEHAVIORAL] Tapping thumbnail shows inline caption input
- [BEHAVIORAL] Delete action on thumbnail calls `removeAttachment`

### Sub-Spec 4: Wire Attachments into Note Flows
**Scope:** Add AttachButton + AttachmentThumbs to note creation/editing drawers. Update deleteNote cascade.
**Files:** `src/features/notes/QuickNoteDrawer.tsx` (modify), `src/features/notes/QuickNPCDrawer.tsx` (modify), `src/features/notes/QuickLocationDrawer.tsx` (modify), `src/features/notes/useNoteActions.ts` (modify)
**Dependencies:** Sub-Spec 3
**Acceptance Criteria:**
- [STRUCTURAL] All three Quick*Drawer components render AttachButton and AttachmentThumbs
- [BEHAVIORAL] User can attach an image during note creation — attachment saves with the note
- [BEHAVIORAL] `useNoteActions.deleteNote` cascade includes `attachmentRepository.deleteAttachmentsByNote(id)` before `noteRepository.deleteNote(id)`
- [MECHANICAL] `npx tsc --noEmit` passes

### Sub-Spec 5: Export Pipeline — Sidecar + Binary Support
**Scope:** Update bundleToZip signature, add renderAttachmentSidecar, update renderNoteToMarkdown for embeds, update all export flows.
**Files:** `src/utils/export/bundleToZip.ts` (modify), `src/utils/export/renderAttachmentSidecar.ts` (create), `src/utils/export/renderNote.ts` (modify), `src/features/export/useExportActions.ts` (modify)
**Dependencies:** Sub-Spec 2
**Acceptance Criteria:**
- [STRUCTURAL] `bundleToZip` accepts `Map<string, string | Blob>` — existing string-only callers continue to work
- [STRUCTURAL] `renderAttachmentSidecar(attachment, parentNote)` returns YAML front matter markdown with: title, type, noteId, sessionId, campaignId, caption, originalFilename, createdAt
- [BEHAVIORAL] `renderNoteToMarkdown` includes `![[filename]]` embeds in an "Attachments" section when attachment filenames are provided
- [BEHAVIORAL] `exportSessionBundle` fetches attachments for each linked note and adds blobs + sidecars to zip at `attachments/{session-slug}/`
- [BEHAVIORAL] `exportAllNotes` includes attachments grouped by session in the zip
- [BEHAVIORAL] `exportNote` auto-upgrades to zip when the note has attachments; produces single markdown when it doesn't
- [MECHANICAL] Existing exports of notes without attachments produce identical output to before

## Edge Cases

1. **Storage quota exceeded:** Wrap `db.attachments.add()` in try/catch. On `QuotaExceededError`, show toast. Resize/compress caps images at ~200-500KB each.
2. **Camera/file picker cancelled:** `<input>` fires no `change` event on cancel — no action needed.
3. **Corrupt or unreadable image:** Validate MIME type. If `createImageBitmap` rejects during resize, show toast. Don't store.
4. **Orphaned attachments:** Not addressed now (YAGNI). Waste space but don't break functionality.
5. **Large export (50+ images):** JSZip handles in-memory. ~15MB is well within limits.
6. **Object URL leaks:** `useNoteAttachments` hook owns lifecycle — revokes on unmount and noteId change.
7. **Note created then immediately deleted before attachments save:** Attachment save is async after note save. deleteNote cascade cleans up any partial attachments.
8. **Attachment limit reached:** Show toast "Maximum 10 attachments per note" when adding the 11th. Don't silently drop.

## Out of Scope

- Cloud storage or sync
- EXIF orientation handling (future optimization)
- Separate thumbnail blob for performance (future optimization)
- Export progress indicator for large bundles
- Voice-to-text / audio attachments
- Video attachments
- Attachment search / filtering
- Bulk attachment management
- Image editing / cropping in-app

## Constraints

**Musts:**
- Store images in IndexedDB only (fully offline PWA)
- Produce Obsidian-compatible output (wikilinks, YAML front matter, standard image formats)
- Follow existing repository pattern (try/catch, Zod validation, generateId/nowISO)
- Follow existing hook orchestration pattern (hooks own cross-table operations)
- Backward-compatible bundleToZip signature (existing string callers unaffected)
- Compress images before storage (no raw camera photos in IndexedDB)

**Must-Nots:**
- Must NOT add npm dependencies beyond what's already installed (JSZip, Tiptap, etc.)
- Must NOT break existing export outputs
- Must NOT store uncompressed images
- Must NOT modify existing Dexie v3 tables or indexes

**Preferences:**
- Prefer inline styles with CSS variables (project convention)
- Prefer named exports (project convention)
- Prefer hooks-as-services pattern for stateful operations
- Prefer showing toasts for user-facing errors via showToast()

**Escalation Triggers:**
- Dexie v4 migration causes data loss
- bundleToZip change breaks existing callers
- Image compression makes text unreadable
- New npm dependency needed

## Verification

End-to-end flow:
1. Create a campaign, start a session
2. Create a Quick Note with title "Battle Map Photo"
3. Attach 2 images via camera/file picker
4. Thumbnails appear below the editor with captions editable
5. Save the note
6. Navigate away and back — attachments persist
7. Export session bundle (.zip)
8. Open zip — verify:
   - `notes/battle-map-photo-{id}.md` contains `![[image-filename]]` embeds
   - `attachments/{session-slug}/` contains 2 `.jpg` files
   - `attachments/{session-slug}/` contains 2 `.md` sidecar files with correct YAML front matter
9. Delete the note — verify attachments are also deleted from IndexedDB
10. Export a note without attachments — verify single .md file (no zip)

## Phase Specs

Refined by `/forge-prep` on 2026-03-31.

| Sub-Spec | Phase Spec |
|----------|------------|
| 1. Attachment Type + DB Migration | `docs/specs/note-image-attachments/sub-spec-1-attachment-type-db.md` |
| 2. Attachment Repository | `docs/specs/note-image-attachments/sub-spec-2-attachment-repository.md` |
| 3. useNoteAttachments Hook + UI Components | `docs/specs/note-image-attachments/sub-spec-3-hook-ui-components.md` |
| 4. Wire Attachments into Note Flows | `docs/specs/note-image-attachments/sub-spec-4-wire-into-note-flows.md` |
| 5. Export Pipeline — Sidecar + Binary Support | `docs/specs/note-image-attachments/sub-spec-5-export-pipeline.md` |

Index: `docs/specs/note-image-attachments/index.md`
