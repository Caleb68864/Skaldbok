---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 8
title: "Character Library Screen"
date: 2026-03-22
dependencies: ["6", "7"]
---

# Sub-Spec 8: Character Library Screen

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Build the full Character Library screen replacing the placeholder. Support listing all stored characters, creating a new blank character (from the Dragonbane template), duplicating an existing character, deleting a character with a confirmation dialog, and setting a character as active (which persists activeCharacterId and navigates to the Sheet screen). The currently active character should be visually distinguished in the list.

## Interface Contracts

### Provides
- `src/screens/CharacterLibraryScreen.tsx`: Full library screen component
- `src/features/characters/useCharacterActions.ts`: Exports `{ createCharacter, duplicateCharacter, deleteCharacter }` action hooks/functions
- `src/features/characters/characterMappers.ts`: Exports `createBlankCharacter(systemId)` that generates a new CharacterRecord from the blank template

### Requires
- From sub-spec 6: `characterRepository` (getAll, getById, save, remove)
- From sub-spec 7: `useActiveCharacter()` hook (setCharacter, clearCharacter), `useAppState()` hook
- From sub-spec 5: Blank character template structure (used as basis for new characters)
- From sub-spec 2: `Card`, `Button`, `Modal` primitive components

### Shared State
- IndexedDB `characters` store: read/write
- AppStateContext: `activeCharacterId` for visual distinction and navigation

## Implementation Steps

### Step 1: Create characterMappers utility
- **File:** `src/features/characters/characterMappers.ts`
- **Action:** create
- **Changes:** Export `createBlankCharacter(systemId: string): CharacterRecord` that:
  1. Imports the blank template structure
  2. Generates a new `id` via `generateId()`
  3. Sets `createdAt` and `updatedAt` to `nowISO()`
  4. Returns a fresh CharacterRecord

### Step 2: Create useCharacterActions hook
- **File:** `src/features/characters/useCharacterActions.ts`
- **Action:** create
- **Changes:** Export hook returning:
  - `createCharacter()`: Creates blank character, saves to DB, returns the new character
  - `duplicateCharacter(id: string)`: Loads character by id, clones with new id + " (Copy)" appended to name, saves
  - `deleteCharacter(id: string)`: Removes from DB. If this was the active character, clears activeCharacterId

### Step 3: Build CharacterLibraryScreen
- **File:** `src/screens/CharacterLibraryScreen.tsx`
- **Action:** modify (replace placeholder)
- **Changes:**
  - On mount, load all characters via `characterRepository.getAll()`
  - Render character list using `Card` components, each showing: name, kin, profession, last updated
  - Active character card has a distinct border/highlight
  - "Create Character" button at top/bottom
  - Each card has actions: "Set Active" (if not active), "Duplicate", "Delete"
  - Delete triggers a `Modal` confirmation dialog: "Delete {name}? This cannot be undone."
  - "Set Active" calls `useActiveCharacter().setCharacter(id)` then navigates to `/sheet` via React Router
  - Empty state: Show a message "No characters yet" with a prominent "Create your first character" button
  - Refresh the character list after any mutation (create, duplicate, delete)

### Step 4: Verify
- **Run:** `npx tsc --noEmit && npm run build`
- **Expected:** Passes.

### Step 5: Commit
- **Stage:** `git add src/screens/CharacterLibraryScreen.tsx src/features/characters/`
- **Message:** `feat: character library screen`

## Acceptance Criteria

- `[BEHAVIORAL]` Creating a new character adds it to the library list and it persists after reload (REQ-019)
- `[BEHAVIORAL]` Duplicating a character creates a new entry with a different id but identical data (REQ-019)
- `[BEHAVIORAL]` Deleting a character shows a confirmation dialog before removal (REQ-019, REQ-041)
- `[BEHAVIORAL]` Tapping "set active" on a character persists activeCharacterId and navigates to the Sheet screen (REQ-020)
- `[STRUCTURAL]` The currently active character is visually distinguished in the library list (REQ-019)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework -- verify in browser.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - Create character: Click "Create", verify it appears in list, reload, verify it persists
  - Duplicate: Click duplicate on existing character, verify new entry with different id
  - Delete: Click delete, verify confirmation dialog appears, confirm, verify character removed
  - Set active: Click "Set Active", verify navigation to /sheet and activeCharacterId in IndexedDB

## Patterns to Follow

- Use React Router's `useNavigate()` for programmatic navigation after setting active character.
- Character list should be loaded in a `useEffect` on mount and re-fetched after mutations.
- Confirmation dialogs use the `Modal` primitive from sub-spec 2.
- Character cards use the `Card` primitive from sub-spec 2.

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/features/characters/characterMappers.ts | Create | Blank character factory function |
| src/features/characters/useCharacterActions.ts | Create | Character CRUD action hooks |
| src/screens/CharacterLibraryScreen.tsx | Modify | Full library screen replacing placeholder |
