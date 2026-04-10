---
type: phase-spec
master_spec: "docs/specs/2026-03-31-note-image-attachments.md"
sub_spec_number: 4
title: "Wire Attachments into Note Flows"
date: 2026-03-30
dependencies: [3]
---

# Sub-Spec 4: Wire Attachments into Note Flows

Refined from spec.md -- Note Image Attachments.

## Intent

Integrate the AttachButton and AttachmentThumbs components into the three Quick*Drawer note creation flows, and update the deleteNote cascade in useNoteActions to clean up attachments. This is the integration sub-spec -- it touches existing files but makes minimal, surgical changes.

## Scope

1. Modify `QuickNoteDrawer.tsx`, `QuickNPCDrawer.tsx`, and `QuickLocationDrawer.tsx` to render AttachButton and AttachmentThumbs.
2. Modify `useNoteActions.ts` to cascade-delete attachments when a note is deleted.
3. Handle the "note not yet saved" case: during creation, attachments are collected in local state and saved after the note is created (since we need a noteId).

## Interface Contracts

### Provides
- Integrated attachment UI in all three note creation drawers
- Cascade delete: `deleteNote` removes attachments before removing the note

### Requires
- From sub-spec 3: `useNoteAttachments` hook, `AttachButton` component, `AttachmentThumbs` component
- From sub-spec 2: `attachmentRepository.deleteAttachmentsByNote` (for cascade), `attachmentRepository.createAttachment` (for post-save attachment creation)

### Shared State
None beyond what sub-specs 2 and 3 provide.

## Acceptance Criteria

| ID | Type | Criterion |
|----|------|-----------|
| AC-4.1 | STRUCTURAL | All three Quick*Drawer components render AttachButton and AttachmentThumbs |
| AC-4.2 | BEHAVIORAL | User can attach an image during note creation -- attachment saves with the note |
| AC-4.3 | BEHAVIORAL | `useNoteActions.deleteNote` cascade includes `attachmentRepository.deleteAttachmentsByNote(id)` before `noteRepository.deleteNote(id)` |
| AC-4.4 | MECHANICAL | `npx tsc --noEmit` passes |

## Implementation Steps

### Step 1: Update useNoteActions deleteNote cascade

- **File:** `src/features/notes/useNoteActions.ts` (modify)
- **Action:** Modify existing file
- **Pattern:** Follow the existing `deleteNote` function at line 75-83
- **Changes:**
  1. Add import: `import * as attachmentRepository from '../../storage/repositories/attachmentRepository';`
  2. In `deleteNote` callback, add `await attachmentRepository.deleteAttachmentsByNote(id);` after the entity links deletion and before `noteRepository.deleteNote(id)`:
     ```typescript
     const deleteNote = useCallback(async (id: string): Promise<void> => {
       try {
         await entityLinkRepository.deleteLinksForNote(id);
         await attachmentRepository.deleteAttachmentsByNote(id);
         await noteRepository.deleteNote(id);
       } catch (e) {
         showToast('Failed to delete note');
         console.error('useNoteActions.deleteNote failed:', e);
       }
     }, [showToast]);
     ```
  The order matters: links first, then attachments (blobs), then the note record itself.

### Step 2: Wire attachments into QuickNoteDrawer

- **File:** `src/features/notes/QuickNoteDrawer.tsx` (modify)
- **Action:** Modify existing file
- **Pattern:** Follow the existing component structure -- add state for pending files, render AttachButton below TagPicker, render AttachmentThumbs below that
- **Changes:**
  1. Add imports:
     ```typescript
     import { AttachButton } from '../../components/notes/AttachButton';
     import { AttachmentThumbs } from '../../components/notes/AttachmentThumbs';
     ```
  2. Add state for pending files (pre-save, no noteId yet):
     ```typescript
     const [pendingFiles, setPendingFiles] = useState<File[]>([]);
     ```
  3. Create preview URLs and a thumbs-compatible data structure from pendingFiles
  4. Add `AttachButton` after the TagPicker, calling `setPendingFiles(prev => [...prev, file])` on file select
  5. Add `AttachmentThumbs` showing previews of pending files
  6. In `handleSave`, after `createNote` returns the note, loop through `pendingFiles` and call `attachmentRepository.createAttachment(note.id, activeCampaign.id, file)` for each
  7. Clean up preview URLs on unmount

### Step 3: Wire attachments into QuickNPCDrawer

- **File:** `src/features/notes/QuickNPCDrawer.tsx` (modify)
- **Action:** Modify existing file
- **Pattern:** Identical integration as QuickNoteDrawer (Step 2)
- **Changes:** Same as Step 2 -- add imports, pendingFiles state, AttachButton, AttachmentThumbs, post-save attachment creation

### Step 4: Wire attachments into QuickLocationDrawer

- **File:** `src/features/notes/QuickLocationDrawer.tsx` (modify)
- **Action:** Modify existing file
- **Pattern:** Identical integration as QuickNoteDrawer (Step 2)
- **Changes:** Same as Step 2 -- add imports, pendingFiles state, AttachButton, AttachmentThumbs, post-save attachment creation

### Step 5: Verify TypeScript compilation

- **Run:** `npx tsc --noEmit`
- **Expected:** No errors

### Step 6: Commit

- **Stage:** `git add src/features/notes/useNoteActions.ts src/features/notes/QuickNoteDrawer.tsx src/features/notes/QuickNPCDrawer.tsx src/features/notes/QuickLocationDrawer.tsx`
- **Message:** `feat: wire attachments into note creation flows and delete cascade`

## Verification Commands

- **Build:** `npx tsc --noEmit`
- **Tests:** No test framework detected -- skip TDD steps, implement directly.
- **Acceptance:**
  - AC-4.1: Inspect each Quick*Drawer file -- confirm `<AttachButton>` and `<AttachmentThumbs>` in JSX
  - AC-4.2: Run app in browser, create a note, attach an image, save -- check IndexedDB for attachment record
  - AC-4.3: Read `useNoteActions.ts` deleteNote -- confirm `attachmentRepository.deleteAttachmentsByNote(id)` call between links and note deletion
  - AC-4.4: Run `npx tsc --noEmit` -- zero errors

## Patterns to Follow

- `src/features/notes/QuickNoteDrawer.tsx`: Existing drawer structure -- state hooks at top, handleSave async function, JSX in return
- `src/features/notes/useNoteActions.ts` lines 75-83: Cascade delete pattern -- sequential awaits in try/catch
- `src/features/notes/QuickNPCDrawer.tsx`: Same drawer pattern with additional type-specific fields

## Cross-Cutting Constraints

- The pending-files approach is necessary because noteId does not exist until after `createNote` resolves
- If any attachment save fails post-note-creation, the note still exists -- partial attachments are acceptable (the user can re-attach)
- Preview URLs for pending files must be revoked on unmount to avoid memory leaks
- Keep changes to existing files minimal and surgical -- do not restructure existing code

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/features/notes/useNoteActions.ts` | Modify | Add attachment cascade to deleteNote |
| `src/features/notes/QuickNoteDrawer.tsx` | Modify | Add AttachButton + AttachmentThumbs to generic note creation |
| `src/features/notes/QuickNPCDrawer.tsx` | Modify | Add AttachButton + AttachmentThumbs to NPC note creation |
| `src/features/notes/QuickLocationDrawer.tsx` | Modify | Add AttachButton + AttachmentThumbs to location note creation |
