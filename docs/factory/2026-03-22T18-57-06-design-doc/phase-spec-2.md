# Phase 2: Wave 2 — Formula Fix & Mode Guard Refactor

**Phase:** 2 of 3
**Wave:** 2
**Sub-Specs:** SS-03, SS-04
**Dependencies:** Phase 1 complete (SS-02 and SS-01 modify files also touched by SS-04)
**Files Modified:** 4

---

## Dependency Graph

```
Phase 1 (complete) ──┬── SS-03 (Encumbrance Formula Fix)  ── no inter-dep ──┐
                     │                                                        ├── Phase 2 Complete
                     └── SS-04 (Mode Guard Consistency)    ── depends on ─────┘
                              │                               SS-02 (GearScreen changes)
                              └── depends on SS-01 (modeGuards changes)
```

**Intra-phase notes:**
- SS-03 and SS-04 touch different files and are independent of each other.
- SS-04 depends on Phase 1 because SS-02 modified `GearScreen.tsx` and SS-01 modified `modeGuards.ts`.
- SS-03 has no file overlap with Phase 1 — it could theoretically run earlier, but is sequenced here for verification simplicity.

---

## SS-03: Encumbrance Formula Fix

### Implementation Steps

**Step 3.1 — Remove `+ 5` from encumbrance formula**
- **File:** `src/utils/derivedValues.ts`
- **Action:** Change the `computeEncumbranceLimit` function from:
  ```typescript
  return Math.ceil(str / 2) + 5;
  ```
  to:
  ```typescript
  return Math.ceil(str / 2);
  ```
- **Rationale:** Dragonbane RAW defines carrying capacity as STR / 2 rounded up. The `+ 5` is not in the core rules.

### Verification Commands

```
# AC-03-1: Formula is Math.ceil(str / 2) without + 5
grep "Math.ceil" src/utils/derivedValues.ts
# Expected: line containing `Math.ceil(str / 2)` WITHOUT `+ 5`
grep "+ 5" src/utils/derivedValues.ts
# Expected: 0 matches (no +5 anywhere in the function)

# AC-03-2: STR 10 → limit 5
# Math.ceil(10 / 2) = 5 ✓

# AC-03-3: STR 15 → limit 8
# Math.ceil(15 / 2) = Math.ceil(7.5) = 8 ✓

# AC-03-4: STR 3 → limit 2
# Math.ceil(3 / 2) = Math.ceil(1.5) = 2 ✓

# AC-03-5: GearScreen still uses computeEncumbranceLimit
grep "computeEncumbranceLimit" src/screens/GearScreen.tsx
# Expected: >= 1 match (import and usage intact)
```

### Acceptance Criteria Checklist

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-03-1 | `computeEncumbranceLimit` returns `Math.ceil(str / 2)` without `+ 5` | grep derivedValues.ts |
| AC-03-2 | STR 10 → limit 5 | Manual calculation verification |
| AC-03-3 | STR 15 → limit 8 | Manual calculation verification |
| AC-03-4 | STR 3 → limit 2 | Manual calculation verification |
| AC-03-5 | GearScreen encumbrance display still shows "X / Y" with updated limit | grep GearScreen for computeEncumbranceLimit usage |

---

## SS-04: Mode Guard Consistency Refactor

### Implementation Steps

**Step 4.1 — Add `useIsEditMode()` hook to modeGuards.ts**
- **File:** `src/utils/modeGuards.ts`
- **Action:** Add a new exported hook:
  ```typescript
  export function useIsEditMode(): boolean {
    const { settings } = useAppState();
    return settings.mode === 'edit';
  }
  ```
- **Position:** After the existing `useFieldEditable` hook.
- **Note:** Ensure `useAppState` is already imported in modeGuards.ts (it should be, since `useFieldEditable` uses it).

**Step 4.2 — Refactor GearScreen to use `useIsEditMode()`**
- **File:** `src/screens/GearScreen.tsx`
- **Action:**
  1. Add import: `import { useIsEditMode } from '../utils/modeGuards';`
  2. Replace: `const isEditMode = settings.mode === 'edit';` with `const isEditMode = useIsEditMode();`
  3. If `settings` (from `useAppState`) is no longer used for anything else in GearScreen, remove the `useAppState` import and destructuring.
  4. If `useAppState` is still needed (e.g., for `character`, `updateCharacter`), keep it but remove `settings` from destructuring.
- **Critical check:** After SS-02 changes, GearScreen may use `useAppState` for `character` and `updateCharacter`. In that case, keep the import but remove `settings` from the destructured fields.

**Step 4.3 — Refactor MagicScreen to use `useIsEditMode()`**
- **File:** `src/screens/MagicScreen.tsx`
- **Action:**
  1. Add import: `import { useIsEditMode } from '../utils/modeGuards';`
  2. Replace: `const isEditMode = settings.mode === 'edit';` with `const isEditMode = useIsEditMode();`
  3. If `settings` (from `useAppState`) is no longer used for anything else, remove `settings` from destructuring.
  4. If `useAppState` is still needed for other destructured values, keep the import.

### Verification Commands

```
# AC-04-1: useIsEditMode exported from modeGuards
grep "export function useIsEditMode" src/utils/modeGuards.ts
# Expected: 1 match

# AC-04-2: GearScreen imports useIsEditMode from modeGuards
grep "useIsEditMode" src/screens/GearScreen.tsx
# Expected: >= 1 match (import + usage)
grep "import.*useIsEditMode.*modeGuards" src/screens/GearScreen.tsx
# Expected: 1 match

# AC-04-3: MagicScreen imports useIsEditMode from modeGuards
grep "useIsEditMode" src/screens/MagicScreen.tsx
# Expected: >= 1 match (import + usage)
grep "import.*useIsEditMode.*modeGuards" src/screens/MagicScreen.tsx
# Expected: 1 match

# AC-04-4: GearScreen does NOT import useAppState (unless used for other purposes)
grep "useAppState" src/screens/GearScreen.tsx
# Expected: If present, verify it's used for character/updateCharacter only, NOT for settings.mode

# AC-04-5: MagicScreen does NOT import useAppState (unless used for other purposes)
grep "useAppState" src/screens/MagicScreen.tsx
# Expected: If present, verify it's used for non-settings purposes only

# AC-04-2 (negative): GearScreen no longer checks settings.mode directly
grep "settings.mode" src/screens/GearScreen.tsx
# Expected: 0 matches

# AC-04-3 (negative): MagicScreen no longer checks settings.mode directly
grep "settings.mode" src/screens/MagicScreen.tsx
# Expected: 0 matches

# AC-04-6, AC-04-7: Component checks
# Read GearScreen.tsx and MagicScreen.tsx to verify edit mode behavior is unchanged
# (same conditional renders on `isEditMode` variable — just sourced from hook now)
```

### Acceptance Criteria Checklist

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-04-1 | `modeGuards.ts` exports `useIsEditMode()` returning `boolean` | grep modeGuards for export |
| AC-04-2 | GearScreen imports `useIsEditMode` from modeGuards | grep GearScreen for import |
| AC-04-3 | MagicScreen imports `useIsEditMode` from modeGuards | grep MagicScreen for import |
| AC-04-4 | GearScreen does NOT import `useAppState` for settings | grep + read to verify |
| AC-04-5 | MagicScreen does NOT import `useAppState` for settings | grep + read to verify |
| AC-04-6 | GearScreen edit mode behavior unchanged | Read JSX conditionals |
| AC-04-7 | MagicScreen edit mode behavior unchanged | Read JSX conditionals |

---

## Phase 2 Completion Criteria

- [ ] All 5 AC for SS-03 pass
- [ ] All 7 AC for SS-04 pass
- [ ] Total: 12 / 12 acceptance criteria pass
- [ ] No regressions in GearScreen (SS-02 changes preserved, equip toggle works)
- [ ] No regressions in CombatScreen (SS-01 changes preserved)
- [ ] `modeGuards.ts` has both SS-01 addition (deathSuccesses) and SS-04 addition (useIsEditMode)
- [ ] Files modified: `derivedValues.ts`, `modeGuards.ts`, `GearScreen.tsx`, `MagicScreen.tsx`

## Phase 2 → Phase 3 Gate

Phase 3 (verification) may begin when all Phase 2 acceptance criteria pass.
