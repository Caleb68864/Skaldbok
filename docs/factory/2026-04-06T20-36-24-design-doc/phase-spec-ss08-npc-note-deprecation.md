# Phase Spec — SS-08: NPC Note Type Deprecation

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 1.5 — Feature A: NPC Note Deprecation
**Depends on:** SS-02 (Zod schemas — note.ts extended), SS-01 (Dexie migration — NPC notes archived).
**Delivery order note:** Step 8 in execution sequence.

---

## Objective

Remove `'npc'` from new-note creation UI pickers and filters while preserving full backward compatibility for existing/archived NPC notes. The `'npc'` type must remain in the `noteSchema` type enum and all rendering code — only the creation surface removes it.

---

## Files to Modify

- `src/features/notes/QuickNoteDrawer.tsx` — remove `'npc'` from type picker options
- `src/features/notes/NotesGrid.tsx` — update type filter: `'npc'` filter removed from active filters; archived NPC notes visible under "Show archived"
- `src/features/notes/NoteItem.tsx` — NPC-specific rendering preserved (do not touch)
- `src/screens/NoteEditorScreen.tsx` — hide NPC-specific editor fields when creating new notes (not for viewing archived)
- `src/features/notes/useNoteActions.ts` — NPC entity linking preserved for archived notes (no change unless needed)
- `src/types/note.ts` — verify `'npc'` remains in schema (do not remove); update UI-facing picker enum/array only

---

## Implementation Steps

### Step 1: Audit affected files

Read each of the listed files to identify:
1. Where `'npc'` appears in type picker arrays/enums used by `QuickNoteDrawer`
2. Where `'npc'` appears in filter options in `NotesGrid`
3. Any NPC-specific fields rendered in `NoteEditorScreen` during creation
4. Whether `useNoteActions.ts` has any `'npc'`-specific branching that should be preserved

Count all files where `'npc'` is used as a type string. If more than 3 files beyond the 6 listed require changes, **STOP and escalate** — do not silently expand scope.

### Step 2: `QuickNoteDrawer.tsx` — remove from type picker

Locate the array/object that defines available note types for the picker (likely something like `NOTE_TYPES` or an inline array). Remove `'npc'` from it.

```typescript
// Before:
const noteTypes = ['general', 'combat', 'npc', 'location', ...];
// After:
const noteTypes = ['general', 'combat', 'location', ...];
// Note: 'combat' type in picker may also be removed if encounters replace it
//       Only remove 'npc' per this spec — do not remove 'combat' unless explicitly noted
```

Do not change the underlying type in `noteSchema` — only the UI picker array.

### Step 3: `NotesGrid.tsx` — update type filter

Locate the filter options for note type. Remove `'npc'` as an active filter option. Existing NPC notes should surface when the user enables "Show archived" — no special NPC filter needed.

If the filter is driven by a constant array, remove `'npc'` from that array. If `'npc'` notes become visible via archived status, no additional filter entry is needed.

### Step 4: `NoteEditorScreen.tsx` — hide NPC fields during creation

NPC-specific fields (role, affiliation, stat block fields, etc.) should only render when:
- The note being viewed is an existing NPC note (`note.type === 'npc'`)

When creating a NEW note, these fields should not appear (since type cannot be `'npc'` via the picker anymore).

Pattern:
```tsx
{note.type === 'npc' && (
  // NPC-specific fields — only render for existing NPC notes
  <NpcFields ... />
)}
```

If this conditional already exists and works correctly (because `'npc'` can't be selected as a new type), no change needed — just verify.

### Step 5: `src/types/note.ts` — verify only

Open `src/types/note.ts` and confirm:
- `'npc'` is still present in the type enum/schema (do NOT remove it)
- The `visibility` field added in SS-02 is present

No code changes in this file unless `'npc'` was accidentally removed.

### Step 6: `useNoteActions.ts` — verify only

Open `src/features/notes/useNoteActions.ts` and confirm any NPC entity linking logic is preserved. No changes expected.

---

## Verification Commands

```bash
npx tsc --noEmit
```

**Manual verification:**
- Open `QuickNoteDrawer` — NPC option must NOT appear in type picker.
- Open `NotesGrid` filter — `npc` filter option must NOT appear in active type filter list.
- Open an archived NPC note — it still renders correctly with all NPC fields.
- `NoteEditorScreen` creating a new note — no NPC-specific fields visible.
- `NoteEditorScreen` opening an existing archived NPC note — NPC fields visible and editable.

---

## Acceptance Criteria

- [ ] `'npc'` does not appear in new-note type picker in `QuickNoteDrawer`
- [ ] Existing (archived) NPC notes still render in `NotesGrid` when "Show archived" is active
- [ ] No TypeScript errors in any affected file
- [ ] NPC note type is NOT present in the picker-facing array/enum used by `QuickNoteDrawer`
- [ ] `'npc'` type remains in `noteSchema` Zod enum (backward compat) — verify no removal occurred
- [ ] NPC-specific rendering in `NoteItem.tsx` unchanged (no diff on that file)
- [ ] `src/types/note.ts` still has `'npc'` in its type schema — no removal
- [ ] Changes are confined to the 6 listed files (if more files require changes, escalate)

---

## Escalation Trigger

**STOP and escalate if:**
- Removing `'npc'` from the picker cascades to more than 3 files beyond the 6 listed
- Any file uses a shared constant (not inline array) for note types that is also used in validation/storage (changing it would break schema compatibility)

---

## Constraints

- Do not remove `'npc'` from `noteSchema` Zod type enum — backward compat required
- Do not modify `NoteItem.tsx` rendering logic
- Do not modify `useNoteActions.ts` NPC entity linking logic
- Scope is strictly limited to UI picker/filter surfaces
- No new npm dependencies
