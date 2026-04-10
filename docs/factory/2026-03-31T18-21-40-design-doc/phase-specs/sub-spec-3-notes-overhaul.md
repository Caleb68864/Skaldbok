---
type: phase-spec
master_spec: "docs/factory/2026-03-31T18-21-40-design-doc/spec.md"
sub_spec_number: 3
title: "Notes Overhaul — Grid, Full Editor, Tiptap Fix, @-Mentions, Tags, Link Note Removal"
date: 2026-03-31
dependencies: ["sub-spec 1"]
---

# Sub-Spec 3: Notes Overhaul — Grid, Full Editor, Tiptap Fix, @-Mentions, Tags, Link Note Removal

Refined from spec.md — Factory Run 2026-03-31T18-21-40-design-doc.

## Scope

Integrate a Notes Grid into SessionScreen as a tab/section. Create a full-page Note Editor at a dedicated route (`/note/:id/edit` and `/note/new`). Fix `TiptapNoteEditor` to show a toolbar and proper min-height. Fix @-mention to store and display entity names with arrow key navigation. Add custom tag creation to `TagPicker`. Remove `LinkNoteDrawer` and all its UI triggers. Convert `NotesScreen` to a redirect (its route was already changed to redirect in sub-spec 1).

Key existing code:
- `SessionScreen.tsx` (~300 lines): Currently shows session management, timer, combat timeline, quick actions. Needs a Notes Grid section.
- `TiptapNoteEditor.tsx` (~180 lines): Has @-mention and #descriptor support via vanilla DOM popup. Lacks toolbar and arrow key navigation in mention popup.
- `TagPicker.tsx` (43 lines): Static list of predefined tags, no custom input.
- `NotesScreen.tsx` (364 lines): Full notes list with search, grouping. Much of this code can be reused for the Notes Grid.
- `LinkNoteDrawer.tsx`: Used only in `NotesScreen.tsx`. To be deleted.

## Interface Contracts

### Provides
- `src/screens/NoteEditorScreen.tsx`: Full-page note editor route component.
- Updated `SessionScreen.tsx` with Notes Grid section.
- Updated `TiptapNoteEditor.tsx` with toolbar and keyboard-navigable mention popup.
- Updated `TagPicker.tsx` with custom tag input.
- Routes: `/note/:id/edit` and `/note/new`.

### Requires
- From sub-spec 1: Route `/notes` already redirects to `/session?view=notes`. BottomNav no longer shows Notes tab.

### Shared State
- `appSettings` (from `AppStateContext`) stores `showOtherSessionNotes` preference per campaign.
- Notes data accessed via `noteRepository.getNotesByCampaign()` and `noteRepository.getNotesBySession()`.

## Implementation Steps

### Step 1: Add Notes Grid to SessionScreen
- **File:** `src/screens/SessionScreen.tsx` (modify)
- **Action:** modify
- **Pattern:** Follow the existing notes grouping pattern from `src/screens/NotesScreen.tsx` (lines 79-84 for grouping, lines 136-335 for rendering).
- **Changes:**
  1. Add a "Notes" section below the existing session content (after quick actions, before past sessions).
  2. Import `getNotesBySession`, `getNotesByCampaign` from `../../storage/repositories/noteRepository`.
  3. Add state for notes list, filter controls (type filter, tag filter, search query).
  4. Add a "Show notes from other sessions" toggle. Read/write preference from `appSettings` using `useAppState()`. Store as `showOtherSessionNotes` keyed by campaignId.
  5. When toggle is off: show only notes from the active session (`getNotesBySession`).
  6. When toggle is on: show all campaign notes (`getNotesByCampaign`).
  7. Add filter chips for note types (NPC, Location, Generic, Combat, etc.) using the `Chip` component.
  8. Add a search input with debounce (reuse pattern from `NotesScreen.tsx` lines 49-58).
  9. Render notes using `NoteItem` component (import from `../../features/notes/NoteItem`).
  10. Make each note clickable: `onClick={() => navigate(`/note/${note.id}/edit`)}`.
  11. Check for `?view=notes` query param — if present, auto-scroll or expand the Notes Grid section.

### Step 2: Create NoteEditorScreen
- **File:** `src/screens/NoteEditorScreen.tsx` (create)
- **Action:** create
- **Pattern:** Follow `src/screens/SheetScreen.tsx` for screen component pattern (loading state, navigation guard, autosave).
- **Changes:**
  1. Create a full-page editor component that reads `noteId` from route params.
  2. For `/note/new`: create a new empty note on mount, then redirect to `/note/:id/edit`.
  3. For `/note/:id/edit`: load note by ID from `noteRepository`.
  4. Render `TiptapNoteEditor` with full width and toolbar visible.
  5. Add a back button that navigates to previous page (or `/session`).
  6. Add title input field (editable text input).
  7. Add `TagPicker` below the editor for tag management.
  8. Add type selector (NPC, Location, Generic, etc.).
  9. Auto-save changes using the `useAutosave` hook pattern or debounced save.
  10. Pass `campaignId` from `useCampaignContext()` to the editor.

### Step 3: Add routes for NoteEditorScreen
- **File:** `src/routes/index.tsx` (modify)
- **Action:** modify
- **Changes:**
  1. Import `NoteEditorScreen` from `../screens/NoteEditorScreen`.
  2. Add routes inside the `ShellLayout` children:
     ```typescript
     { path: '/note/new', element: <NoteEditorScreen /> },
     { path: '/note/:id/edit', element: <NoteEditorScreen /> },
     ```

### Step 4: Add Tiptap toolbar to TiptapNoteEditor
- **File:** `src/components/notes/TiptapNoteEditor.tsx` (modify)
- **Action:** modify
- **Changes:**
  1. Add a `showToolbar` prop (default `false` for backward compat; NoteEditorScreen passes `true`).
  2. Create a toolbar div above `<EditorContent>` with buttons for:
     - Bold (toggle `toggleBold`)
     - Italic (toggle `toggleItalic`)
     - H2 heading (toggle `toggleHeading({ level: 2 })`)
     - H3 heading (toggle `toggleHeading({ level: 3 })`)
     - Bullet list (toggle `toggleBulletList`)
     - Ordered list (toggle `toggleOrderedList`)
     - Blockquote (toggle `toggleBlockquote`)
     - Link (prompt for URL, then `setLink({ href })`)
  3. Style toolbar buttons as 44px min touch targets with active state highlight.
  4. Add `minHeight` prop (default `undefined`). When set, apply to the editor content area.
  5. For Quick Note drawer usage: pass `showToolbar={true}` and `minHeight="200px"`.

### Step 5: Fix @-mention arrow key navigation
- **File:** `src/components/notes/TiptapNoteEditor.tsx` (modify)
- **Action:** modify
- **Changes:**
  1. In the `createSuggestionRenderer` function, add keyboard navigation state tracking.
  2. Track `selectedIndex` in the renderer closure.
  3. In `onStart`/`onUpdate`: add `data-index` attributes to each button. Apply highlight style to the button at `selectedIndex`.
  4. In `onKeyDown`: handle `ArrowDown` (increment selectedIndex, wrap), `ArrowUp` (decrement, wrap), `Enter` (call `props.command(props.items[selectedIndex])`). Return `true` to prevent editor from handling these keys.
  5. Apply the same pattern to `createDescriptorRenderer`.

### Step 6: Fix @-mention to store and display entity names
- **File:** `src/components/notes/TiptapNoteEditor.tsx` (modify)
- **Action:** modify
- **Changes:**
  1. The mention items already have `{ id, title }` shape. Ensure the `Mention` extension stores `{ id: item.id, label: item.title }` in the node attrs.
  2. In the Mention configuration, ensure `renderLabel` (or equivalent) returns the `label` attr, not the `id`.
  3. This is largely already correct since items are `{ id, title }` — verify the Mention node attrs map `title` to `label`.

### Step 7: Add custom tag input to TagPicker
- **File:** `src/components/notes/TagPicker.tsx` (modify)
- **Action:** modify
- **Changes:**
  1. Add a text input field after the predefined tag buttons. Style as a small input with "+" button or Enter-to-add behavior.
  2. On submit: normalize the tag (lowercase, trim). If it matches an existing predefined tag, toggle that tag instead of creating a duplicate.
  3. Add the custom tag to the displayed list and call `onToggle(normalizedTag)`.
  4. Add a `customTags` prop (optional `string[]`) to show previously created custom tags alongside predefined ones.
  5. Add an `onCreateTag` callback prop for persisting custom tags to campaign-level storage.

### Step 8: Remove LinkNoteDrawer
- **File:** `src/features/notes/LinkNoteDrawer.tsx` (remove)
- **Action:** delete
- **File:** `src/screens/NotesScreen.tsx` (modify)
- **Action:** modify
- **Changes:**
  1. Delete `src/features/notes/LinkNoteDrawer.tsx`.
  2. In `NotesScreen.tsx`: remove the `LinkNoteDrawer` import, the `showLinkNote` state, the "Link Note" button, and the `<LinkNoteDrawer>` render. Since the route already redirects (sub-spec 1), this file may be deleted entirely or kept as a fallback. Prefer keeping it minimal — just a redirect component, or delete it entirely since the route handles the redirect.
  3. Verify no other files import `LinkNoteDrawer` (grep confirmed: only `NotesScreen.tsx` and the file itself).

### Step 9: Verify TypeScript compilation
- **Run:** `npx tsc --noEmit`
- **Expected:** Zero errors.

### Step 10: Commit
- **Stage:** `git add src/screens/SessionScreen.tsx src/screens/NoteEditorScreen.tsx src/routes/index.tsx src/components/notes/TiptapNoteEditor.tsx src/components/notes/TagPicker.tsx src/screens/NotesScreen.tsx`
- **Stage:** `git rm src/features/notes/LinkNoteDrawer.tsx` (if deleted)
- **Message:** `feat: notes overhaul — grid, full editor, toolbar, mentions, custom tags`

## Acceptance Criteria

- `[STRUCTURAL]` SessionScreen contains a Notes Grid section with filter controls (type, tags, search). (REQ-009)
- `[BEHAVIORAL]` "Show notes from other sessions" toggle filters notes and persists preference. (REQ-010)
- `[STRUCTURAL]` Route `/note/:id/edit` exists and renders a full-page note editor with Tiptap toolbar (bold, italic, headings, lists, blockquotes, links). (REQ-012, REQ-013)
- `[BEHAVIORAL]` Quick Note drawer body field renders at ~200px min-height with visible Tiptap toolbar. (REQ-014)
- `[BEHAVIORAL]` @-mention dropdown supports arrow key navigation (Up/Down) and Enter to select. (REQ-016)
- `[STRUCTURAL]` TagPicker has a text input or "+" button for creating custom tags. (REQ-017)
- `[STRUCTURAL]` LinkNoteDrawer is removed. No "Link Note" button appears in any screen. (REQ-018)
- `[MECHANICAL]` `npx tsc --noEmit` passes with no errors. (REQ-028)

## Verification Commands

- **Build:** `npx tsc --noEmit`
- **Tests:** No test framework detected — skip TDD steps, implement directly.
- **Acceptance:**
  - Grep `SessionScreen.tsx` for notes grid rendering (NoteItem import, filter controls).
  - Verify `NoteEditorScreen.tsx` exists and is routed at `/note/:id/edit`.
  - Grep `TiptapNoteEditor.tsx` for toolbar buttons (`toggleBold`, `toggleItalic`, `toggleHeading`).
  - Grep `TiptapNoteEditor.tsx` for `ArrowDown`, `ArrowUp` in `onKeyDown` handler.
  - Grep `TagPicker.tsx` for text input element and `onCreateTag` callback.
  - Verify `LinkNoteDrawer.tsx` is deleted: `ls src/features/notes/LinkNoteDrawer.tsx` should fail.
  - Grep all `.tsx` files for `LinkNoteDrawer` — should return zero results.

## Patterns to Follow

- `src/screens/NotesScreen.tsx`: Notes list with search, grouping, NoteItem rendering — reuse for Notes Grid.
- `src/features/notes/QuickNoteDrawer.tsx`: Drawer pattern for note creation.
- `src/features/notes/NoteItem.tsx`: Note card rendering component.
- `src/components/notes/TiptapNoteEditor.tsx`: Current editor — extend, do not rewrite.
- `src/hooks/useAutosave.ts`: Autosave pattern for NoteEditorScreen.
- `src/context/AppStateContext.tsx`: App settings storage for persisting "show other session notes" preference.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/screens/SessionScreen.tsx` | Modify | Add Notes Grid section with filters |
| `src/screens/NoteEditorScreen.tsx` | Create | Full-page note editor route |
| `src/routes/index.tsx` | Modify | Add /note/:id/edit and /note/new routes |
| `src/components/notes/TiptapNoteEditor.tsx` | Modify | Add toolbar, fix arrow key navigation, fix mention display |
| `src/components/notes/TagPicker.tsx` | Modify | Add custom tag input |
| `src/features/notes/LinkNoteDrawer.tsx` | Delete | Remove Link Note feature |
| `src/screens/NotesScreen.tsx` | Modify | Remove LinkNoteDrawer usage (or delete file entirely) |
