# Phase 3: Verification & Regression Check

**Phase:** 3 of 3
**Wave:** Post-implementation
**Sub-Specs:** All (SS-01 through SS-05)
**Dependencies:** Phase 1 and Phase 2 complete
**Files Modified:** 0 (read-only verification phase)

---

## Dependency Graph

```
Phase 1 (SS-01, SS-02, SS-05) ──┐
                                 ├── Phase 3: Full Verification
Phase 2 (SS-03, SS-04)         ──┘
```

---

## Purpose

This phase performs a comprehensive cross-cutting verification of all 38 acceptance criteria, checks for regressions, and validates the overall coherence of changes across all modified files.

---

## Step 1: Full Acceptance Criteria Sweep

Run ALL verification commands from Phase 1 and Phase 2 against the final codebase state. Each criterion must pass in the final state (not just at the time of implementation).

### SS-01 Verification (8 criteria)

| ID | Command | Expected |
|----|---------|----------|
| AC-01-1 | `grep "deathSuccesses" src/systems/dragonbane/system.json` | Match with defaultMax: 3 |
| AC-01-2 | Read CombatScreen.tsx — success circles in DOWN block | JSX present |
| AC-01-3 | `grep "color-success" src/screens/CombatScreen.tsx` | >= 1 match |
| AC-01-4 | Read CombatScreen.tsx — click handler on success circles | Handler present |
| AC-01-5 | Read CombatScreen.tsx — "Stabilized!" text | Conditional render present |
| AC-01-6 | Read CombatScreen.tsx — reset handler clears both resources | Both set to 0 |
| AC-01-7 | `grep "deathSuccesses" src/utils/modeGuards.ts` | >= 1 match |
| AC-01-8 | `grep "deathSuccesses.*??" src/screens/CombatScreen.tsx` | Fallback present |

### SS-02 Verification (11 criteria)

| ID | Command | Expected |
|----|---------|----------|
| AC-02-1 | Read GearScreen.tsx — armor Drawer with form fields | Name, Rating, Features |
| AC-02-2 | Read GearScreen.tsx — helmet Drawer (shared or separate) | Name, Rating, Features |
| AC-02-3 | Read GearScreen.tsx — "Add Armor" button opens Drawer | onClick handler |
| AC-02-4 | Read GearScreen.tsx — "Add Helmet" button opens Drawer | onClick handler |
| AC-02-5 | Read GearScreen.tsx — Edit button for armor opens Drawer | onClick + useEffect |
| AC-02-6 | Read GearScreen.tsx — Edit button for helmet opens Drawer | onClick + useEffect |
| AC-02-7 | Read GearScreen.tsx — save handler calls updateCharacter | armor fields persisted |
| AC-02-8 | Read GearScreen.tsx — save handler works for helmet | helmet fields persisted |
| AC-02-9 | Read GearScreen.tsx — Remove button sets to null, edit mode only | Conditional render |
| AC-02-10 | Read GearScreen.tsx — equip toggle unchanged | Toggle code intact |
| AC-02-11 | `grep "name: 'Armor', rating: 2" src/screens/GearScreen.tsx` | 0 matches |

### SS-03 Verification (5 criteria)

| ID | Command | Expected |
|----|---------|----------|
| AC-03-1 | `grep "+ 5" src/utils/derivedValues.ts` | 0 matches |
| AC-03-2 | Manual: ceil(10/2) = 5 | Correct |
| AC-03-3 | Manual: ceil(15/2) = 8 | Correct |
| AC-03-4 | Manual: ceil(3/2) = 2 | Correct |
| AC-03-5 | `grep "computeEncumbranceLimit" src/screens/GearScreen.tsx` | >= 1 match |

### SS-04 Verification (7 criteria)

| ID | Command | Expected |
|----|---------|----------|
| AC-04-1 | `grep "export function useIsEditMode" src/utils/modeGuards.ts` | 1 match |
| AC-04-2 | `grep "useIsEditMode" src/screens/GearScreen.tsx` | >= 1 match |
| AC-04-3 | `grep "useIsEditMode" src/screens/MagicScreen.tsx` | >= 1 match |
| AC-04-4 | `grep "settings.mode" src/screens/GearScreen.tsx` | 0 matches |
| AC-04-5 | `grep "settings.mode" src/screens/MagicScreen.tsx` | 0 matches |
| AC-04-6 | Read GearScreen.tsx — isEditMode conditionals unchanged | Same behavior |
| AC-04-7 | Read MagicScreen.tsx — isEditMode conditionals unchanged | Same behavior |

### SS-05 Verification (7 criteria)

| ID | Command | Expected |
|----|---------|----------|
| AC-05-1 | `grep "/reference" src/components/layout/BottomNav.tsx` | >= 1 match |
| AC-05-2 | `grep "/settings" src/components/layout/BottomNav.tsx` | >= 1 match |
| AC-05-3 | Read BottomNav.tsx — NavLink to="/reference" | Present |
| AC-05-4 | Read BottomNav.tsx — NavLink to="/settings" | Present |
| AC-05-5 | `grep "bottom-nav__item" src/components/layout/BottomNav.tsx` | Matches for 7 items |
| AC-05-6 | `grep "bottom-nav__item--active" src/components/layout/BottomNav.tsx` | Matches for 7 items |
| AC-05-7 | Manual visual check: 7 items on 768px+ | No overflow |

---

## Step 2: Regression Checks

### 2.1 — Import Integrity
Verify no broken imports across modified files:

```
# All modified files should have valid imports
grep "^import" src/screens/CombatScreen.tsx
grep "^import" src/screens/GearScreen.tsx
grep "^import" src/screens/MagicScreen.tsx
grep "^import" src/utils/modeGuards.ts
grep "^import" src/utils/derivedValues.ts
grep "^import" src/components/layout/BottomNav.tsx
```

### 2.2 — No Removed Exports
Verify existing exports from modified utility files are still present:

```
# modeGuards.ts still exports existing functions
grep "export.*isFieldEditableInPlayMode" src/utils/modeGuards.ts
grep "export.*useFieldEditable" src/utils/modeGuards.ts
# Expected: both present (not removed)

# derivedValues.ts still exports existing functions
grep "export.*computeEncumbranceLimit" src/utils/derivedValues.ts
grep "export.*computeHP" src/utils/derivedValues.ts
grep "export.*computeWP" src/utils/derivedValues.ts
# Expected: all present
```

### 2.3 — No `any` Types Introduced
```
grep ": any" src/screens/CombatScreen.tsx src/screens/GearScreen.tsx src/screens/MagicScreen.tsx src/utils/modeGuards.ts src/utils/derivedValues.ts src/components/layout/BottomNav.tsx
# Expected: 0 matches
```

### 2.4 — No Hardcoded Colors
```
grep -E "#[0-9a-fA-F]{3,8}|rgb\(|rgba\(" src/screens/CombatScreen.tsx src/screens/GearScreen.tsx
# Expected: 0 matches (all colors via CSS variables)
```

### 2.5 — Existing Resources Unchanged
```
# system.json still has original resources
grep '"hp"' src/systems/dragonbane/system.json
grep '"wp"' src/systems/dragonbane/system.json
grep '"deathRolls"' src/systems/dragonbane/system.json
# Expected: all present
```

### 2.6 — Existing Nav Items Unchanged
```
grep "/sheet" src/components/layout/BottomNav.tsx
grep "/skills" src/components/layout/BottomNav.tsx
grep "/gear" src/components/layout/BottomNav.tsx
grep "/magic" src/components/layout/BottomNav.tsx
grep "/combat" src/components/layout/BottomNav.tsx
# Expected: all 5 present
```

### 2.7 — CharacterResource Interface Unchanged
```
grep "interface CharacterResource" src/types/*.ts
# Expected: present and unchanged (no new fields added)
```

### 2.8 — ArmorPiece Interface Unchanged
```
grep "interface ArmorPiece" src/types/*.ts
# Expected: present and unchanged
```

---

## Step 3: Cross-File Coherence

### 3.1 — modeGuards.ts Final State
The file should contain:
- Original `PLAY_MODE_EDITABLE_PREFIXES` array with `resources.deathSuccesses.current` added (SS-01)
- Original `isFieldEditableInPlayMode()` function (unchanged)
- Original `useFieldEditable()` hook (unchanged)
- New `useIsEditMode()` hook (SS-04)

### 3.2 — GearScreen.tsx Final State
The file should contain:
- Armor/helmet Drawer edit forms (SS-02)
- `useIsEditMode()` import and usage instead of `settings.mode === 'edit'` (SS-04)
- `computeEncumbranceLimit` usage (unchanged, but now returns different values per SS-03)
- Existing weapon, inventory, coins, tiny items, memento functionality (unchanged)

### 3.3 — system.json Final State
The file should contain:
- Original 3 resources (hp, wp, deathRolls) plus new deathSuccesses resource (SS-01)
- All other system data unchanged

---

## Phase 3 Completion Criteria

- [ ] All 38 acceptance criteria pass in final codebase state
- [ ] All 8 regression checks pass
- [ ] Cross-file coherence verified for modeGuards.ts, GearScreen.tsx, system.json
- [ ] Zero `any` types introduced
- [ ] Zero hardcoded colors introduced
- [ ] Zero broken imports
- [ ] Zero removed exports
- [ ] All existing functionality preserved

## Final Summary

| Metric | Value |
|--------|-------|
| Total AC | 38 |
| Automated | 12 |
| Component | 16 |
| Integration | 7 |
| Unit | 3 |
| Manual | 2 |
| Files modified | 7 |
| Files created | 0 |
| Regressions | 0 (target) |
