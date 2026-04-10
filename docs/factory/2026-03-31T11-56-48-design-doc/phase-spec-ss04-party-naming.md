# Phase Spec — SS-04: Party Members — Require Real Name at Creation

**Run:** 2026-03-31T11-56-48-design-doc
**Tier:** 1 (Session Blockers)
**Item:** 4 of 12
**Assigned worker:** single agent — implements ONLY this sub-spec

> **Dependency:** None. This sub-spec has no prerequisites.
> **Note:** SS-03 also touches `useCharacterActions.ts` and `CharacterLibraryScreen.tsx`. Coordinate with SS-03 agent to avoid merge conflicts — implement in separate commits and ensure changes compose cleanly.

---

## Intent

Characters must receive a real name at creation time. An inline rename prompt (text input) appears during the creation flow, and the save button is disabled until the name is non-empty. This prevents "New Adventurer" ghost entries from appearing in the party list.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/screens/CharacterLibraryScreen.tsx` | Modify — add inline name input to creation flow |
| `src/features/characters/useCharacterActions.ts` | Modify — validate name before persisting |

> No other files should be modified. If any other file requires changes, escalate to human before proceeding.

---

## Implementation Steps

1. **Read** both files in full before writing any code:
   - `src/screens/CharacterLibraryScreen.tsx`
   - `src/features/characters/useCharacterActions.ts`
2. **Inline name prompt in `CharacterLibraryScreen.tsx`:**
   - Locate the "create character" action (button/modal/drawer trigger).
   - Before persisting, present an inline text input labeled e.g. `"Character name"`.
   - Add a local state variable for the name input value (e.g., `const [nameInput, setNameInput] = useState('')`).
   - Derive `isNameValid = nameInput.trim().length > 0`.
   - Disable the save/confirm button when `!isNameValid` (apply `disabled` prop + visual style indicating disabled state).
   - On cancel or dismiss: do not persist the character. The "New Adventurer" default is only used as a fallback if the user explicitly cancels (see edge cases below).
   - On confirm with a valid name: call the create action with the trimmed name value.
3. **Validation guard in `useCharacterActions.ts`:**
   - In `createCharacter()`, if the name is empty or whitespace-only after trimming, either:
     - Reject early (throw or return error), or
     - Fall back to `"New Adventurer"` only when the caller explicitly passes `undefined`/`null` (cancel path).
   - The UI layer (step 2) is the primary guard; this is a safety net.
4. **Existing characters:** Do not modify, migrate, or rename any existing characters named "New Adventurer".
5. Use `generateId()` from `utils/ids` and `nowISO()` from `utils/dates` for IDs/timestamps (follow existing patterns).
6. Run `tsc -b` — fix all type errors before committing.
7. Spot-check: create a character → name input appears → save disabled when empty → submitting valid name persists correct name.
8. Commit with a descriptive message referencing Item 4.

---

## Acceptance Criteria

- [ ] **AC4.1** — The creation flow presents a name input field before saving the character.
- [ ] **AC4.2** — The save button is **disabled** when the name field is empty or whitespace-only.
- [ ] **AC4.3** — Submitting a valid name persists the character with that name (not `"New Adventurer"`).
- [ ] **AC4.4** — Canceling the rename falls back to `"New Adventurer"` (no data corruption, no partial save).
- [ ] **AC4.5** — Existing characters named `"New Adventurer"` are **not** affected by this change.
- [ ] **AC4.6** — `tsc -b` reports zero new type errors after this change.

**Edge cases:**
- Name with only whitespace → `trim()` produces empty string → treated as invalid → save blocked.
- Cancel vs. dismiss → both acceptable cancel paths → both fall back gracefully (no character persisted with blank name).

---

## Verification Commands

```bash
# Type-check
tsc -b
```

**Manual spot-check checklist:**
- [ ] Tap "Create Character" → name input is shown before any save action.
- [ ] Leave name empty → save button is visually disabled and non-functional.
- [ ] Type whitespace only → save button remains disabled.
- [ ] Type a valid name → save button becomes enabled.
- [ ] Submit valid name → character saved with correct name (check library list).
- [ ] Cancel the prompt → no character created; existing list unchanged.
- [ ] Existing "New Adventurer" character (if present) renders correctly and is unaffected.

---

## Constraints (Never Violate)

- No Dexie schema version bump.
- No new npm dependencies.
- No changes to existing `useCharacterActions` return interface beyond the validation behavior.
- All inline styles must use `var(--color-*)` CSS custom properties (no raw hex/rgb).
- Touch targets ≥ 44×44px on the new input and buttons.

---

## Shortcuts

- Use `generateId()` from `utils/ids` and `nowISO()` from `utils/dates`.
- Use `useToast()` from `context/ToastContext` for any error notifications.
- Commit after this item for bisectability.
