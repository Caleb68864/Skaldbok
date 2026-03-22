---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 13
title: "Magic Screen"
date: 2026-03-22
dependencies: ["2", "7", "10"]
---

# Sub-Spec 13: Magic Screen

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Build the Magic screen with spell cards and heroic ability cards. Support freeform create/edit/delete for spells and heroic abilities in Edit Mode. Implement a can-cast filter that shows only spells whose WP cost is less than or equal to the character's current WP. Spells are user-entered (freeform text, not pulled from copyrighted sources).

## Interface Contracts

### Provides
- `src/screens/MagicScreen.tsx`: Full magic screen component
- `src/components/fields/SpellCard.tsx`: Spell display card with name, school, WP cost, summary, edit/delete actions
- `src/components/fields/AbilityCard.tsx`: Heroic ability display card with name, summary, edit/delete actions
- `src/components/fields/FilterBar.tsx`: Reusable filter toggle bar (used for can-cast filter)

### Requires
- From sub-spec 2: `Card`, `Button`, `Drawer`, `Chip`, `SectionPanel` primitives
- From sub-spec 7: `useActiveCharacter()` for character data (spells, heroicAbilities, resources.wp.current)
- From sub-spec 10: Mode guards

### Shared State
- ActiveCharacterContext: reads and updates character spells and heroicAbilities

## Implementation Steps

### Step 1: Create SpellCard component
- **File:** `src/components/fields/SpellCard.tsx`
- **Action:** create
- **Changes:** Card showing spell name, school, power level, WP cost, range, duration, summary. Edit and delete buttons visible in Edit Mode only. Uses `Card` primitive.

### Step 2: Create AbilityCard component
- **File:** `src/components/fields/AbilityCard.tsx`
- **Action:** create
- **Changes:** Card showing heroic ability name and summary. Edit and delete buttons in Edit Mode.

### Step 3: Create FilterBar component
- **File:** `src/components/fields/FilterBar.tsx`
- **Action:** create
- **Changes:** Generic filter toggle bar. Props: `filters: { id: string, label: string }[]`, `activeFilter: string`, `onFilterChange: (id: string) => void`. Renders `Chip` components for each filter option.

### Step 4: Build MagicScreen
- **File:** `src/screens/MagicScreen.tsx`
- **Action:** modify (replace placeholder)
- **Changes:**
  - Guard: redirect to /library if no active character
  - Spells section:
    - "Add Spell" button (Edit Mode only) opens a Drawer with spell form (name, school, powerLevel, wpCost, range, duration, summary)
    - List of `SpellCard` components
    - Can-cast filter: `FilterBar` with "All Spells" and "Can Cast" options. When "Can Cast" is active, hide spells where `wpCost > character.resources.wp.current`
  - Heroic Abilities section:
    - "Add Ability" button (Edit Mode only) opens a Drawer with ability form (name, summary)
    - List of `AbilityCard` components
  - Empty states: "No spells yet" / "No heroic abilities yet" with helpful text

### Step 5: Verify
- **Run:** `npx tsc --noEmit && npm run build`
- **Expected:** Passes.

### Step 6: Commit
- **Stage:** `git add src/screens/MagicScreen.tsx src/components/fields/SpellCard.tsx src/components/fields/AbilityCard.tsx src/components/fields/FilterBar.tsx`
- **Message:** `feat: magic screen`

## Acceptance Criteria

- `[BEHAVIORAL]` Adding a spell with name, WP cost, and summary persists after reload (REQ-028)
- `[BEHAVIORAL]` Enabling the can-cast filter hides spells whose WP cost exceeds the character's current WP (REQ-028)
- `[BEHAVIORAL]` Heroic abilities display as cards with name and summary (REQ-028)
- `[BEHAVIORAL]` Spells and abilities can be created, edited, and deleted in Edit Mode (REQ-028)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework -- verify in browser.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - Add spell: Edit Mode, add a spell with WP cost 4, reload, verify persisted
  - Can-cast filter: Set WP to 3, enable can-cast filter, verify spell with cost 4 is hidden
  - Heroic ability: Add ability, verify card displays name and summary
  - CRUD: Edit a spell name, delete a spell, verify changes persist

## Patterns to Follow

- Spell and ability arrays are updated immutably, same as weapons in sub-spec 12.
- New spells/abilities get `generateId()` for their id.
- Drawer editors for create and edit -- pass existing data for edit, empty for create.
- Can-cast filter is local state, not persisted.

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/components/fields/SpellCard.tsx | Create | Spell display card |
| src/components/fields/AbilityCard.tsx | Create | Heroic ability display card |
| src/components/fields/FilterBar.tsx | Create | Reusable filter toggle bar |
| src/screens/MagicScreen.tsx | Modify | Full magic screen replacing placeholder |
