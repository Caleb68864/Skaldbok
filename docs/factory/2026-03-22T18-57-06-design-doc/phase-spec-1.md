# Phase 1: Wave 1 — Core Gameplay & Navigation

**Phase:** 1 of 3
**Wave:** 1
**Sub-Specs:** SS-01, SS-02, SS-05
**Dependencies:** None (all independent, parallelizable)
**Files Modified:** 5

---

## Dependency Graph

```
SS-01 (Death Roll Success Tracking)  ── no deps ──┐
SS-02 (Armor/Helmet Edit Forms)      ── no deps ──┼── Phase 1 Complete
SS-05 (Navigation Improvements)      ── no deps ──┘
```

**Intra-phase notes:**
- SS-01 and SS-05 touch completely independent files — fully parallelizable.
- SS-02 touches `GearScreen.tsx` which is also touched by SS-04 in Phase 2. SS-02 MUST complete before SS-04 begins.
- SS-01 touches `modeGuards.ts` which is also touched by SS-04 in Phase 2. SS-01 MUST complete before SS-04 begins.

---

## SS-01: Death Roll Success Tracking

### Implementation Steps

**Step 1.1 — Add `deathSuccesses` resource to system.json**
- **File:** `src/systems/dragonbane/system.json`
- **Action:** Add a new resource entry to the `resources` array:
  ```json
  { "id": "deathSuccesses", "name": "Death Successes", "min": 0, "defaultMax": 3 }
  ```
- **Position:** After the existing `deathRolls` resource entry.

**Step 1.2 — Add `deathSuccesses.current` to play-mode editable list**
- **File:** `src/utils/modeGuards.ts`
- **Action:** Add `'resources.deathSuccesses.current'` to the `PLAY_MODE_EDITABLE_PREFIXES` array.
- **Position:** After `'resources.deathRolls.current'`.

**Step 1.3 — Add success tracking UI to CombatScreen**
- **File:** `src/screens/CombatScreen.tsx`
- **Action:** Implement the following changes:
  1. Read `deathSuccesses` resource with fallback: `character.resources['deathSuccesses'] ?? { current: 0, max: 3 }`
  2. Add success circles row alongside existing failure circles row.
  3. Success circles use `var(--color-success)` for filled state (existing failure circles use `var(--color-danger)`).
  4. Each success circle is clickable — toggles fill up to clicked index (same interaction pattern as death roll failure circles).
  5. Add "Stabilized!" message when `deathSuccesses.current >= deathSuccesses.max` (i.e., 3).
  6. Modify the existing reset button to also clear `deathSuccesses.current` to 0 (alongside clearing `deathRolls.current` to 0).
  7. Success tracking section only renders when character is DOWN (HP = 0) — same condition as failure tracking.
- **Pattern:** Use existing `updateResourceCurrent` pattern. Use existing `CharacterResource` type.

### Verification Commands

```
# AC-01-1: system.json includes deathSuccesses resource with defaultMax: 3
grep -c "deathSuccesses" src/systems/dragonbane/system.json
# Expected: >= 1
grep "defaultMax.*3" src/systems/dragonbane/system.json
# Expected: matches for deathSuccesses entry

# AC-01-3: Success circles use var(--color-success)
grep "color-success" src/screens/CombatScreen.tsx
# Expected: >= 1 match

# AC-01-7: deathSuccesses.current in modeGuards
grep "deathSuccesses" src/utils/modeGuards.ts
# Expected: >= 1 match

# AC-01-2, AC-01-4, AC-01-5, AC-01-6, AC-01-8: Component/integration checks
# Read CombatScreen.tsx and verify:
#   - Success circles rendered alongside failure circles when HP=0
#   - Click handler toggles success circles
#   - "Stabilized!" message when successes === max
#   - Reset clears both deathRolls and deathSuccesses
#   - Fallback `?? { current: 0, max: 3 }` present for deathSuccesses
```

### Acceptance Criteria Checklist

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-01-1 | `system.json` includes `deathSuccesses` resource with `defaultMax: 3` | grep system.json for deathSuccesses |
| AC-01-2 | CombatScreen renders success circles alongside failure circles when DOWN | Read JSX, confirm conditional render on HP=0 |
| AC-01-3 | Success circles use `var(--color-success)` for filled state | grep CombatScreen for color-success |
| AC-01-4 | Clicking a success circle toggles it | Read click handler logic |
| AC-01-5 | "Stabilized!" message appears at max successes | Read JSX for conditional message |
| AC-01-6 | Reset button clears both `deathRolls` and `deathSuccesses` to 0 | Read reset handler |
| AC-01-7 | `deathSuccesses.current` editable in Play Mode | grep modeGuards for deathSuccesses |
| AC-01-8 | Fallback for missing `deathSuccesses` resource | grep CombatScreen for `?? { current: 0, max: 3 }` or equivalent |

---

## SS-02: Armor & Helmet Edit Forms

### Implementation Steps

**Step 2.1 — Add Drawer state for armor/helmet editing**
- **File:** `src/screens/GearScreen.tsx`
- **Action:** Add state variables:
  ```typescript
  const [armorDrawerOpen, setArmorDrawerOpen] = useState(false);
  const [armorEditType, setArmorEditType] = useState<'armor' | 'helmet'>('armor');
  const [armorFormName, setArmorFormName] = useState('');
  const [armorFormRating, setArmorFormRating] = useState(0);
  const [armorFormFeatures, setArmorFormFeatures] = useState('');
  ```

**Step 2.2 — Add useEffect for form state sync**
- **File:** `src/screens/GearScreen.tsx`
- **Action:** Add useEffect to populate form when Drawer opens:
  ```typescript
  useEffect(() => {
    if (armorDrawerOpen) {
      const piece = armorEditType === 'armor' ? character.armor : character.helmet;
      if (piece) {
        setArmorFormName(piece.name);
        setArmorFormRating(piece.rating);
        setArmorFormFeatures(piece.features ?? '');
      } else {
        setArmorFormName('');
        setArmorFormRating(armorEditType === 'armor' ? 2 : 1);
        setArmorFormFeatures('');
      }
    }
  }, [armorDrawerOpen, armorEditType]);
  ```

**Step 2.3 — Add save and remove handlers**
- **File:** `src/screens/GearScreen.tsx`
- **Action:** Implement save handler that persists via `updateCharacter`:
  ```typescript
  function handleArmorSave() {
    const piece: ArmorPiece = {
      id: (armorEditType === 'armor' ? character.armor?.id : character.helmet?.id) ?? generateId(),
      name: armorFormName,
      rating: armorFormRating,
      features: armorFormFeatures,
      equipped: (armorEditType === 'armor' ? character.armor?.equipped : character.helmet?.equipped) ?? false,
    };
    updateCharacter({
      [armorEditType]: piece,
      updatedAt: nowISO(),
    });
    setArmorDrawerOpen(false);
  }

  function handleArmorRemove(type: 'armor' | 'helmet') {
    updateCharacter({ [type]: null, updatedAt: nowISO() });
  }
  ```

**Step 2.4 — Replace hardcoded "Set Armor"/"Set Helmet" buttons**
- **File:** `src/screens/GearScreen.tsx`
- **Action:** Replace the inline `"Set Armor"` / `"Set Helmet"` buttons that create hardcoded defaults with `"Add Armor"` / `"Add Helmet"` buttons that open the Drawer with empty/default form values.
  - Remove any inline `{ name: 'Armor', rating: 2 }` or `{ name: 'Helmet', rating: 1 }` hardcoded creation.
  - The button opens the Drawer: `setArmorEditType('armor'); setArmorDrawerOpen(true);`

**Step 2.5 — Add Edit button next to existing armor/helmet display**
- **File:** `src/screens/GearScreen.tsx`
- **Action:** When armor/helmet exists, add an "Edit" button (edit mode only) that opens the Drawer pre-populated with current values.

**Step 2.6 — Add Remove button (edit mode only)**
- **File:** `src/screens/GearScreen.tsx`
- **Action:** Add a "Remove" button in the armor/helmet display section (edit mode only) that calls `handleArmorRemove`.

**Step 2.7 — Add Drawer JSX**
- **File:** `src/screens/GearScreen.tsx`
- **Action:** Add a `<Drawer>` component with form fields for Name (text input), Rating (number input, min 0), and Features (text input or textarea). Use the same Drawer pattern as `WeaponEditor` and MagicScreen spell Drawer. Include Save and Cancel buttons.

### Verification Commands

```
# AC-02-11: No hardcoded armor/helmet defaults remain
grep -n "name: 'Armor', rating: 2" src/screens/GearScreen.tsx
grep -n "name: 'Helmet', rating: 1" src/screens/GearScreen.tsx
# Expected: 0 matches for both

# AC-02-1, AC-02-2: Drawer with Name, Rating, Features fields
grep -c "Drawer" src/screens/GearScreen.tsx
# Expected: >= 2 (open/close tags minimum)
grep "armorFormName\|armorFormRating\|armorFormFeatures" src/screens/GearScreen.tsx
# Expected: multiple matches for form fields

# AC-02-3, AC-02-4: Add buttons open Drawer
grep "Add Armor\|Add Helmet" src/screens/GearScreen.tsx
# Expected: >= 1 match each

# AC-02-5, AC-02-6: Edit buttons for existing armor/helmet
grep -n "Edit.*armor\|edit.*armor" src/screens/GearScreen.tsx
# Expected: matches for edit button logic

# AC-02-9: Remove button
grep "Remove\|handleArmorRemove" src/screens/GearScreen.tsx
# Expected: >= 1 match

# AC-02-7, AC-02-8, AC-02-10: Integration checks
# Read GearScreen.tsx and verify:
#   - handleArmorSave calls updateCharacter with name, rating, features
#   - Equip toggle is still present and functional in both modes
```

### Acceptance Criteria Checklist

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-02-1 | Armor Drawer with Name, Rating, Features fields | Read Drawer JSX |
| AC-02-2 | Helmet Drawer with Name, Rating, Features fields | Read Drawer JSX (shared or separate) |
| AC-02-3 | "Add Armor" opens Drawer with empty/default values | Read button onClick handler |
| AC-02-4 | "Add Helmet" opens Drawer with empty/default values | Read button onClick handler |
| AC-02-5 | "Edit" on existing armor opens pre-populated Drawer | Read useEffect + edit button |
| AC-02-6 | "Edit" on existing helmet opens pre-populated Drawer | Read useEffect + edit button |
| AC-02-7 | Save persists name, rating, features via updateCharacter | Read handleArmorSave |
| AC-02-8 | Save persists helmet similarly | Read handleArmorSave (shared handler) |
| AC-02-9 | "Remove" button sets armor/helmet to null (edit mode only) | Read handleArmorRemove + conditional render |
| AC-02-10 | Equip toggle works in both modes | Read toggle code is unchanged |
| AC-02-11 | No hardcoded defaults remain | grep for old hardcoded values |

---

## SS-05: Navigation Improvements

### Implementation Steps

**Step 5.1 — Add Reference NavLink**
- **File:** `src/components/layout/BottomNav.tsx`
- **Action:** Add a new `<NavLink>` for Reference after the Combat nav item:
  ```tsx
  <NavLink
    to="/reference"
    className={({ isActive }) =>
      `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`
    }
  >
    Ref
  </NavLink>
  ```
- **Label:** Use "Ref" (abbreviated) to conserve horizontal space with 7 items.

**Step 5.2 — Add Settings NavLink**
- **File:** `src/components/layout/BottomNav.tsx`
- **Action:** Add a new `<NavLink>` for Settings after the Reference nav item:
  ```tsx
  <NavLink
    to="/settings"
    className={({ isActive }) =>
      `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`
    }
  >
    Settings
  </NavLink>
  ```
- **Label:** Use "Settings" or a gear icon if available.

### Verification Commands

```
# AC-05-1: Reference NavLink exists
grep "/reference" src/components/layout/BottomNav.tsx
# Expected: >= 1 match

# AC-05-2: Settings NavLink exists
grep "/settings" src/components/layout/BottomNav.tsx
# Expected: >= 1 match

# AC-05-5: Same styling pattern as existing items
grep "bottom-nav__item" src/components/layout/BottomNav.tsx
# Expected: matches for new items using same class pattern

# AC-05-6: Active state highlighting
grep "bottom-nav__item--active" src/components/layout/BottomNav.tsx
# Expected: matches for new items

# AC-05-3, AC-05-4: Integration — NavLink `to` prop confirms route target
# Read BottomNav.tsx and verify NavLink `to="/reference"` and `to="/settings"`

# AC-05-7: Manual — visually verify 7 items fit on 768px+ viewport
```

### Acceptance Criteria Checklist

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-05-1 | "Ref" or "Reference" NavLink to `/reference` | grep BottomNav for /reference |
| AC-05-2 | Settings NavLink to `/settings` | grep BottomNav for /settings |
| AC-05-3 | Reference nav navigates to ReferenceScreen | Verify NavLink `to` prop |
| AC-05-4 | Settings nav navigates to SettingsScreen | Verify NavLink `to` prop |
| AC-05-5 | Same `bottom-nav__item` class pattern | grep for class usage |
| AC-05-6 | Active state with `bottom-nav__item--active` | grep for active class |
| AC-05-7 | 7 items fit on 768px+ viewport | Manual visual check |

---

## Phase 1 Completion Criteria

- [ ] All 8 AC for SS-01 pass
- [ ] All 11 AC for SS-02 pass
- [ ] All 7 AC for SS-05 pass
- [ ] Total: 26 / 26 acceptance criteria pass
- [ ] No regressions: existing imports intact, no removed functionality
- [ ] Files modified: `system.json`, `CombatScreen.tsx`, `modeGuards.ts`, `GearScreen.tsx`, `BottomNav.tsx`

## Phase 1 → Phase 2 Gate

Phase 2 may begin only when:
1. All Phase 1 acceptance criteria pass.
2. `GearScreen.tsx` changes from SS-02 are stable (SS-04 modifies same file).
3. `modeGuards.ts` changes from SS-01 are stable (SS-04 modifies same file).
