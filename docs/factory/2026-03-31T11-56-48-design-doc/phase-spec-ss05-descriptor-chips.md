# Phase Spec — SS-05: Inline `#descriptor` Chips

**Run:** 2026-03-31T11-56-48-design-doc
**Tier:** 2 (Features + Key UX)
**Item:** 5 of 12
**Assigned worker:** single agent — implements ONLY this sub-spec

> **Dependency:** Tier 1 items (SS-01 through SS-04) should be complete and merged before starting Tier 2.
> This is the highest-complexity item. Run E2E after this item before proceeding to SS-06.

---

## Intent

Users can type `#word` in the TipTap editor to create an inline descriptor chip. Descriptors are persisted in the existing ProseMirror JSON body (no schema change), extracted for display and search, and autocompleted from campaign notes with frequency weighting.

---

## Files to Create (New)

| File | Purpose |
|------|---------|
| `src/utils/notes/extractDescriptors.ts` | Pure function: traverse ProseMirror JSON, return descriptor labels array |
| `src/features/notes/useDescriptorSuggestions.ts` | Hook: build frequency map from campaign notes, return ranked suggestions |
| `src/features/notes/descriptorMentionExtension.ts` | TipTap extension: `Mention.extend({ name: 'descriptorMention' })` for `#` trigger |

## Files to Modify (Existing)

| File | Action |
|------|--------|
| `src/components/notes/TiptapNoteEditor.tsx` | Register `descriptorMentionExtension` + `useDescriptorSuggestions` |
| `src/features/notes/NoteItem.tsx` | Render descriptor chip row using `extractDescriptors` |
| `src/features/notes/useNoteSearch.ts` | Add `'descriptors'` field to MiniSearch index |

> No other files should be modified. If any other file requires changes, escalate to human before proceeding.
> **CRITICAL:** If `Mention.extend()` API does not work as described — escalate to human before attempting any alternative approach.

---

## Architecture Flow

```
User types #word in TipTap editor
  → descriptorMentionExtension (Mention.extend({ name: 'descriptorMention' }))
      intercepts # trigger
  → Dropdown shows campaign-weighted autocomplete suggestions
      (useDescriptorSuggestions → frequency map from campaign notes)
  → User selects or types completion → ProseMirror node:
      { type: 'descriptorMention', attrs: { kind: 'descriptor', label: 'word' } }
  → On save: body JSON persisted to Dexie as-is (NO schema change)
  → On render (NoteItem): extractDescriptors(body) → chip row display
  → On search index: extractDescriptors(body) → MiniSearch 'descriptors' field
```

---

## Implementation Steps

### Step 1 — Read existing files

Read these files before writing anything:
- `src/components/notes/TiptapNoteEditor.tsx`
- `src/features/notes/NoteItem.tsx`
- `src/features/notes/useNoteSearch.ts`
- `src/utils/prosemirror.ts` (or equivalent — model `extractDescriptors` on `extractText`)
- Any existing `Mention` extension setup in the TipTap editor

Verify the actual TipTap version in `package.json` (expected: `^2.11.7`) and confirm `Mention.extend()` API before writing `descriptorMentionExtension.ts`.

### Step 2 — `extractDescriptors.ts`

```ts
// src/utils/notes/extractDescriptors.ts
// Model on extractText() from utils/prosemirror

export function extractDescriptors(body: unknown): string[] {
  // Return [] for null, undefined, or malformed input — NEVER throw
  // Traverse ProseMirror JSON nodes recursively
  // Collect all nodes where node.type === 'descriptorMention'
  // Return node.attrs.label values as string[]
}
```

- Must return `[]` for `null`, `undefined`, `{}`, or any malformed input.
- Must never throw.
- Follow the traversal pattern in `extractText()` exactly.

### Step 3 — `descriptorMentionExtension.ts`

```ts
// src/features/notes/descriptorMentionExtension.ts
import { Mention } from '@tiptap/extension-mention'

export const DescriptorMention = Mention.extend({
  name: 'descriptorMention',
  // ... suggestion config for '#' trigger
})
```

- Use `Mention.extend({ name: 'descriptorMention' })` — NOT a second `Mention` instance.
- Set `suggestion.char = '#'` to intercept the `#` trigger.
- Wire `suggestion.items` to accept a query string and return `SuggestionItem[]`.
- Wire `suggestion.render` to display the autocomplete dropdown.
- The suggestion items come from `useDescriptorSuggestions` — pass them in as a prop or via a ref pattern compatible with TipTap's suggestion API.

### Step 4 — `useDescriptorSuggestions.ts`

```ts
// src/features/notes/useDescriptorSuggestions.ts
// Build frequency map once on mount from all campaign notes
// Cache in-memory; append new descriptors on save
// Return ranked suggestions filtered by current # query
```

- On mount: load all campaign notes from the repository, extract descriptors from each, build a `Map<string, number>` frequency count.
- On save: append new descriptors to the in-memory map (do not re-load all notes).
- Return a function `getSuggestions(query: string): string[]` that filters and sorts by frequency descending.
- Use `getById()` / `save()` from the appropriate repository — no raw Dexie queries.

### Step 5 — `TiptapNoteEditor.tsx`

- Import and register `DescriptorMention` extension alongside the existing `@mention` extension.
- Pass `useDescriptorSuggestions()` results to the `DescriptorMention` suggestion config.
- Ensure both `@mention` and `#descriptor` triggers work simultaneously in the same editor instance.
- Verify `#` without completion stays as plain text (no stray node created).

### Step 6 — `NoteItem.tsx`

- Import `extractDescriptors` from `src/utils/notes/extractDescriptors`.
- Call `extractDescriptors(note.body)` to get descriptor labels.
- If labels array is non-empty, render a chip row below the note body.
- Use the existing `chipStyle` pattern from `SessionQuickActions.tsx` for chip appearance.
- If labels is empty or `[]`, render nothing (no empty chip row container).

### Step 7 — `useNoteSearch.ts`

- Add `'descriptors'` as a field to the MiniSearch index configuration.
- When indexing a note, populate the `descriptors` field with `extractDescriptors(note.body).join(' ')` (or equivalent array form if MiniSearch supports it).
- Follow all existing patterns in `useNoteSearch.ts` — do not change MiniSearch structural config beyond adding this field.

### Step 8 — Type-check and build

```bash
tsc -b       # Fix all type errors
vite build   # Confirm production build succeeds
```

### Step 9 — Spot-check

- Open notes, type `#`, verify autocomplete dropdown appears.
- Select a descriptor → inline chip renders in editor.
- Save note → reload → descriptor chip still present.
- Open `NoteItem` view → chip row visible.
- Search for descriptor word → matching note returned.
- Existing notes (no descriptors) render correctly.

### Step 10 — Commit

Commit with descriptive message referencing Item 5.

---

## Acceptance Criteria

- [ ] **AC5.1** — Typing `#` in the TipTap editor opens an autocomplete dropdown.
- [ ] **AC5.2** — Completing a descriptor creates an inline chip node in the editor.
- [ ] **AC5.3** — The ProseMirror JSON for a descriptor node has `type: 'descriptorMention'` and `attrs.label`.
- [ ] **AC5.4** — Saving a note with descriptors persists the body JSON unchanged to Dexie (no schema version bump).
- [ ] **AC5.5** — `extractDescriptors(body)` returns the correct labels array for a note with descriptors.
- [ ] **AC5.6** — `extractDescriptors(null)` and `extractDescriptors({})` both return `[]` without throwing.
- [ ] **AC5.7** — All existing notes (without descriptors) render correctly after this change.
- [ ] **AC5.8** — `NoteItem` displays descriptor chips for notes that have descriptors.
- [ ] **AC5.9** — MiniSearch indexes descriptors; searching for a descriptor word returns matching notes.
- [ ] **AC5.10** — Autocomplete suggestions are frequency-ranked from campaign notes.
- [ ] **AC5.11** — `#` without completion stays as plain text (no stray node created).
- [ ] **AC5.12** — Both `@mention` and `#descriptor` triggers work simultaneously in the same editor instance.
- [ ] **AC5.13** — `tsc -b` reports zero new type errors after this change.
- [ ] **AC5.14** — `vite build` succeeds after this change.

---

## Verification Commands

```bash
# Type-check
tsc -b

# Production build
vite build

# Run E2E after this item (before proceeding to SS-06)
python tests/e2e_full_test.py
```

**Manual spot-check checklist (360px viewport):**
- [ ] Type `#dr` → dropdown shows frequency-ranked suggestions.
- [ ] Select suggestion → chip node appears inline.
- [ ] Type `#foo` + press space (no selection) → plain text `#foo `, no chip node.
- [ ] Save note → body JSON in Dexie contains `descriptorMention` node.
- [ ] Open NoteItem → descriptor chip row shown.
- [ ] Search `"foo"` → note with `#foo` descriptor appears in results.
- [ ] Open existing note without descriptors → renders correctly, no errors.
- [ ] Type `@name` → `@mention` dropdown still works alongside `#descriptor`.

---

## Escalation Triggers (Do Not Bypass)

- If `Mention.extend({ name: 'descriptorMention' })` does not work as described: **escalate to human before any alternative**.
- If implementing requires changing `NoteItem`, `TiptapNoteEditor`, or `SessionQuickActions` prop interfaces: **escalate to human before proceeding**.
- If a new npm dependency would be required: **escalate to human**.

---

## Constraints (Never Violate)

- No Dexie schema version bump or structural changes.
- No breaking changes to existing note body JSON format — all existing notes must render.
- No new npm dependencies.
- Use `Mention.extend({ name: 'descriptorMention' })` — do not add a plural `suggestions` array on a single `Mention` instance.
- All inline styles use `var(--color-*)` CSS custom properties.
- Touch targets ≥ 44×44px on all new interactive elements.

---

## Shortcuts

- Model `extractDescriptors()` on `extractText()` from `utils/prosemirror`.
- Use existing `chipStyle` pattern from `SessionQuickActions.tsx` for descriptor chips in `NoteItem`.
- Use `getById()` / `save()` from appropriate repository — no raw Dexie.
- Follow existing `useNoteSearch.ts` patterns for MiniSearch modifications.
- Commit after this item; run E2E before proceeding to SS-06.
