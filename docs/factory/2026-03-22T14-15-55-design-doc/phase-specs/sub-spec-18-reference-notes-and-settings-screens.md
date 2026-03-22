---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 18
title: "Reference Notes and Settings Screens"
date: 2026-03-22
dependencies: ["2", "6", "7"]
---

# Sub-Spec 18: Reference Notes and Settings Screens

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Build the Reference screen with user-authored shorthand note cards stored in IndexedDB. No bundled copyrighted rules text. Build the Settings screen with theme selection, mode preference, and links to import/export operations. Reference notes support create, edit, and delete.

## Interface Contracts

### Provides
- `src/screens/ReferenceScreen.tsx`: Full reference screen with note card CRUD
- `src/screens/SettingsScreen.tsx`: Full settings screen with theme, mode, and import/export helpers

### Requires
- From sub-spec 2: `Card`, `Button`, `Modal`, `Drawer` primitives, `useTheme()` hook
- From sub-spec 6: `referenceNoteRepository` (getAll, save, remove)
- From sub-spec 7: `useAppState()` for settings

### Shared State
- IndexedDB `referenceNotes` store
- AppSettings for theme and mode preferences

## Implementation Steps

### Step 1: Build ReferenceScreen
- **File:** `src/screens/ReferenceScreen.tsx`
- **Action:** modify (replace placeholder)
- **Changes:**
  - Load all reference notes from `referenceNoteRepository.getAll()` on mount
  - Display as a grid/list of `Card` components, each showing title and content preview
  - "Add Note" button opens a Drawer with title (text input) and content (textarea) fields
  - Tap a note card to edit (opens same Drawer with existing data)
  - Delete button on each card with confirmation Modal
  - Empty state: "No reference notes yet. Add your own shorthand notes for quick reference during play."
  - No bundled content -- all notes are user-created
  - Content is rendered as plain text (no HTML, no markdown rendering) to prevent XSS from imported data

### Step 2: Build SettingsScreen
- **File:** `src/screens/SettingsScreen.tsx`
- **Action:** modify (replace placeholder)
- **Changes:**
  - Theme selection: Three large buttons or cards for Dark / Parchment / Light, active theme highlighted. Calls `useTheme().setTheme()` and persists via `updateSettings()`
  - Mode preference: Toggle or selector for default mode (Play / Edit). Persists to settings.
  - Import/Export section: Buttons that navigate to /library (where import/export lives) or directly trigger the file picker
  - App info section: "Skaldbok v1.0", link to project repo if any
  - Data section: "Clear All Data" button with double-confirmation (Modal asking "Are you sure?" then "This will delete all characters and notes. Type DELETE to confirm.")

### Step 3: Verify
- **Run:** `npx tsc --noEmit && npm run build`
- **Expected:** Passes.

### Step 4: Commit
- **Stage:** `git add src/screens/ReferenceScreen.tsx src/screens/SettingsScreen.tsx`
- **Message:** `feat: reference notes and settings screens`

## Acceptance Criteria

- `[BEHAVIORAL]` Creating a reference note card persists it after reload (REQ-038)
- `[BEHAVIORAL]` Editing and deleting reference notes works correctly (REQ-038)
- `[BEHAVIORAL]` The Settings screen allows changing the theme and the change takes effect immediately (REQ-039)
- `[STRUCTURAL]` The Settings screen includes links/buttons for import and export operations (REQ-039)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework -- verify in browser.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - Create note: Add a reference note, reload, verify it persists
  - Edit note: Change note title, reload, verify change persisted
  - Delete note: Delete a note with confirmation, verify removed
  - Theme change: Change theme on Settings screen, verify immediate effect, reload, verify persisted
  - Import/export links: Verify Settings screen has buttons for import/export

## Patterns to Follow

- Reference notes use the same `Drawer` pattern as gear/spell editors for create/edit.
- Note content is rendered as plain text -- use `white-space: pre-wrap` CSS, never `dangerouslySetInnerHTML`.
- Settings screen uses `Card` components for each settings group (Theme, Mode, Data, About).
- Dangerous operations (clear all data) require multi-step confirmation.

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/screens/ReferenceScreen.tsx | Modify | Full reference notes screen |
| src/screens/SettingsScreen.tsx | Modify | Full settings screen |
