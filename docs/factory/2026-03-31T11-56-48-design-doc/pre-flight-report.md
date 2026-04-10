# Pre-Flight Report — 2026-03-31T11-56-48-design-doc

**Date:** 2026-03-31 12:10
**Phase Specs Analyzed:** 12
**Status:** CRITICAL_ISSUES

## Summary

Six critical issues were found across the 12 phase specs. The most common problem is incorrect file paths: three sub-specs reference `src/features/character/` (singular) when the actual directory is `src/features/characters/` (plural), and one sub-spec references `src/features/notes/TiptapNoteEditor.tsx` when the actual path is `src/components/notes/TiptapNoteEditor.tsx`. Additionally, SS-10 describes a fix (replacing `===` with `startsWith`) that is already implemented in the codebase. Two advisory issues were found regarding API naming conventions and shared file conflicts.

## Critical Issues

### CRIT-1: SS-03 references wrong path for useCharacterActions.ts
- **Sub-Spec:** 3 -- Character Creation: No Auto-Activate (Except First)
- **Type:** missing file (wrong path)
- **Detail:** Phase spec SS-03 lists `src/features/character/useCharacterActions.ts` in its Files to Modify table (line 23). The actual file path is `src/features/characters/useCharacterActions.ts` (plural "characters"). The directory `src/features/character/` does not exist. An agent following the spec literally will fail to find the file.
- **Impact:** Agent will report a missing file and either fail or escalate unnecessarily.
- **Suggested Fix:** Update the Files to Modify table in SS-03 to use `src/features/characters/useCharacterActions.ts`.

### CRIT-2: SS-04 references wrong path for useCharacterActions.ts
- **Sub-Spec:** 4 -- Party Members: Require Real Name at Creation
- **Type:** missing file (wrong path)
- **Detail:** Phase spec SS-04 lists `src/features/character/useCharacterActions.ts` in its Files to Modify table (line 24). The actual file path is `src/features/characters/useCharacterActions.ts` (plural "characters"). Same issue as CRIT-1.
- **Impact:** Agent will report a missing file and either fail or escalate unnecessarily.
- **Suggested Fix:** Update the Files to Modify table in SS-04 to use `src/features/characters/useCharacterActions.ts`.

### CRIT-3: SS-10 references wrong path for CharacterSubNav.tsx
- **Sub-Spec:** 10 -- Character Sub-Nav Active Detection
- **Type:** missing file (wrong path)
- **Detail:** Phase spec SS-10 lists `src/features/character/CharacterSubNav.tsx` in its Files to Modify table (line 22). The actual file is located at `src/components/shell/CharacterSubNav.tsx`. The path `src/features/character/CharacterSubNav.tsx` does not exist.
- **Impact:** Agent will report a missing file and either fail or escalate unnecessarily.
- **Suggested Fix:** Update the Files to Modify table in SS-10 to use `src/components/shell/CharacterSubNav.tsx`.

### CRIT-4: SS-10 describes a fix that is already implemented
- **Sub-Spec:** 10 -- Character Sub-Nav Active Detection
- **Type:** implementation step references code that no longer exists (already fixed)
- **Detail:** SS-10 instructs the agent to "replace exact `===` path comparison with `pathname.startsWith(navItem.path)`". However, `src/components/shell/CharacterSubNav.tsx` line 27 already reads: `const isActive = location.pathname === to || location.pathname.startsWith(to + '/');`. The `startsWith` logic is already present with a proper trailing-slash guard. The described fix is a no-op.
- **Impact:** The agent will either make a redundant change or be confused that the "bug" doesn't exist. The acceptance criteria (AC10.1, AC10.2) are already satisfied by the current code.
- **Suggested Fix:** Either remove SS-10 entirely (it is already done), or redefine the acceptance criteria to verify-only (like SS-11). If there is a remaining issue with the sub-nav that the current implementation does not address, clarify the specific failing scenario.

### CRIT-5: SS-05 references wrong path for TiptapNoteEditor.tsx
- **Sub-Spec:** 5 -- Inline #descriptor Chips
- **Type:** missing file (wrong path)
- **Detail:** Phase spec SS-05 lists `src/features/notes/TiptapNoteEditor.tsx` in its Files to Modify table (line 31) and in Implementation Step 1 (line 63). The actual file is located at `src/components/notes/TiptapNoteEditor.tsx`. The path `src/features/notes/TiptapNoteEditor.tsx` does not exist.
- **Impact:** Agent will fail to find the file to modify and either fail or escalate. This is the highest-complexity sub-spec (14 acceptance criteria), so a path error here is especially costly.
- **Suggested Fix:** Update all references in SS-05 from `src/features/notes/TiptapNoteEditor.tsx` to `src/components/notes/TiptapNoteEditor.tsx`.

### CRIT-6: SS-03 references `updateSettings()` API that does not exist in the target file
- **Sub-Spec:** 3 -- Character Creation: No Auto-Activate (Except First)
- **Type:** interface mismatch
- **Detail:** SS-03 instructs the agent to call `updateSettings({ activeCharacterId: newCharacter.id })` after character creation. However, `useCharacterActions.ts` does not import or have access to `updateSettings()`. The actual API for setting the active character is `setCharacter(id)` from `useActiveCharacter()` (as used in `CharacterLibraryScreen.tsx` line 63: `await setCharacter(id)`). The `useCharacterActions` hook already imports `useActiveCharacter` but only uses `clearCharacter` and `character` from it -- it does not destructure `setCharacter`. The spec also says to use `useToast()` but the hook currently has no toast integration.
- **Impact:** An agent following the spec literally will try to call a non-existent `updateSettings()` function, causing a type error. The implementation is feasible but requires using `setCharacter` from `useActiveCharacter` instead.
- **Suggested Fix:** Update SS-03 to reference `setCharacter(newChar.id)` from `useActiveCharacter()` instead of `updateSettings({ activeCharacterId: newCharacter.id })`. Also note that `useToast` will need to be added to the hook's dependencies (it is not currently imported in `useCharacterActions.ts`).

## Advisory Issues

### ADV-1: SS-03 and SS-04 both modify the same two files
- **Sub-Spec:** 3 and 4
- **Type:** conflicting changes (low risk, acknowledged)
- **Detail:** Both SS-03 and SS-04 modify `src/features/characters/useCharacterActions.ts` and `src/screens/CharacterLibraryScreen.tsx`. Both specs acknowledge this overlap and instruct agents to coordinate. However, both modify the `createCharacter()` function and the `handleCreate()` caller in `CharacterLibraryScreen.tsx`. SS-03 adds post-create active-character logic; SS-04 adds a name input gate before create. These changes must compose cleanly.
- **Recommendation:** Execute SS-04 before SS-03, since SS-04 changes the creation flow (adds name input) and SS-03 adds post-create behavior. Running SS-04 first establishes the new creation flow, then SS-03 can hook into its success path. Alternatively, have a single agent implement both.

### ADV-2: SS-02 and SS-07 both modify SessionQuickActions.tsx
- **Sub-Spec:** 2 and 7
- **Type:** conflicting changes (low risk, acknowledged)
- **Detail:** SS-02 modifies `SessionQuickActions.tsx` for PartyPicker drawer improvements. SS-07 modifies the same file for touch target fixes on chip elements outside the PartyPicker drawer. SS-07 acknowledges it should not re-patch PartyPicker elements. Low conflict risk since they target different sections of the file.
- **Recommendation:** Execute SS-02 before SS-07 (already the natural tier order). SS-07 should read the file after SS-02's changes are committed.

### ADV-3: SS-06 -- NotesScreen does not currently import activeSession
- **Sub-Spec:** 6 -- Link Note: Hide When No Active Session
- **Type:** implementation guidance gap
- **Detail:** `NotesScreen.tsx` uses `useCampaignContext()` but currently only destructures `activeCampaign` from it (line 15). The `activeSession` property is available in the context (confirmed in `CampaignContext.tsx` line 302) but is not currently destructured in `NotesScreen.tsx`. The phase spec correctly notes to "read `activeSession` from context" and suggests adding it if not present, so this is not a blocker.
- **Recommendation:** No action needed -- the spec's implementation step 2 already covers this case.

### ADV-4: SS-01 -- "Quick Log chip row" is inside SessionQuickActions, not directly in SessionScreen
- **Sub-Spec:** 1 -- SessionQuickActions Overlay Blocks CombatTimeline
- **Type:** implementation guidance gap
- **Detail:** The spec says to hide "the Quick Log chip row" by wrapping it in a conditional in `SessionScreen.tsx`. In the actual code, the chip row is rendered inside the `<SessionQuickActions />` component (line 209 of SessionScreen.tsx). The simplest approach is to wrap the entire `<SessionQuickActions />` div in `{!showCombatView && ...}`, which the agent can figure out. However, the spec says not to modify `SessionQuickActions.tsx`, so the agent must hide the entire component rather than individual chips.
- **Recommendation:** The approach of wrapping the `<SessionQuickActions />` container div (lines 208-210) in a `{!showCombatView && ...}` conditional is straightforward and does not require modifying `SessionQuickActions.tsx`. No spec change needed.

### ADV-5: SS-09 and SS-01 both modify SessionScreen.tsx
- **Sub-Spec:** 1 and 9
- **Type:** conflicting changes (low risk)
- **Detail:** Both sub-specs modify `src/screens/SessionScreen.tsx`. SS-01 adds a conditional render for the chip row (Tier 1). SS-09 changes the timer interval (Tier 3). These changes target completely different sections of the file (line ~208 vs line ~56) and will not conflict.
- **Recommendation:** No action needed. Natural tier ordering handles this.

### ADV-6: SS-08 -- CombatTimeline form pre-fill feasibility
- **Sub-Spec:** 8 -- Combat Event Form Auto-Fill
- **Type:** efficiency
- **Detail:** `CombatTimeline.tsx` already has `activeCharacter` available via `useActiveCharacter()` (line 47). The `EMPTY_FORM` constant (line 38) initializes `actorName: ''`. The spec asks to set the default to the active character name. However, `EMPTY_FORM` is a module-level constant and `activeCharacter` is only available inside the component. The agent will need to initialize form state inside the component rather than using the module constant, or compute initial state dynamically. This is straightforward but worth noting.
- **Recommendation:** Initialize `eventForm` state with a computed initial value: `useState<EventFormState>({ ...EMPTY_FORM, actorName: activeCharacter?.name ?? '' })`. The agent should handle this naturally.

### ADV-7: Past session export buttons have minHeight 36px, below 44px minimum
- **Sub-Spec:** 7 -- Touch Target Audit
- **Type:** known violation not listed in spec
- **Detail:** In `SessionScreen.tsx` lines 356-378, the past session export buttons (`.md` and `.zip`) have `minHeight: '36px'` which is below the 44px minimum. These are not listed as known violators in SS-07 but should be caught during the scan-driven audit.
- **Recommendation:** SS-07 is scan-driven and explicitly allows discovering additional files. The agent should catch these during audit. No spec change needed.

## File Conflict Map

| File | Sub-Specs Touching | Conflict Risk |
|------|-------------------|---------------|
| `src/screens/SessionScreen.tsx` | SS-01, SS-09 | none (different sections) |
| `src/features/session/SessionQuickActions.tsx` | SS-02, SS-07 | low (different sections, acknowledged) |
| `src/features/characters/useCharacterActions.ts` | SS-03, SS-04 | HIGH (both modify createCharacter flow) |
| `src/screens/CharacterLibraryScreen.tsx` | SS-03, SS-04 | HIGH (both modify handleCreate flow) |
| `src/features/notes/NoteItem.tsx` | SS-05, SS-07 | low (SS-05 adds chip row, SS-07 fixes touch targets) |
| `src/components/notes/TiptapNoteEditor.tsx` | SS-05 | none |
| `src/features/notes/useNoteSearch.ts` | SS-05 | none |
| `src/screens/NotesScreen.tsx` | SS-06 | none |
| `src/features/combat/CombatTimeline.tsx` | SS-08 | none |
| `src/components/shell/CharacterSubNav.tsx` | SS-10 | none |
| `tests/e2e_full_test.py` | SS-11, SS-12 | low (SS-11 reads only, SS-12 modifies) |

## Interface Contract Verification

| Provider (Sub-Spec) | Consumer (Sub-Spec) | Contract | Status |
|---------------------|---------------------|----------|--------|
| SS-05 (extractDescriptors) | SS-05 (NoteItem chip row) | `extractDescriptors(body): string[]` | MATCH |
| SS-05 (extractDescriptors) | SS-05 (useNoteSearch descriptors field) | `extractDescriptors(body): string[]` | MATCH |
| SS-05 (descriptorMentionExtension) | SS-05 (TiptapNoteEditor registration) | `DescriptorMention` TipTap extension | MATCH |
| SS-05 (useDescriptorSuggestions) | SS-05 (TiptapNoteEditor suggestion items) | `getSuggestions(query): string[]` | MATCH |
| SS-05 (descriptor chips created) | SS-12 (E2E tests for descriptors) | Descriptor chip creation and render | MATCH |
| SS-02 (PartyPicker sticky + pre-select) | SS-12 (E2E tests for PartyPicker) | Sticky header and pre-selection behavior | MATCH |
| SS-04 (name input in creation) | SS-03 (post-create active logic) | `createCharacter()` return value and flow | MATCH (if ordered SS-04 before SS-03) |

## Verdict

CRITICAL_ISSUES: 6 critical issues must be resolved before proceeding. See details above. Five are incorrect file paths in phase specs (easily fixed by correcting paths). One (CRIT-4) indicates SS-10's described fix is already implemented and the sub-spec needs to be either removed or converted to verification-only.
