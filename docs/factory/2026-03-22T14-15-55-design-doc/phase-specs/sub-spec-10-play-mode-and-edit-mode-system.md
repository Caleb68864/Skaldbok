---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 10
title: "Play Mode and Edit Mode System"
date: 2026-03-22
dependencies: ["7", "9"]
---

# Sub-Spec 10: Play Mode and Edit Mode System

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Implement the global Play Mode / Edit Mode toggle system. Create mode guard utilities that determine field editability based on current mode. Update the TopBar to show the mode toggle with visual distinction between modes. Wire mode guards into the Sheet screen as the initial enforcement point. Mode preference persists across sessions via AppSettings in IndexedDB.

Play Mode allows: HP, WP, death rolls, conditions, equipped state.
Edit Mode allows: everything.

## Interface Contracts

### Provides
- `src/utils/modeGuards.ts`: Exports `isFieldEditableInPlayMode(fieldPath: string): boolean` and `useFieldEditable(fieldPath: string): boolean` hook
- `src/components/layout/TopBar.tsx` (modified): Mode toggle button with visual indicator
- `src/context/AppStateContext.tsx` (modified): `mode` in settings, `toggleMode()` action

### Requires
- From sub-spec 7: `useAppState()` with settings containing `mode: 'play' | 'edit'` and `updateSettings()`
- From sub-spec 9: Sheet screen field components with `disabled` props

### Shared State
- `AppSettings.mode`: persisted in IndexedDB, read from AppStateContext

## Implementation Steps

### Step 1: Create modeGuards utility
- **File:** `src/utils/modeGuards.ts`
- **Action:** create
- **Changes:**
  - Define a set of field paths editable in Play Mode:
    ```ts
    const PLAY_MODE_EDITABLE = new Set([
      'resources.hp.current',
      'resources.wp.current',
      'resources.deathRolls.current',
      'conditions.*',  // all conditions
      'weapons.*.equipped',
      'armor.equipped',
      'helmet.equipped',
    ]);
    ```
  - Export `isFieldEditableInPlayMode(fieldPath: string): boolean` that checks against the set (supports wildcard matching)
  - Export `useFieldEditable(fieldPath: string): boolean` hook that reads mode from `useAppState()` and returns true if mode is 'edit' OR the field is in the Play Mode editable set

### Step 2: Add toggleMode to AppStateContext
- **File:** `src/context/AppStateContext.tsx`
- **Action:** modify
- **Changes:** Add `toggleMode()` function to context value that:
  1. Toggles between 'play' and 'edit'
  2. Calls `updateSettings({ mode: newMode })`
  3. Persists to IndexedDB via settings repository

### Step 3: Update TopBar with mode toggle
- **File:** `src/components/layout/TopBar.tsx`
- **Action:** modify
- **Changes:**
  - Add mode toggle button that calls `toggleMode()`
  - Play Mode: Show "PLAY" label with `--color-mode-play` background (e.g., green-tinted)
  - Edit Mode: Show "EDIT" label with `--color-mode-edit` background (e.g., blue-tinted)
  - The entire top bar background or a prominent indicator should change color based on mode
  - Use `IconButton` or `Button` primitive for the toggle

### Step 4: Wire mode guards into SheetScreen
- **File:** `src/screens/SheetScreen.tsx`
- **Action:** modify
- **Changes:**
  - Import `useFieldEditable` from modeGuards
  - Pass `disabled={!useFieldEditable('attributes.*')}` to AttributeField components
  - ConditionToggleGroup: always enabled (conditions are Play Mode editable)
  - ResourceTracker for HP/WP: `current` always enabled, `max` disabled in Play Mode
  - Identity fields (name, kin, profession): disabled in Play Mode

### Step 5: Add visual locked indicator styles
- **File:** `src/theme/theme.css` or component CSS
- **Action:** modify
- **Changes:** Add styles for locked fields:
  - `.field--locked`: reduced opacity (0.7), no cursor pointer, no hover effect
  - `.field--editable`: normal opacity, pointer cursor on interactive elements
  - These classes are applied based on the `disabled` prop state

### Step 6: Verify
- **Run:** `npx tsc --noEmit && npm run build`
- **Expected:** Passes.

### Step 7: Commit
- **Stage:** `git add src/utils/modeGuards.ts src/components/layout/TopBar.tsx src/context/AppStateContext.tsx src/screens/SheetScreen.tsx src/theme/`
- **Message:** `feat: play mode and edit mode system`

## Acceptance Criteria

- `[BEHAVIORAL]` In Play Mode, tapping an attribute field does not open an editor (REQ-022)
- `[BEHAVIORAL]` In Play Mode, HP/WP counters and condition toggles remain interactive (REQ-022)
- `[BEHAVIORAL]` In Edit Mode, attribute fields become editable (REQ-022)
- `[BEHAVIORAL]` The top bar visually distinguishes Play Mode from Edit Mode with distinct color or label (REQ-023)
- `[BEHAVIORAL]` Mode preference persists: switching to Edit Mode and reloading restores Edit Mode (REQ-023)
- `[STRUCTURAL]` Locked fields have a visual indicator (dimmed, no edit affordance) distinguishing them from editable fields (REQ-024)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework -- verify in browser.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - Play Mode lock: Switch to Play Mode, try editing an attribute -- should be blocked
  - Play Mode interactive: In Play Mode, tap condition toggle and HP counter -- should work
  - Edit Mode unlock: Switch to Edit Mode, edit an attribute -- should work
  - Visual distinction: Toggle mode, verify top bar color/label changes
  - Persistence: Switch to Edit Mode, reload, verify still in Edit Mode

## Patterns to Follow

- Mode guards are centralized in `modeGuards.ts` -- never hardcode mode checks in individual components.
- Field components do not know about modes -- they just receive a `disabled` boolean prop. The mode logic stays in the screen or a wrapper component.
- The wildcard matching in `isFieldEditableInPlayMode` uses simple string prefix matching: `'conditions.*'` matches any path starting with `'conditions.'`.

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/utils/modeGuards.ts | Create | Mode guard logic and field editability checks |
| src/components/layout/TopBar.tsx | Modify | Add mode toggle with visual indicator |
| src/context/AppStateContext.tsx | Modify | Add toggleMode action |
| src/screens/SheetScreen.tsx | Modify | Wire mode guards to field components |
| src/theme/theme.css | Modify | Add locked/editable field visual styles |
