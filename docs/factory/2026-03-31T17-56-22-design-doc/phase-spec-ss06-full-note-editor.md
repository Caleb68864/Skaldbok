# Phase Spec — SS-06: Full Note Editor Route
**Sub-Spec:** SPEC-B2-2
**Issue:** #5
**Batch:** 2 — Notes Overhaul
**Dependency:** SS-07 (Tiptap Quick Note Fix) should be verified first as a Tiptap/React 19 canary. SS-09 (Custom Tags) should be implemented before or in parallel so the tag picker is available for this editor.

---

## Intent
Replace modal-based note editing with a dedicated full-page editor route that cannot be accidentally dismissed. Exposes the full Tiptap toolbar and all note metadata fields.

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Modify | `src/routes/index.tsx` — add `/note/:id/edit` and `/note/new` routes |
| Create | `src/features/notes/NoteEditorPage.tsx` |
| Reference (reuse) | `src/components/notes/TiptapNoteEditor.tsx` |
| Reference | `src/storage/repositories/noteRepository.ts` — `createNote()` and update functions |

---

## Implementation Steps

1. **Read** `src/routes/index.tsx` to understand the existing route declaration pattern.
2. **Read** `src/components/notes/TiptapNoteEditor.tsx` to understand its props API.
3. **Read** `src/storage/repositories/noteRepository.ts` to identify `createNote()` and the update/save function signature.
4. **Add** two new routes to `src/routes/index.tsx`:
   - `/note/new` → renders `NoteEditorPage` in create mode
   - `/note/:id/edit` → renders `NoteEditorPage` in edit mode (loads existing note by `id`)
5. **Create** `src/features/notes/NoteEditorPage.tsx`:
   - Full **Tiptap toolbar**: bold, italic, headings (H1–H3), lists (ordered + unordered), blockquotes, links.
   - Metadata fields:
     - **Title** (text input, required)
     - **Type** (selector using existing note type enum/list)
     - **Tags** (tag picker from SS-09 — import `TagPicker` or equivalent once SS-09 is done; placeholder input acceptable if SS-09 is not yet merged)
     - **Body** (`<TiptapNoteEditor />`)
   - **Save** logic:
     - Create mode: calls `noteRepository.createNote(...)` then navigates back.
     - Edit mode: loads note by `id`, calls update function, then navigates back.
   - **Back navigation**: returns to previous screen via `history.back()` or navigates to `/session?view=notes` as fallback.
   - **Error boundary**: wraps the Tiptap editor with a boundary showing `"Editor failed to load"` + a retry button.
6. **Verify** that the existing modal-based note editing still functions (do not remove the modal until SS-10 explicitly removes link-note UI — just add the new route alongside).

---

## Acceptance Criteria

- [ ] **B2-2-AC1:** `/note/:id/edit` and `/note/new` routes exist and render the full editor.
- [ ] **B2-2-AC2:** Full Note Editor shows Tiptap toolbar with bold, italic, headings, lists, blockquotes, links.
- [ ] **B2-2-AC3:** Title, type, tags, and body are all editable and saved correctly.
- [ ] **B2-2-AC4:** Editor uses a dedicated page/route (not a modal); cannot be accidentally dismissed.

---

## Open Question (Default Applied)

- **OQ-4:** Route paths default to `/note/:id/edit` and `/note/new` if human has not specified otherwise.

---

## Verification Commands

```bash
# TypeScript — must pass with zero errors
npx tsc --noEmit
```

---

## Cross-Cutting Constraints

- No new npm dependencies.
- No Dexie schema version bump.
- All CSS via CSS variables — no hardcoded colors.
- All touch targets ≥ 44 px.

---

## Escalation Triggers

Pause and request human input if:
- The existing `noteRepository` does not have an update function and adding one would require a Dexie index change.
- Route path conflicts with existing routes.
