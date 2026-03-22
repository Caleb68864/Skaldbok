---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 9
title: "Sheet Screen with Live Character Data"
date: 2026-03-22
dependencies: ["2", "7", "8"]
---

# Sub-Spec 9: Sheet Screen with Live Character Data

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Build the Sheet screen bound to the active character displaying identity summary (name, kin, profession), all 6 attributes, conditions as toggle checkboxes, HP/WP as counter controls, and derived value stubs. Implement the autosave hook that debounces character changes and persists them to IndexedDB without blocking the UI.

## Interface Contracts

### Provides
- `src/screens/SheetScreen.tsx`: Full sheet screen component
- `src/components/fields/AttributeField.tsx`: Single attribute display/edit component with `attributeId`, `value`, `onChange`, `disabled` props
- `src/components/fields/ConditionToggleGroup.tsx`: Group of condition checkboxes with `conditions: Record<string, boolean>`, `definitions: ConditionDefinition[]`, `onChange`, `disabled` props
- `src/components/fields/ResourceTracker.tsx`: HP/WP counter component with `resourceId`, `current`, `max`, `onChange`, `disabled` props
- `src/hooks/useAutosave.ts`: Exports `useAutosave(character, saveFn, debounceMs)` hook

### Requires
- From sub-spec 2: `CounterControl`, `Chip`, `SectionPanel`, `Card` primitives
- From sub-spec 7: `useActiveCharacter()` (character, updateCharacter), `useAppState()` (for system definition)
- From sub-spec 8: Active character must be set (redirect to /library if none)

### Shared State
- `ActiveCharacterContext`: reads and updates the active character
- IndexedDB `characters` store: autosave writes here

## Implementation Steps

### Step 1: Create useAutosave hook
- **File:** `src/hooks/useAutosave.ts`
- **Action:** create
- **Changes:** Hook that:
  1. Accepts `character: CharacterRecord | null`, `saveFn: (c: CharacterRecord) => Promise<void>`, `debounceMs: number` (default 1000)
  2. Uses a `useRef` to track a debounce timer
  3. On character change (via `useEffect` watching a serialization key or updatedAt), clears previous timer and sets new one
  4. On timer expiry, calls `saveFn(character)` with error handling
  5. On unmount, flushes pending save immediately
  6. Returns `{ isSaving: boolean, lastSaved: string | null, error: string | null }`

### Step 2: Create AttributeField component
- **File:** `src/components/fields/AttributeField.tsx`
- **Action:** create
- **Changes:** Displays attribute abbreviation + value. When `disabled` is false, value is an editable number input (min/max from system definition). When `disabled` is true, shows as read-only. Uses CSS variables for colors.

### Step 3: Create ConditionToggleGroup component
- **File:** `src/components/fields/ConditionToggleGroup.tsx`
- **Action:** create
- **Changes:** Renders a row of `Chip` components, one per condition definition. Each chip shows the condition name, is active/inactive based on `conditions[id]`, and calls `onChange(id, newValue)` on tap. Min 44x44px touch targets.

### Step 4: Create ResourceTracker component
- **File:** `src/components/fields/ResourceTracker.tsx`
- **Action:** create
- **Changes:** Uses `CounterControl` to show current/max for a resource. Displays label (e.g., "HP"), current value with decrement/increment buttons, and max value. In Play Mode, current is editable, max is locked. In Edit Mode, both are editable.

### Step 5: Build SheetScreen
- **File:** `src/screens/SheetScreen.tsx`
- **Action:** modify (replace placeholder)
- **Changes:**
  - Guard: if no active character, redirect to /library
  - Load system definition via `useAppState()` or `useSystemDefinition(character.systemId)`
  - Identity section: character name, kin, profession (read-only in Play Mode, editable inputs in Edit Mode)
  - Attributes section: grid of `AttributeField` components for all 6 attributes
  - Conditions section: `ConditionToggleGroup` (always interactive -- conditions toggle in both modes)
  - Resources section: `ResourceTracker` for HP and WP (counters always interactive in Play Mode)
  - Derived values section: Stub placeholders for movement, damage bonus, encumbrance (actual calculation in sub-spec 16)
  - Wire `useAutosave` with `characterRepository.save` as the save function
  - All mutations go through `updateCharacter()` from context, which triggers autosave via the hook

### Step 6: Verify
- **Run:** `npx tsc --noEmit && npm run build`
- **Expected:** Passes.

### Step 7: Commit
- **Stage:** `git add src/screens/SheetScreen.tsx src/components/fields/AttributeField.tsx src/components/fields/ConditionToggleGroup.tsx src/components/fields/ResourceTracker.tsx src/hooks/useAutosave.ts`
- **Message:** `feat: sheet screen with live character data`

## Acceptance Criteria

- `[BEHAVIORAL]` The Sheet screen displays the active character's name, kin, and profession (REQ-021)
- `[BEHAVIORAL]` All 6 attributes are displayed with their current values (REQ-021)
- `[BEHAVIORAL]` Toggling a condition checkbox persists the change after page reload (REQ-021, REQ-018)
- `[BEHAVIORAL]` Incrementing/decrementing HP or WP via counter controls persists after reload (REQ-021, REQ-018)
- `[STRUCTURAL]` Autosave hook debounces writes so rapid changes do not trigger individual DB writes per keystroke (REQ-018)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework -- verify in browser.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - Identity display: Create character, set active, verify name/kin/profession shown on Sheet
  - Attributes: Verify all 6 attributes displayed
  - Condition toggle: Toggle a condition, reload, verify state persisted
  - Resource counter: Increment HP, reload, verify value persisted
  - Autosave debounce: Rapidly click counter 5 times, check that only 1 DB write occurs (via DevTools Network/IndexedDB)

## Patterns to Follow

- All field components accept `disabled` prop for mode gating (sub-spec 10 will wire this up; for now, default to editable).
- Character mutations flow: user action -> `updateCharacter(partial)` in context -> context merges into state -> `useAutosave` detects change -> debounced `characterRepository.save()`.
- Use `SectionPanel` for collapsible sections (Identity, Attributes, Conditions, Resources).
- Counter controls use the `CounterControl` primitive from sub-spec 2.

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/hooks/useAutosave.ts | Create | Debounced autosave hook |
| src/components/fields/AttributeField.tsx | Create | Single attribute display/edit |
| src/components/fields/ConditionToggleGroup.tsx | Create | Condition toggle checkboxes |
| src/components/fields/ResourceTracker.tsx | Create | HP/WP counter tracker |
| src/screens/SheetScreen.tsx | Modify | Full sheet screen replacing placeholder |
