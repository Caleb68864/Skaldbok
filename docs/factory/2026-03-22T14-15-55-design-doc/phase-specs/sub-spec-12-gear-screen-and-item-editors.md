---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 12
title: "Gear Screen and Item Editors"
date: 2026-03-22
dependencies: ["2", "7", "10"]
---

# Sub-Spec 12: Gear Screen and Item Editors

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Build the Gear screen displaying weapons, armor/helmet summary, inventory items, tiny items, memento, coins, and an encumbrance helper. Implement drawer/modal editors for complex items (weapons, inventory items). In Play Mode, gear is viewable but not editable (except equipped state). In Edit Mode, full CRUD is available.

## Interface Contracts

### Provides
- `src/screens/GearScreen.tsx`: Full gear screen component
- `src/components/fields/WeaponCard.tsx`: Weapon display card with edit/delete/equip actions
- `src/components/fields/InventoryList.tsx`: Inventory item list with add/edit/delete
- `src/components/fields/WeaponEditor.tsx`: Drawer-based weapon editor form
- `src/components/fields/InventoryItemEditor.tsx`: Drawer-based inventory item editor form

### Requires
- From sub-spec 2: `Card`, `Button`, `Drawer`, `SectionPanel`, `CounterControl` primitives
- From sub-spec 7: `useActiveCharacter()` for character data
- From sub-spec 10: Mode guards for Play/Edit distinction

### Shared State
- ActiveCharacterContext: reads and updates character weapons, armor, inventory, coins

## Implementation Steps

### Step 1: Create WeaponCard component
- **File:** `src/components/fields/WeaponCard.tsx`
- **Action:** create
- **Changes:** Card showing weapon name, grip, range, damage, durability, features, equipped toggle. In Play Mode: only equipped toggle is interactive. In Edit Mode: shows edit and delete buttons.

### Step 2: Create WeaponEditor component
- **File:** `src/components/fields/WeaponEditor.tsx`
- **Action:** create
- **Changes:** Drawer form for creating/editing a weapon. Fields: name, grip (select: one-handed/two-handed), range, damage, durability (number), features (text). Save and Cancel buttons. On save, calls `onSave(weapon: Weapon)`.

### Step 3: Create InventoryList component
- **File:** `src/components/fields/InventoryList.tsx`
- **Action:** create
- **Changes:** List of inventory items showing name, weight, quantity. Each item has edit/delete buttons (Edit Mode only). Add button at bottom.

### Step 4: Create InventoryItemEditor component
- **File:** `src/components/fields/InventoryItemEditor.tsx`
- **Action:** create
- **Changes:** Drawer form for inventory items. Fields: name, weight (number), quantity (number), description (text).

### Step 5: Build GearScreen
- **File:** `src/screens/GearScreen.tsx`
- **Action:** modify (replace placeholder)
- **Changes:**
  - Guard: redirect to /library if no active character
  - Sections using `SectionPanel`:
    - **Weapons**: List of `WeaponCard` components + "Add Weapon" button (Edit Mode only). Opening editor uses `Drawer`.
    - **Armor & Helmet**: Simple display cards for armor and helmet (name, rating, features, equipped toggle). Edit via inline fields or small drawer.
    - **Inventory**: `InventoryList` component with `InventoryItemEditor` drawer
    - **Tiny Items**: Simple text list, editable in Edit Mode
    - **Memento**: Single text field
    - **Coins**: Gold/Silver/Copper `CounterControl` components (editable in both modes)
    - **Encumbrance**: Stub display showing "Encumbrance: X / Y" (actual calculation in sub-spec 16)

### Step 6: Verify
- **Run:** `npx tsc --noEmit && npm run build`
- **Expected:** Passes.

### Step 7: Commit
- **Stage:** `git add src/screens/GearScreen.tsx src/components/fields/WeaponCard.tsx src/components/fields/WeaponEditor.tsx src/components/fields/InventoryList.tsx src/components/fields/InventoryItemEditor.tsx`
- **Message:** `feat: gear screen and item editors`

## Acceptance Criteria

- `[BEHAVIORAL]` Adding a weapon via the drawer editor persists after reload (REQ-026, REQ-027)
- `[BEHAVIORAL]` Editing coin values updates the display and persists (REQ-026)
- `[STRUCTURAL]` Weapon and inventory item editing opens in a Drawer or Modal, not inline on the main screen (REQ-027)
- `[BEHAVIORAL]` In Play Mode, weapon list is viewable but not editable; in Edit Mode, full CRUD is available (REQ-022)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework -- verify in browser.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - Add weapon: In Edit Mode, click "Add Weapon", fill form in drawer, save, reload -- weapon persists
  - Coins: Change coin values, reload, verify persisted
  - Drawer usage: Verify weapon and inventory editing opens in a Drawer overlay
  - Play Mode: Switch to Play Mode, verify weapon edit/delete buttons are hidden, equipped toggle still works

## Patterns to Follow

- Complex item editing always uses `Drawer` or `Modal` -- never dense inline forms on the main screen.
- Weapon and inventory item arrays are updated immutably: create new array, call `updateCharacter({ weapons: newArray })`.
- New items get a fresh `generateId()` for their `id` field.
- Coins use `CounterControl` components from sub-spec 2.

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/components/fields/WeaponCard.tsx | Create | Weapon display card |
| src/components/fields/WeaponEditor.tsx | Create | Drawer weapon editor form |
| src/components/fields/InventoryList.tsx | Create | Inventory item list |
| src/components/fields/InventoryItemEditor.tsx | Create | Drawer inventory item editor |
| src/screens/GearScreen.tsx | Modify | Full gear screen replacing placeholder |
