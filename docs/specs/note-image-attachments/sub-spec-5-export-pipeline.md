---
type: phase-spec
master_spec: "docs/specs/2026-03-31-note-image-attachments.md"
sub_spec_number: 5
title: "Export Pipeline -- Sidecar + Binary Support"
date: 2026-03-30
dependencies: [2]
---

# Sub-Spec 5: Export Pipeline -- Sidecar + Binary Support

Refined from spec.md -- Note Image Attachments.

## Intent

Update the export pipeline to handle image attachments. This means: (1) widen the `bundleToZip` signature to accept Blobs alongside strings, (2) create a sidecar markdown renderer for attachment metadata, (3) add `![[filename]]` embeds to note markdown, and (4) update all three export flows (single note, session bundle, all notes) to include attachment blobs and sidecars in the zip. Existing exports without attachments must produce identical output to before.

## Scope

1. Modify `src/utils/export/bundleToZip.ts` -- change signature from `Map<string, string>` to `Map<string, string | Blob>`. JSZip's `file()` method already accepts both natively, so the internal change is minimal.
2. Create `src/utils/export/renderAttachmentSidecar.ts` -- renders a YAML front matter markdown file for each attachment with metadata for AI processing.
3. Modify `src/utils/export/renderNote.ts` -- add an optional `attachmentFilenames` parameter; when provided, append an `## Attachments` section with `![[filename]]` embeds.
4. Modify `src/features/export/useExportActions.ts` -- update `exportNote`, `exportSessionBundle`, and `exportAllNotes` to fetch attachments, include blobs and sidecars in the zip, and handle the single-note-to-zip upgrade.

## Interface Contracts

### Provides
- `bundleToZip(files: Map<string, string | Blob>): Promise<Blob>` -- backward-compatible signature
- `renderAttachmentSidecar(attachment: Attachment, parentNote: Note): string` -- returns markdown with YAML front matter
- Updated `renderNoteToMarkdown` with optional attachment filenames parameter
- Updated export flows that include attachment binaries and sidecars

### Requires
- From sub-spec 2: `getAttachmentsByNote(noteId)`, `getAttachmentsByCampaign(campaignId)` from attachmentRepository
- From sub-spec 1: `Attachment` type

### Shared State
None -- this sub-spec only reads from the attachments table.

## Acceptance Criteria

| ID | Type | Criterion |
|----|------|-----------|
| AC-5.1 | STRUCTURAL | `bundleToZip` accepts `Map<string, string \| Blob>` -- existing string-only callers continue to work |
| AC-5.2 | STRUCTURAL | `renderAttachmentSidecar(attachment, parentNote)` returns YAML front matter markdown with: title, type, noteId, sessionId, campaignId, caption, originalFilename, createdAt |
| AC-5.3 | BEHAVIORAL | `renderNoteToMarkdown` includes `![[filename]]` embeds in an "Attachments" section when attachment filenames are provided |
| AC-5.4 | BEHAVIORAL | `exportSessionBundle` fetches attachments for each linked note and adds blobs + sidecars to zip at `attachments/{session-slug}/` |
| AC-5.5 | BEHAVIORAL | `exportAllNotes` includes attachments grouped by session in the zip |
| AC-5.6 | BEHAVIORAL | `exportNote` auto-upgrades to zip when the note has attachments; produces single markdown when it doesn't |
| AC-5.7 | MECHANICAL | Existing exports of notes without attachments produce identical output to before |

## Implementation Steps

### Step 1: Widen bundleToZip signature

- **File:** `src/utils/export/bundleToZip.ts` (modify)
- **Action:** Modify existing file
- **Pattern:** The file is 9 lines. Change only the type signature.
- **Changes:**
  ```typescript
  import JSZip from 'jszip';

  export async function bundleToZip(files: Map<string, string | Blob>): Promise<Blob> {
    const zip = new JSZip();
    for (const [filename, content] of files) {
      zip.file(filename, content);
    }
    return await zip.generateAsync({ type: 'blob' });
  }
  ```
  This is backward-compatible: callers passing `Map<string, string>` still work because `string` is a subtype of `string | Blob`. JSZip's `file()` method natively accepts `string | Blob | ArrayBuffer | Uint8Array`.

### Step 2: Create renderAttachmentSidecar

- **File:** `src/utils/export/renderAttachmentSidecar.ts` (create)
- **Action:** Create new file
- **Pattern:** Follow `src/utils/export/renderNote.ts` -- YAML front matter generation with the existing `yamlValue` helper pattern
- **Changes:**
  ```typescript
  import type { Attachment } from '../../types/attachment';
  import type { Note } from '../../types/note';

  export function renderAttachmentSidecar(attachment: Attachment, parentNote: Note): string {
    const fields: Record<string, unknown> = {
      title: parentNote.title,
      type: parentNote.type,
      noteId: attachment.noteId,
      sessionId: parentNote.sessionId ?? '',
      campaignId: attachment.campaignId,
      caption: attachment.caption ?? '',
      originalFilename: attachment.filename,
      createdAt: attachment.createdAt,
    };

    const lines = Object.entries(fields)
      .map(([key, value]) => `${key}: ${yamlValue(value)}`);

    return `---\n${lines.join('\n')}\n---\n\nSidecar metadata for ![[${attachment.filename}]]\n`;
  }
  ```
  Include a local `yamlValue` helper (copy from renderNote.ts) or extract to a shared utility. Prefer copying to keep the change minimal -- both files already have their own copy.

### Step 3: Update renderNoteToMarkdown for attachment embeds

- **File:** `src/utils/export/renderNote.ts` (modify)
- **Action:** Modify existing file
- **Pattern:** The function currently returns `frontMatter + '\n\n' + body`. Add an optional parameter for attachment filenames.
- **Changes:**
  1. Change signature to add optional parameter:
     ```typescript
     export function renderNoteToMarkdown(
       note: Note,
       entityLinks: EntityLink[],
       allNotes: Array<{ id: string; title: string }>,
       attachmentFilenames?: string[]
     ): string {
     ```
  2. After the body, conditionally append an Attachments section:
     ```typescript
     let result = frontMatter + '\n\n' + body;

     if (attachmentFilenames && attachmentFilenames.length > 0) {
       result += '\n\n## Attachments\n\n';
       result += attachmentFilenames.map(f => `![[${f}]]`).join('\n');
       result += '\n';
     }

     return result;
     ```
  3. When called without `attachmentFilenames` (existing callers), output is identical to before.

### Step 4: Update exportNote for auto-zip upgrade

- **File:** `src/features/export/useExportActions.ts` (modify)
- **Action:** Modify existing file
- **Pattern:** Follow the existing `exportNote` function at lines 19-41
- **Changes:**
  1. Add import: `import { getAttachmentsByNote } from '../../storage/repositories/attachmentRepository';`
  2. Add import: `import { renderAttachmentSidecar } from '../../utils/export/renderAttachmentSidecar';`
  3. In `exportNote`, after fetching the note and links:
     ```typescript
     const attachments = await getAttachmentsByNote(noteId);
     const attachmentFilenames = attachments.map(a => a.filename);
     const markdown = renderNoteToMarkdown(note, links, allNotes, attachmentFilenames);

     if (attachments.length === 0) {
       // No attachments: single markdown file (existing behavior)
       const blob = new Blob([markdown], { type: 'text/markdown' });
       await shareFile(blob, generateFilename(note));
     } else {
       // Has attachments: auto-upgrade to zip
       const filesMap = new Map<string, string | Blob>();
       filesMap.set(generateFilename(note), markdown);
       for (const att of attachments) {
         filesMap.set(`attachments/${att.filename}`, att.blob);
         filesMap.set(`attachments/${att.filename.replace('.jpg', '.md')}`, renderAttachmentSidecar(att, note));
       }
       const zipBlob = await bundleToZip(filesMap);
       await shareFile(zipBlob, generateFilename(note).replace('.md', '.zip'));
     }
     ```

### Step 5: Update exportSessionBundle for attachments

- **File:** `src/features/export/useExportActions.ts` (modify)
- **Action:** Modify existing file (continued)
- **Pattern:** Follow the existing `exportSessionBundle` function at lines 78-109
- **Changes:**
  1. After building `filesMap` from `renderSessionBundle`, widen its type to `Map<string, string | Blob>`:
     ```typescript
     const textFilesMap = renderSessionBundle(session, linkedNotes, allEntityLinks);
     const filesMap = new Map<string, string | Blob>(textFilesMap);
     ```
  2. Generate session slug for the attachments folder:
     ```typescript
     const sessionSlug = session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
     ```
  3. For each linked note, fetch its attachments and add to the map:
     ```typescript
     for (const note of linkedNotes) {
       const attachments = await getAttachmentsByNote(note.id);
       for (const att of attachments) {
         filesMap.set(`attachments/${sessionSlug}/${att.filename}`, att.blob);
         filesMap.set(`attachments/${sessionSlug}/${att.filename.replace('.jpg', '.md')}`, renderAttachmentSidecar(att, note));
       }
     }
     ```
  4. Also update the note markdown rendering to include attachment filenames:
     - Before rendering each note, get its attachment filenames and pass to `renderNoteToMarkdown`
     - This requires updating the `renderSessionBundle` call or rendering notes individually with attachment data
     - Simplest approach: re-render notes that have attachments with the attachment filenames appended

### Step 6: Update exportAllNotes for attachments

- **File:** `src/features/export/useExportActions.ts` (modify)
- **Action:** Modify existing file (continued)
- **Pattern:** Follow the existing `exportAllNotes` function at lines 135-165
- **Changes:**
  1. Change `filesMap` type to `Map<string, string | Blob>`
  2. For each note, fetch attachments, pass filenames to `renderNoteToMarkdown`
  3. Add attachment blobs and sidecars to the map:
     ```typescript
     const filesMap = new Map<string, string | Blob>();
     for (const note of allNotes) {
       const links = [...] as EntityLink[];
       const attachments = await getAttachmentsByNote(note.id);
       const attachmentFilenames = attachments.map(a => a.filename);
       const markdown = renderNoteToMarkdown(note, links, allNotes, attachmentFilenames);
       filesMap.set(generateFilename(note), markdown);

       for (const att of attachments) {
         const folder = note.sessionId
           ? `attachments/${note.sessionId.slice(0, 8)}/`
           : 'attachments/unsorted/';
         filesMap.set(`${folder}${att.filename}`, att.blob);
         filesMap.set(`${folder}${att.filename.replace('.jpg', '.md')}`, renderAttachmentSidecar(att, note));
       }
     }
     ```

### Step 7: Verify TypeScript compilation

- **Run:** `npx tsc --noEmit`
- **Expected:** No errors

### Step 8: Commit

- **Stage:** `git add src/utils/export/bundleToZip.ts src/utils/export/renderAttachmentSidecar.ts src/utils/export/renderNote.ts src/features/export/useExportActions.ts`
- **Message:** `feat: export pipeline with attachment binaries and sidecar metadata`

## Verification Commands

- **Build:** `npx tsc --noEmit`
- **Tests:** No test framework detected -- skip TDD steps, implement directly.
- **Acceptance:**
  - AC-5.1: Inspect `bundleToZip.ts` -- confirm `Map<string, string | Blob>` signature
  - AC-5.2: Inspect `renderAttachmentSidecar.ts` -- confirm all 8 YAML fields
  - AC-5.3: Inspect `renderNote.ts` -- confirm `## Attachments` section with `![[filename]]` when filenames provided
  - AC-5.4: Read `exportSessionBundle` -- confirm attachment blobs placed at `attachments/{session-slug}/`
  - AC-5.5: Read `exportAllNotes` -- confirm attachments included per note
  - AC-5.6: Read `exportNote` -- confirm zip when attachments exist, single .md when not
  - AC-5.7: Call `renderNoteToMarkdown` without 4th arg -- confirm output unchanged

## Patterns to Follow

- `src/utils/export/bundleToZip.ts`: Current 9-line file -- minimal change to type signature only
- `src/utils/export/renderNote.ts`: YAML front matter generation pattern with `yamlValue` helper
- `src/utils/export/renderSession.ts`: Session bundle assembly pattern -- building Map, deduplicating filenames
- `src/features/export/useExportActions.ts`: Export flow pattern -- fetch data, build map, bundle to zip, share file

## Cross-Cutting Constraints

- `bundleToZip` signature change must be backward-compatible -- `Map<string, string>` is assignable to `Map<string, string | Blob>`
- Sidecar `.md` files use the same filename as the image but with `.md` extension (e.g., `photo-abc12345-1711900000000.md`)
- Do NOT modify `renderSessionBundle` in `renderSession.ts` -- that function returns `Map<string, string>` and other callers depend on it. Instead, create a new wider map in `useExportActions` and copy entries.
- Existing exports without attachments must be byte-identical to current output
- No new npm dependencies (JSZip already handles Blob natively)

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/export/bundleToZip.ts` | Modify | Widen parameter type to accept `string \| Blob` |
| `src/utils/export/renderAttachmentSidecar.ts` | Create | YAML front matter sidecar renderer for attachment metadata |
| `src/utils/export/renderNote.ts` | Modify | Add optional attachment embeds section |
| `src/features/export/useExportActions.ts` | Modify | Update all export flows to include attachment blobs and sidecars |
