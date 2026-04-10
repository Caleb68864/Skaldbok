---
type: phase-spec
master_spec: "docs/factory/2026-03-31T18-21-40-design-doc/spec.md"
sub_spec_number: 1
title: "Session UX Core — PartyPicker, Coin Calculator, Bottom Nav"
date: 2026-03-31
dependencies: ["none"]
---

# Sub-Spec 1: Session UX Core — PartyPicker, Coin Calculator, Bottom Nav

Refined from spec.md — Factory Run 2026-03-31T18-21-40-design-doc.

## Scope

Extract the `PartyPicker` component from `SessionQuickActions.tsx` (lines 99-184) into a shared component at `src/components/fields/PartyPicker.tsx`. Update the Shopping quick action in `SessionQuickActions.tsx` to use `CounterControl` steppers for Gold/Silver/Copper with quantity and total. Update `BottomNav.tsx` to show Characters/Session/Reference (removing Notes). Remove the Combat tab from `CharacterSubNav.tsx`. Update `routes/index.tsx` to remove the `/character/combat` route, redirect `/combat` to `/character/sheet`, redirect `/notes` to `/session?view=notes`, and remove the standalone NotesScreen route.

## Interface Contracts

### Provides
- `src/components/fields/PartyPicker.tsx`: Exports `PartyPicker` component with props `{ members: ResolvedMember[]; selected: string[]; onSelect: (ids: string[]) => void; multiSelect?: boolean }` and the `ResolvedMember` type `{ id: string; name: string; character: CharacterRecord | null }`.
- Updated `BottomNav` with 3-tab layout (Characters, Session, Reference).
- Updated routes with `/notes` redirect and no `/character/combat`.

### Requires
None — no dependencies.

### Shared State
- `ResolvedMember` type is exported from `PartyPicker.tsx` and consumed by sub-spec 2 (GlobalFAB) and the refactored `SessionQuickActions.tsx`.

## Implementation Steps

### Step 1: Extract PartyPicker to shared component
- **File:** `src/components/fields/PartyPicker.tsx` (create)
- **Action:** create
- **Pattern:** Follow `src/components/primitives/Chip.tsx` for component structure. The PartyPicker code currently lives in `src/features/session/SessionQuickActions.tsx` lines 92-184.
- **Changes:**
  1. Create the file with the `ResolvedMember` interface exported.
  2. Move the `PartyPicker` function component verbatim from `SessionQuickActions.tsx`.
  3. Export the `PartyPicker` component as a named export.
  4. Include the `chipStyle` const needed by PartyPicker (or import from a shared styles module if one exists; otherwise inline it).
  5. Import `CharacterRecord` from `../../types/character`.

### Step 2: Update SessionQuickActions to use extracted PartyPicker
- **File:** `src/features/session/SessionQuickActions.tsx` (modify)
- **Action:** modify
- **Changes:**
  1. Remove the local `ResolvedMember` interface, `PartyPicker` function, and the `chipStyle` const (if no longer used by other local components; check first).
  2. Add import: `import { PartyPicker } from '../../components/fields/PartyPicker';` and `import type { ResolvedMember } from '../../components/fields/PartyPicker';`
  3. All existing uses of `<PartyPicker ... />` inside SessionQuickActions remain unchanged since the props are identical.
  4. Note: `chipStyle` is also used by `RollModifiers` and `TagPicker` local components — keep it if needed, or refactor those to use the `Chip` primitive.

### Step 3: Update Shopping action with coin calculator
- **File:** `src/features/session/SessionQuickActions.tsx` (modify)
- **Action:** modify
- **Pattern:** Follow existing `CounterControl` usage in `src/screens/CombatScreen.tsx` lines 176-196. Import `CounterControl` from `../../components/primitives/CounterControl`.
- **Changes:**
  1. Replace the simple `shopItem`/`shopCost` text inputs in the Shopping drawer with three `CounterControl` steppers: Gold (`min: 0`), Silver (`min: 0`), Copper (`min: 0`).
  2. Add a quantity `CounterControl` stepper (`min: 1`).
  3. Add state: `shopGold`, `shopSilver`, `shopCopper`, `shopQuantity` (all `number`, defaults 0/0/0/1).
  4. Display calculated total: `Total: {gold * quantity}g {silver * quantity}s {copper * quantity}c`.
  5. Keep `shopAction` (buy/sell) toggle.
  6. Update `logEvent` call to include coin breakdown in `typeData`.

### Step 4: Update BottomNav tabs
- **File:** `src/components/shell/BottomNav.tsx` (modify)
- **Action:** modify
- **Changes:**
  1. Change `NAV_TABS` array from `[Session, Notes, Character]` to:
     ```typescript
     const NAV_TABS = [
       { to: '/character/sheet', label: 'Characters' },
       { to: '/session', label: 'Session' },
       { to: '/reference', label: 'Reference' },
     ] as const;
     ```
  2. Update the `isActive` logic: Characters tab activates on `/character` prefix, Session tab activates on `/session` prefix, Reference tab activates on `/reference` prefix.

### Step 5: Remove Combat tab from CharacterSubNav
- **File:** `src/components/shell/CharacterSubNav.tsx` (modify)
- **Action:** modify
- **Changes:**
  1. Remove `{ to: '/character/combat', label: 'Combat' }` from `CHARACTER_TABS` array.
  2. Result should be: Sheet, Skills, Gear, Magic (4 tabs).

### Step 6: Update routes
- **File:** `src/routes/index.tsx` (modify)
- **Action:** modify
- **Changes:**
  1. Remove the import of `CombatScreen`.
  2. Remove the `{ path: 'combat', element: <CombatScreen /> }` route from `/character` children.
  3. Change `{ path: '/combat', element: <Navigate to="/character/combat" replace /> }` to `{ path: '/combat', element: <Navigate to="/character/sheet" replace /> }`.
  4. Change the `/notes` route from `{ path: '/notes', element: <NotesScreen /> }` to a redirect: `{ path: '/notes', element: <Navigate to="/session?view=notes" replace /> }`.
  5. Remove the `NotesScreen` import (it will be removed in sub-spec 3; for now, just remove its route).
  6. Add routes for full note editor (needed by sub-spec 3, but adding the route placeholder here): keep this for sub-spec 3 to handle.

### Step 7: Verify TypeScript compilation
- **Run:** `npx tsc --noEmit`
- **Expected:** Zero errors. The `CombatScreen` file still exists but is no longer routed; NotesScreen still exists but is no longer routed.

### Step 8: Commit
- **Stage:** `git add src/components/fields/PartyPicker.tsx src/features/session/SessionQuickActions.tsx src/components/shell/BottomNav.tsx src/components/shell/CharacterSubNav.tsx src/routes/index.tsx`
- **Message:** `feat: session ux core — extract PartyPicker, coin calculator, update nav`

## Acceptance Criteria

- `[STRUCTURAL]` `src/components/fields/PartyPicker.tsx` exists and exports a `PartyPicker` component with `multiSelect` prop. (REQ-003)
- `[BEHAVIORAL]` Tapping "Party" chip selects all members; tapping again deselects all. Individual chips are independently toggleable. (REQ-001, REQ-002)
- `[STRUCTURAL]` Shopping action drawer contains Gold/Silver/Copper CounterControl steppers with quantity field and total display. (REQ-004)
- `[STRUCTURAL]` BottomNav `NAV_TABS` array contains exactly: Characters (`/character/sheet`), Session (`/session`), Reference (`/reference`). No Notes tab. (REQ-008)
- `[STRUCTURAL]` CharacterSubNav `CHARACTER_TABS` does not include Combat. (REQ-019)
- `[STRUCTURAL]` Routes file has no `/character/combat` route. A redirect from `/notes` to `/session?view=notes` exists. (REQ-011, REQ-019)
- `[MECHANICAL]` `npx tsc --noEmit` passes with no errors. (REQ-028)

## Verification Commands

- **Build:** `npx tsc --noEmit`
- **Tests:** No test framework detected — skip TDD steps, implement directly.
- **Acceptance:**
  - Grep `PartyPicker.tsx` for `export function PartyPicker` and `multiSelect` prop.
  - Grep `BottomNav.tsx` for `NAV_TABS` — verify no "Notes" entry.
  - Grep `CharacterSubNav.tsx` for `CHARACTER_TABS` — verify no "Combat" entry.
  - Grep `routes/index.tsx` for `/notes` redirect and absence of `combat` child route.
  - Grep `SessionQuickActions.tsx` for `CounterControl` import and Gold/Silver/Copper state.

## Patterns to Follow

- `src/components/primitives/Chip.tsx`: Component structure pattern (interface, named export, inline styles using CSS variables).
- `src/components/primitives/CounterControl.tsx`: Stepper UI pattern with `value`, `min`, `max`, `onChange`, `label` props.
- `src/components/primitives/Drawer.tsx`: Drawer props pattern `{ open, onClose, title, children }`.
- `src/features/session/SessionQuickActions.tsx` (lines 99-184): Existing PartyPicker implementation to extract.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/components/fields/PartyPicker.tsx` | Create | Shared PartyPicker component extracted from SessionQuickActions |
| `src/features/session/SessionQuickActions.tsx` | Modify | Import shared PartyPicker, add coin calculator with CounterControl |
| `src/components/shell/BottomNav.tsx` | Modify | Update tabs to Characters/Session/Reference |
| `src/components/shell/CharacterSubNav.tsx` | Modify | Remove Combat tab |
| `src/routes/index.tsx` | Modify | Remove combat route, add /notes redirect |
