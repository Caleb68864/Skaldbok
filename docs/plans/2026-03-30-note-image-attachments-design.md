---
date: 2026-03-30
topic: "Image attachments for notes with Obsidian export and AI-friendly metadata"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-03-30
tags:
  - design
  - note-image-attachments
---

# Note Image Attachments -- Design

## Summary

Add the ability to attach images (camera photos or gallery picks) to any note in Skaldmark. Images are stored as blobs in a new IndexedDB table, displayed as thumbnails on notes, and exported into the Obsidian-compatible zip with both inline `![[image]]` embeds in the note markdown and standalone sidecar metadata files. This enables an AI model to read the exported vault and understand where handwritten paper notes belong based on the structured metadata.

## Approach Selected

**Approach A: Blob Table with Note-Linked Attachments** -- chosen because it keeps image blobs out of the notes table for performance, uses IndexedDB's native blob support (no base64 overhead), and provides a clean query path for "all attachments for note X."

## Architecture

```
+-----------------------------------------------------+
|                   UI Layer                           |
|                                                      |
|  NoteEditor --> AttachButton --> Camera/FilePicker    |
|       |              |                               |
|       v              v                               |
|  AttachmentThumbs  (inline previews in note view)    |
+----------+----------+-------------------------------+
           |          |
           v          v
+------------------------------------------------------+
|               Repository Layer                        |
|                                                       |
|  noteRepository     attachmentRepository              |
|  (existing)         (NEW -- CRUD for image blobs)     |
|       |                    |                          |
|       v                    v                          |
|  +----------+     +----------------+                  |
|  |  notes   |<--->|  attachments   |  (noteId FK)     |
|  |  table   |     |  table (blobs) |                  |
|  +----------+     +----------------+                  |
|              IndexedDB (Dexie v4)                     |
+------------------------------------------------------+
           |
           v
+------------------------------------------------------+
|               Export Pipeline                         |
|                                                       |
|  renderNote --> embeds ![[image]] in markdown          |
|  renderAttachmentSidecar --> YAML metadata .md file    |
|  bundleToZip --> writes binary blobs + text files      |
|                                                       |
|  Output zip structure:                                |
|  campaign-name/                                       |
|    notes/                                             |
|      npc-grond.md          (has ![[grond-photo.jpg]]) |
|    attachments/                                       |
|      grond-photo.jpg       (binary image)             |
|      grond-photo.md        (sidecar metadata)         |
+------------------------------------------------------+
```

**Key flow:**
1. User taps "Attach" on a note -> camera or file picker opens
2. Image blob is stored in the `attachments` table, linked to the note by `noteId`
3. A thumbnail preview renders below the note editor
4. On export, the pipeline reads attachments for each note, writes the binary into `attachments/`, embeds `![[filename]]` in the note markdown, and generates a sidecar `.md` with YAML metadata

## Components

### 1. `Attachment` type (`src/types/attachment.ts`)
- Schema definition for an attachment record
- Fields: `id`, `noteId`, `campaignId`, `filename`, `mimeType`, `sizeBytes`, `blob` (Blob), `caption` (optional string), `createdAt`

### 2. `attachmentRepository` (`src/storage/repositories/attachmentRepository.ts`)
- CRUD operations against the `attachments` Dexie table
- Methods: `createAttachment(noteId, campaignId, file)`, `getAttachmentsByNote(noteId)`, `getAttachmentsByCampaign(campaignId)`, `deleteAttachment(id)`, `deleteAttachmentsByNote(noteId)`
- Handles resizing/compression before storage (canvas API: max 1920px wide, JPEG 80% quality)

### 3. `AttachButton` component
- Presents camera/file picker via `<input type="file" accept="image/*" capture="environment">` and a separate file-only input
- Calls `attachmentRepository.createAttachment()` with the selected file

### 4. `AttachmentThumbs` component
- Renders a horizontal strip of thumbnail previews for a note's attachments
- Tap to view full-size (lightbox or overlay)
- Long-press/swipe to delete

### 5. `useNoteAttachments(noteId)` hook
- Loads attachments for a given note, creates object URLs for thumbnails, cleans up URLs on unmount
- Returns `{ attachments, addAttachment, removeAttachment, isLoading }`

### 6. `renderAttachmentSidecar()` (`src/utils/export/renderAttachmentSidecar.ts`)
- Generates the sidecar markdown file for an image with YAML front matter
- Contains: parent note title, note type, noteId, sessionId, campaignId, caption, original filename, created date

### 7. Updated `renderNoteToMarkdown()`
- Now also receives attachment filenames and embeds `![[filename]]` references (no path prefix -- uses Obsidian's default shortest-path resolution, which works because filenames are unique via noteId slug + timestamp) in an "Attachments" section at the bottom

### 8. Updated `bundleToZip()`
- Signature changes from `Map<string, string>` to `Map<string, string | Blob>` to support both text and binary entries

### 9. DB Migration (Dexie v4)
- Adds `attachments` table with indexes: `'id, noteId, campaignId, createdAt'`
- Blob field is stored but not indexed

## Data Flow

### Capture Flow
1. User taps "Attach" on note
2. Camera (`<input accept="image/*" capture="environment">`) or gallery (`<input accept="image/*">`) returns a File object
3. `attachmentRepository.createAttachment(noteId, campaignId, file)`:
   - Resize/compress via canvas API (max 1920px, JPEG 80%)
   - Generate unique filename: `{noteId-slug}-{timestamp}.jpg`
   - Store record with blob in IndexedDB
   - Return Attachment record
4. `useNoteAttachments` re-fetches, UI shows new thumbnail

### Display Flow
1. Note renders, `useNoteAttachments(noteId)` fires
2. Fetches attachments from repository
3. Creates object URLs via `URL.createObjectURL(blob)` for each
4. `AttachmentThumbs` renders `<img>` thumbnails from object URLs
5. Cleanup: `URL.revokeObjectURL()` on unmount or noteId change

### Export Flow (Zip Bundles)
1. Export triggered for campaign or session bundle
2. For each note:
   - Fetch attachments via `getAttachmentsByNote(noteId)`
   - For each attachment:
     - Add binary blob to zip at `attachments/{filename}`
     - Generate sidecar via `renderAttachmentSidecar()`, add to zip at `attachments/{filename}.md`
   - Render note markdown with `![[filename]]` embeds
   - Add note markdown to zip at `notes/{note-slug}.md`
3. `bundleToZip` signature changes from `Map<string, string>` to `Map<string, string | Blob>` -- this is backward-compatible (existing string entries still work)
4. Updated callers in `useExportActions.ts`:
   - `exportSessionBundle`: fetch attachments for each linked note, add blobs to filesMap before calling `bundleToZip`
   - `exportAllNotes`: same -- fetch attachments per note, add blobs to filesMap

### Export Flow (Single-Note)
- `exportNote` and `copyNoteAsMarkdown` currently produce a single markdown file (no zip)
- When a note has attachments: auto-upgrade to a zip bundle containing the note markdown + its attachments + sidecar files
- When a note has no attachments: behavior unchanged (single markdown file)

### Delete Flow
- Delete attachment: `attachmentRepository.deleteAttachment(id)` removes from IndexedDB
- Delete note: Cascade lives in `useNoteActions.deleteNote` (matching existing pattern where hooks own orchestration, repositories stay single-table). Updated sequence:
  1. `entityLinkRepository.deleteLinksForNote(id)` (existing)
  2. `attachmentRepository.deleteAttachmentsByNote(id)` (NEW)
  3. `noteRepository.deleteNote(id)` (existing)

## Error Handling

### Storage quota exceeded
- Wrap `db.attachments.add()` in try/catch. On `QuotaExceededError`, show toast: "Storage full -- delete some attachments or export and clear."
- Resize/compress step caps images at ~200-500KB each.

### Camera/file picker denied or cancelled
- `<input>` fires no `change` event on cancel -- no action needed. Browser handles camera permission prompts.

### Corrupt or unreadable image file
- Validate MIME type from File object before storing. If `createImageBitmap` rejects during resize, show toast: "Couldn't process this image." Don't store.

### Orphaned attachments
- Not critical. Orphans waste space but don't break functionality. Periodic cleanup is a future optimization (YAGNI).

### Large export with many images
- JSZip handles in-memory. Typical usage (50 images x 300KB = ~15MB) is well within limits.

### Object URL leaks
- `useNoteAttachments` hook owns the lifecycle -- revokes on unmount and noteId change.

## Open Questions

1. **Caption UI:** Should captions be editable inline on the thumbnail strip, or via a detail/edit modal?
2. **Max attachments per note:** Should there be a limit (e.g., 10 per note)?
3. **Sidecar YAML content:** Should the sidecar include the full note body text for maximum AI context, or just metadata pointers? Body text is redundant but makes sidecars self-contained.
4. **Export folder structure:** Flat `attachments/` vs. `attachments/{session-slug}/` grouping by session.

## Approaches Considered

### Approach A: Blob Table with Note-Linked Attachments (Selected)
Separate `attachments` table in IndexedDB storing image blobs with `noteId` foreign key. Clean separation, efficient blob storage, straightforward querying. Requires a DB migration.

### Approach B: Inline Base64 in Note Body
Store images as base64 data URIs inside ProseMirror document JSON. No schema change needed, but 33% storage overhead, editor performance degradation with large images, and harder to manage attachments separately.

### Approach C: File System Access API
Use browser File System Access API for device storage. No IndexedDB bloat, but limited browser support (no Firefox, no iOS Safari), broken permission model across restarts, and breaks the PWA's offline self-contained model.

## Commander's Intent

**Desired End State:** Users can attach photos to any note type, see thumbnails on the note, and receive a zip export where each image is a binary file with both an inline Obsidian embed in the parent note and a standalone sidecar metadata file. An AI model processing the exported vault can read any sidecar and know: what note the image belongs to, what type of note, which session, which campaign, and any caption.

**Purpose:** Enable GM workflow where paper notes are photographed during a session, attached to digital notes for context, and exported into Obsidian where an AI can ingest the full vault (markdown + images) and route handwritten content to the correct digital notes based on metadata.

**Constraints:**
- MUST store images in IndexedDB (no external services, no cloud, fully offline PWA)
- MUST produce Obsidian-compatible output (wikilinks, YAML front matter, standard image formats)
- MUST follow existing repository pattern (try/catch, Zod validation, generateId/nowISO)
- MUST follow existing hook orchestration pattern (hooks own cross-table operations, repos stay single-table)
- MUST NOT break existing export functions (backward-compatible bundleToZip signature)
- MUST NOT store uncompressed images (resize/compress before storage)

**Freedoms:**
- The implementing agent MAY choose the compression quality and max dimensions within reason (plan suggests 1920px/80% but agent can adjust if there's a good reason)
- The implementing agent MAY choose component file organization within `src/features/` or `src/components/`
- The implementing agent MAY decide whether AttachButton uses one or two `<input>` elements for camera vs gallery
- The implementing agent MAY choose the lightbox/overlay implementation approach

## Execution Guidance

**Observe:**
- TypeScript compiler errors after each file change
- Existing exports still work after `bundleToZip` signature change (no regressions)
- Dexie migration upgrades cleanly (test by clearing and re-creating DB)
- Image compression produces reasonable file sizes (~200-500KB for phone photos)
- Object URLs are properly revoked (check browser DevTools memory)

**Orient:**
- Repository pattern template: `src/storage/repositories/noteRepository.ts` -- follow the same try/catch + Zod parse + generateId/nowISO pattern
- Hook pattern template: `src/features/notes/useNoteActions.ts` -- follow the same useCallback + campaign context + toast error handling pattern
- Export pipeline template: `src/features/export/useExportActions.ts` -- follow the same orchestration pattern (fetch data, build filesMap, call bundleToZip, call shareFile)
- Type definition template: `src/types/note.ts` -- follow the same Zod schema + inferred type pattern
- YAML rendering: reuse the existing `yamlValue()` helper (duplicated in renderNote.ts, renderSession.ts, renderCampaignIndex.ts -- pick one to import from)

**Escalate When:**
- The Dexie v4 migration causes data loss or upgrade failures
- The `bundleToZip` change breaks existing callers in unexpected ways
- Image compression quality is unacceptable (text in photos unreadable)
- A new npm dependency is needed (e.g., for EXIF handling)

**Shortcuts (Apply Without Deliberation):**
- Use `generateId()` from `src/utils/ids` for attachment IDs
- Use `nowISO()` from `src/utils/dates` for timestamps
- Use `showToast()` for user-facing error messages in hooks
- Place new types in `src/types/attachment.ts`
- Place new repository in `src/storage/repositories/attachmentRepository.ts`
- Follow Dexie versioning pattern in `src/storage/db/client.ts` (increment version, add table in `.stores()`)

## Decision Authority

**Agent Decides Autonomously:**
- File and folder structure for new components
- Internal implementation of resize/compress canvas utility
- Hook API shape (useNoteAttachments return type)
- Sidecar YAML field ordering and formatting
- generateFilename logic for attachment files
- Variable and function naming
- Error message wording in toasts

**Agent Recommends, Human Approves:**
- Dexie v4 schema migration definition
- bundleToZip signature change implementation
- Image compression settings (dimensions, quality)
- Whether to store a separate thumbnail blob for performance
- EXIF orientation handling approach

**Human Decides:**
- Caption UI design (inline vs modal) -- Open Question #1
- Max attachments per note limit -- Open Question #2
- Sidecar content depth (metadata only vs include note body) -- Open Question #3
- Export folder structure (flat vs session-grouped) -- Open Question #4
- Single-note export UX (auto-upgrade to zip vs note in markdown)

## War-Game Results

**Most Likely Failure:** Delete cascade placed in wrong layer -- if attachmentRepository.deleteAttachmentsByNote is called from inside noteRepository instead of useNoteActions, it breaks the established pattern and creates a maintenance trap. Mitigation: plan now explicitly specifies cascade lives in useNoteActions.deleteNote.

**Scale Stress:** N/A for current scope. 50 images at ~300KB = 15MB. IndexedDB and JSZip handle this comfortably.

**Dependency Risk:** JSZip Blob support (stable since v3.0/2016). createImageBitmap for resize (supported in all modern browsers including mobile Safari 15+). Both low risk.

**Maintenance Assessment:** Good. Clear component separation, established patterns followed. A new developer could trace the flow from AttachButton -> repository -> hook -> export. The export pipeline changes are the most complex part -- the plan now documents which functions in useExportActions.ts change and how.

## Evaluation Metadata
- Evaluated: 2026-03-30
- Cynefin Domain: Clear/Complicated boundary
- Critical Gaps Found: 1 (1 resolved)
- Important Gaps Found: 3 (3 resolved)
- Suggestions: 3 (noted, not applied -- EXIF orientation, thumbnail blob, export progress)

## Next Steps
- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-03-30-note-image-attachments-design.md`)
- [ ] Resolve open questions (caption UI, max attachments, sidecar content, folder structure)
- [ ] Implement DB migration and attachment type
- [ ] Build capture and display components
- [ ] Update export pipeline for binary + sidecar support
