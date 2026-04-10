# Bug Fixes from Full Coverage Test Run

Fix 3 bugs discovered during the Forge Test Run (49 scenarios, 44 PASS, 3 FAIL, 2 PARTIAL).

## Bug 1: Missing Search UI on Notes Screen (SR-02 FAIL)

**Problem:** The `useNoteSearch` hook is fully implemented in `src/features/notes/useNoteSearch.ts` with MiniSearch integration (field weighting: title:2, tags:1.5, body:1), but it is NOT imported or used by any UI component. The Notes screen (`src/screens/NotesScreen.tsx`) has no search input rendered.

**Fix Required:**
- Add a search input to the Notes screen action bar area
- Import and use `useNoteSearch` hook to filter displayed notes
- Search should filter across all note groups (NPCs, Notes, Locations, etc.)
- Results should update as the user types (debounced)
- Empty search shows all notes (current behavior)
- Show "No results" when search has no matches

**Acceptance Criteria:**
- A search input is visible on the Notes screen
- Typing in the search input filters notes using MiniSearch full-text search
- Clearing the search shows all notes again
- `npx tsc --noEmit` passes
- `npm run build` succeeds

## Bug 2: Incomplete Clear All Data (DB-11 FAIL)

**Problem:** The "Clear All Data" function in `src/screens/SettingsScreen.tsx` only clears 3 of 12 IndexedDB tables: `characters`, `referenceNotes`, and `appSettings`. The remaining 9 tables survive: `campaigns`, `sessions`, `notes`, `entityLinks`, `parties`, `partyMembers`, `attachments`, `metadata`, and `systems`.

**Fix Required:**
- Update the clear data handler in SettingsScreen to also clear: `campaigns`, `sessions`, `notes`, `entityLinks`, `parties`, `partyMembers`, `attachments`
- `metadata` and `systems` tables can optionally be preserved (they contain system-level data, not user content)
- Use the Dexie `db.tableName.clear()` pattern already used for the 3 existing tables
- After clearing, the app should return to initial state (no campaigns, no sessions, no notes, no parties)

**Acceptance Criteria:**
- "Clear All Data" clears all user-content tables (at minimum: characters, referenceNotes, appSettings, campaigns, sessions, notes, entityLinks, parties, partyMembers, attachments)
- After clearing, navigating to /session shows "No campaigns" state
- After clearing, navigating to /notes shows empty state
- After clearing, navigating to /library shows empty character library
- `npx tsc --noEmit` passes
- `npm run build` succeeds

## Bug 3: Orphaned Party Members on Character Delete (EC-08 PARTIAL)

**Problem:** When a character is deleted from the Character Library, their `partyMembers` records are NOT cascade-deleted. This leaves orphaned references in the `partyMembers` table. The Manage Party drawer then shows raw UUIDs instead of character names for these orphaned members.

**Fix Required:**
- In the character delete handler (likely `src/features/characters/useCharacterActions.ts` or `src/screens/CharacterLibraryScreen.tsx`), add cascade deletion of partyMembers records where `linkedCharacterId` matches the deleted character's ID
- Use `db.partyMembers.where('linkedCharacterId').equals(characterId).delete()` or equivalent
- Additionally, in the Manage Party drawer (`src/features/campaign/ManagePartyDrawer.tsx`), add graceful handling for orphaned members: if a party member's linked character cannot be found, show "Unknown character" instead of a raw UUID

**Acceptance Criteria:**
- Deleting a character also removes all their partyMembers records
- If any orphaned partyMembers exist (from before the fix), the Manage Party UI shows "Unknown character" instead of a raw UUID
- No console errors when viewing party with orphaned members
- `npx tsc --noEmit` passes
- `npm run build` succeeds

## Test Plan Reference

Re-run these failing scenarios after fixes:
- `docs/tests/2026-03-31-skaldmark-full-coverage/.holdout/SR-02-minisearch-fulltext.md`
- `docs/tests/2026-03-31-skaldmark-full-coverage/.holdout/DB-11-clear-all-data.md`
- `docs/tests/2026-03-31-skaldmark-full-coverage/.holdout/EC-08-orphaned-party-members.md`
