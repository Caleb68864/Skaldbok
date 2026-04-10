---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 16
title: "Derived Values and Override System"
date: 2026-03-22
dependencies: ["9", "10"]
---

# Sub-Spec 16: Derived Values and Override System

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Implement automatic derived value computation for movement, damage bonus, and encumbrance limit based on character attributes. Create a display component for derived values that shows the auto-calculated value with an optional user override. In Edit Mode, users can override any derived value; overrides are visibly marked and can be reset to auto-calculated values. Derived value logic is centralized in a single utility module.

Dragonbane derived values:
- HP max = CON attribute value
- WP max = WIL attribute value
- Damage bonus (melee) = STR damage bonus table (e.g., STR 13-16 = +D4)
- Damage bonus (ranged) = AGL-based
- Movement = 10 (base, can be affected by kin but default 10)
- Encumbrance limit = STR / 2 (rounded up) + some base

## Interface Contracts

### Provides
- `src/utils/derivedValues.ts`: Exports `computeDerivedValues(character: CharacterRecord, system: SystemDefinition): Record<string, number | string>` and individual computation functions
- `src/components/fields/DerivedFieldDisplay.tsx`: Component showing a derived value with override indicator and reset button
- `src/screens/SheetScreen.tsx` (modified): Derived values section now shows computed values
- `src/screens/GearScreen.tsx` (modified): Encumbrance display uses computed value

### Requires
- From sub-spec 9: Sheet screen with derived value stubs to replace
- From sub-spec 10: Mode guards for Edit-only override editing

### Shared State
- `CharacterRecord.derivedOverrides`: `Record<string, number | null>` stored on the character

## Implementation Steps

### Step 1: Create derivedValues utility
- **File:** `src/utils/derivedValues.ts`
- **Action:** create
- **Changes:**
  - `computeHPMax(character): number` -- returns `character.attributes.con` (or override)
  - `computeWPMax(character): number` -- returns `character.attributes.wil` (or override)
  - `computeMovement(character): number` -- returns 10 (base; overridable)
  - `computeDamageBonus(character): string` -- STR-based lookup table:
    - STR 1-12: "+0", STR 13-16: "+D4", STR 17-18: "+D6"
  - `computeEncumbranceLimit(character): number` -- `Math.ceil(character.attributes.str / 2)`
  - `computeDerivedValues(character, system): DerivedValues` -- returns all computed values
  - `getDerivedValue(character, key): { computed: number|string, override: number|string|null, effective: number|string }` -- checks derivedOverrides first
  - All functions are pure (no side effects)

### Step 2: Create DerivedFieldDisplay component
- **File:** `src/components/fields/DerivedFieldDisplay.tsx`
- **Action:** create
- **Changes:**
  - Props: `label: string`, `computedValue: number | string`, `override: number | null`, `onOverride: (value: number) => void`, `onReset: () => void`, `editable: boolean`
  - Displays the effective value (override if set, computed otherwise)
  - If override is set: shows a small "overridden" indicator (icon or colored badge) and a "reset" button
  - If editable (Edit Mode): value is clickable/editable to set an override
  - If not editable (Play Mode): read-only display

### Step 3: Wire derived values into SheetScreen
- **File:** `src/screens/SheetScreen.tsx`
- **Action:** modify
- **Changes:**
  - Import `computeDerivedValues` and `getDerivedValue`
  - Replace derived value stubs with `DerivedFieldDisplay` components for: Movement, Damage Bonus, HP Max, WP Max
  - On override change: update `character.derivedOverrides[key]` via `updateCharacter()`
  - On reset: set `character.derivedOverrides[key] = null`
  - When attributes change, derived values recompute automatically (since they read from current character state)

### Step 4: Wire encumbrance into GearScreen
- **File:** `src/screens/GearScreen.tsx`
- **Action:** modify
- **Changes:**
  - Import `computeEncumbranceLimit`
  - Calculate current encumbrance: sum of `weapon weights` + `inventory item weights * quantities` + armor/helmet weight
  - Display: "Encumbrance: {current} / {limit}" with warning color when over limit

### Step 5: Verify
- **Run:** `npx tsc --noEmit && npm run build`
- **Expected:** Passes.

### Step 6: Commit
- **Stage:** `git add src/utils/derivedValues.ts src/components/fields/DerivedFieldDisplay.tsx src/screens/SheetScreen.tsx src/screens/GearScreen.tsx`
- **Message:** `feat: derived values and override system`

## Acceptance Criteria

- `[BEHAVIORAL]` Changing a character's CON attribute causes the derived HP maximum to update (REQ-034)
- `[BEHAVIORAL]` Resetting an override returns the field to its auto-calculated value (REQ-035)
- `[STRUCTURAL]` Derived value logic is centralized in derivedValues.ts, not spread across components (REQ-034)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework -- verify in browser.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - CON -> HP: Change CON attribute, verify HP max updates
  - Override: In Edit Mode, override movement value, verify override indicator appears
  - Reset: Click reset on overridden value, verify returns to auto-calculated
  - Centralized: Verify `src/utils/derivedValues.ts` contains all computation logic

## Patterns to Follow

- All derived value computations are pure functions in `derivedValues.ts` -- no React hooks or side effects.
- Components consume computed values via function calls, not context.
- Override pattern: `derivedOverrides[key] !== null ? derivedOverrides[key] : computedValue`.
- Damage bonus returns a string ("+D4") not a number, since it is a die expression.

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/utils/derivedValues.ts | Create | Centralized derived value computation |
| src/components/fields/DerivedFieldDisplay.tsx | Create | Derived value display with override support |
| src/screens/SheetScreen.tsx | Modify | Replace derived value stubs with live computed values |
| src/screens/GearScreen.tsx | Modify | Add encumbrance calculation display |
