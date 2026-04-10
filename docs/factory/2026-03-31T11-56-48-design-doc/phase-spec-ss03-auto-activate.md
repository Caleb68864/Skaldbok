# Phase Spec — SS-03: Character Creation — No Auto-Activate (Except First)

**Run:** 2026-03-31T11-56-48-design-doc
**Tier:** 1 (Session Blockers)
**Item:** 3 of 12
**Assigned worker:** single agent — implements ONLY this sub-spec

> **Dependency:** None. This sub-spec has no prerequisites. May be implemented concurrently with other Tier 1 items.
> **Note:** SS-04 also touches character creation flow. Coordinate with SS-04 agent to avoid merge conflicts in the same files — implement in separate commits.

---

## Intent

The first character created automatically becomes the active character. All subsequent characters show a toast with a "Set Active?" action button instead of auto-activating. This prevents unexpected active-character switches during a session.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/features/characters/useCharacterActions.ts` | Modify — post-create active character logic |
| `src/screens/CharacterLibraryScreen.tsx` | Modify — wire toast/action button |

> No other files should be modified. If any other file requires changes, escalate to human before proceeding.

---

## Implementation Steps

1. **Read** both files in full before writing any code:
   - `src/features/characters/useCharacterActions.ts`
   - `src/screens/CharacterLibraryScreen.tsx`
2. **Locate the `createCharacter()` success path** in `useCharacterActions.ts`.
3. **After a successful create:**
   - Check whether there is currently an active character via `useActiveCharacter()` from `context/ActiveCharacterContext`.
   - **Branch A — no active character (`character` is null):**
     - Call `setCharacter(newCharacter.id)` from `useActiveCharacter()` immediately. No toast.
   - **Branch B — active character already set:**
     - Do NOT call `setCharacter()`.
     - Call `useToast()` with message `"Character created — Set Active?"` and an action button labeled `"Set Active"`.
     - The action button's `onAction` handler calls `setCharacter(newCharacter.id)` from `useActiveCharacter()`.
4. **Failure path:** If `createCharacter()` throws or returns an error, do not call `setCharacter()` under any branch.
5. **Toast dismissal:** If the user dismisses the toast without tapping "Set Active?", `active character` remains unchanged. No additional cleanup needed.
6. Use `useToast()` from `context/ToastContext`.
7. Use `generateId()` from `utils/ids` and `nowISO()` from `utils/dates` for any ID/timestamp generation (follow existing patterns in the file).
8. Run `tsc -b` — fix all type errors before committing.
9. Spot-check: create first character → auto-activates. Create second character → toast appears with action button. Tap "Set Active?" → second character becomes active.
10. Commit with a descriptive message referencing Item 3.

---

## Acceptance Criteria

- [ ] **AC3.1** — Creating the very first character sets it as active immediately with no toast.
- [ ] **AC3.2** — Creating a second (or later) character shows a toast with a `"Set Active?"` action button.
- [ ] **AC3.3** — Tapping "Set Active?" in the toast updates `active character` to the new character's ID.
- [ ] **AC3.4** — Creation failures do not modify `active character` (no settings write on error).
- [ ] **AC3.5** — `tsc -b` reports zero new type errors after this change.

**Edge cases:**
- Mid-flow failure → no `updateSettings()` call whatsoever.
- Toast dismissed without action → `active character` unchanged.

---

## Verification Commands

```bash
# Type-check
tsc -b
```

**Manual spot-check checklist:**
- [ ] Delete all characters → create one → becomes active immediately, no toast.
- [ ] Create a second character → toast appears with "Set Active?" button.
- [ ] Tap "Set Active?" → second character is now active.
- [ ] Dismiss toast without action → first character remains active.
- [ ] Simulate creation error (e.g., temporarily break the action) → `active character` unchanged.

---

## Constraints (Never Violate)

- No Dexie schema version bump.
- No new npm dependencies.
- No changes to `useCharacterActions` prop/return interface beyond the new behavior.
- Use `useToast()` from `context/ToastContext` exclusively for notifications.

---

## Shortcuts

- Use `useToast()` from `context/ToastContext`.
- Use `generateId()` from `utils/ids` and `nowISO()` from `utils/dates` (follow existing file patterns).
- Commit after this item for bisectability.
