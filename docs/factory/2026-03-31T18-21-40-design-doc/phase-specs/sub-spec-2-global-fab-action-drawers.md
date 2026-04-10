---
type: phase-spec
master_spec: "docs/factory/2026-03-31T18-21-40-design-doc/spec.md"
sub_spec_number: 2
title: "Global FAB and Action Drawer Extraction"
date: 2026-03-31
dependencies: ["sub-spec 1"]
---

# Sub-Spec 2: Global FAB and Action Drawer Extraction

Refined from spec.md — Factory Run 2026-03-31T18-21-40-design-doc.

## Scope

Extract each action drawer from `SessionQuickActions.tsx` into standalone components under `src/features/session/actions/`. Create a global dice FAB component (`GlobalFAB.tsx`) visible on all screens within `ShellLayout`. FAB opens quick-action menu when session is active, shows toast when not. After extraction, `SessionQuickActions` becomes a thin orchestrator that composes the extracted drawers.

The existing `SessionQuickActions.tsx` contains these action flows:
- Skill Check (skill picker + roll modifiers + result grid)
- Spell Cast (spell picker + result grid)
- Ability Use (ability picker)
- Shopping (coin calculator from sub-spec 1)
- Loot (name input + log)
- Quote (text input + log)
- Rumor (text + source + log)
- Rest (rest type picker + modals) — duplicated from SheetScreen

Each action drawer should be a self-contained component using the `Drawer` primitive.

## Interface Contracts

### Provides
- `src/features/session/actions/SkillCheckDrawer.tsx`: Exported component with props `{ open, onClose, members, selectedMembers, onSelectMembers, onLogged }`.
- `src/features/session/actions/ShoppingDrawer.tsx`: Exported component with props `{ open, onClose, members, selectedMembers, onSelectMembers, onLogged }`.
- `src/features/session/actions/LootDrawer.tsx`: Exported component with props `{ open, onClose, members, selectedMembers, onSelectMembers, onLogged }`.
- `src/features/session/actions/QuoteDrawer.tsx`: Exported component with props `{ open, onClose, members, selectedMembers, onSelectMembers, onLogged }`.
- `src/features/session/actions/RumorDrawer.tsx`: Exported component with props `{ open, onClose, onLogged }`.
- `src/features/session/actions/SpellCastDrawer.tsx`: Exported component (optional extraction).
- `src/components/shell/GlobalFAB.tsx`: Exported component, no props (reads session context internally).

### Requires
- From sub-spec 1: `PartyPicker` component at `src/components/fields/PartyPicker.tsx` and `ResolvedMember` type.

### Shared State
- All action drawers use `useNoteActions().createNote()` for logging.
- `GlobalFAB` uses `useCampaignContext().activeSession` to detect session state.
- `GlobalFAB` uses `useToast().showToast()` for no-session toast.

## Implementation Steps

### Step 1: Create actions directory and extract SkillCheckDrawer
- **File:** `src/features/session/actions/SkillCheckDrawer.tsx` (create)
- **Action:** create
- **Pattern:** Follow `src/features/notes/QuickNoteDrawer.tsx` for drawer component pattern. Extract the skill check flow from `SessionQuickActions.tsx` (the `renderSkillPicker` function and related state).
- **Changes:**
  1. Create the file with a `SkillCheckDrawerProps` interface: `{ open: boolean; onClose: () => void; members: ResolvedMember[]; selectedMembers: string[]; onSelectMembers: (ids: string[]) => void; onLogged: () => void }`.
  2. Move `CORE_SKILLS`, `WEAPON_SKILLS`, `RESULTS`, `resultChipBase` constants.
  3. Move `RollModifiers` sub-component.
  4. Move skill picker rendering logic and state (`selectedSkill`, `rollMods`).
  5. Import `PartyPicker` from `../../../components/fields/PartyPicker`.
  6. Import `Drawer` from `../../../components/primitives/Drawer`.
  7. Import `useNoteActions` for logging, `useToast` for feedback.

### Step 2: Extract ShoppingDrawer
- **File:** `src/features/session/actions/ShoppingDrawer.tsx` (create)
- **Action:** create
- **Pattern:** Same drawer pattern as SkillCheckDrawer.
- **Changes:**
  1. Move the Shopping action flow from `SessionQuickActions.tsx`.
  2. Include the coin calculator (Gold/Silver/Copper CounterControls from sub-spec 1).
  3. Import `CounterControl` from `../../../components/primitives/CounterControl`.
  4. Include buy/sell toggle, quantity, total display.

### Step 3: Extract LootDrawer
- **File:** `src/features/session/actions/LootDrawer.tsx` (create)
- **Action:** create
- **Changes:** Move loot name input and logging logic from `SessionQuickActions.tsx`.

### Step 4: Extract QuoteDrawer
- **File:** `src/features/session/actions/QuoteDrawer.tsx` (create)
- **Action:** create
- **Changes:** Move quote text input and logging logic from `SessionQuickActions.tsx`.

### Step 5: Extract RumorDrawer
- **File:** `src/features/session/actions/RumorDrawer.tsx` (create)
- **Action:** create
- **Changes:** Move rumor text, source picker (NPC notes), and logging logic from `SessionQuickActions.tsx`.

### Step 6: Refactor SessionQuickActions as thin orchestrator
- **File:** `src/features/session/SessionQuickActions.tsx` (modify)
- **Action:** modify
- **Changes:**
  1. Remove all extracted code (skill constants, drawer rendering functions, sub-components).
  2. Keep the action menu (list of buttons that open drawers).
  3. Keep the `resolvedMembers` loading logic and `selectedMembers` state.
  4. Import and render each extracted drawer component, passing `open={activeDrawer === 'skill-check'}` etc.
  5. Keep the `close()` function that resets state.
  6. Verify all existing quick action flows still function identically.

### Step 7: Create GlobalFAB component
- **File:** `src/components/shell/GlobalFAB.tsx` (create)
- **Action:** create
- **Pattern:** Follow `src/components/primitives/Chip.tsx` for inline styles with CSS variables. Use 56px diameter circle, positioned fixed bottom-right (above BottomNav).
- **Changes:**
  1. Create component that renders a floating action button (dice icon or "+" icon).
  2. Use `useCampaignContext()` to check `activeSession`.
  3. On tap when no session: call `showToast('Start a session first')`.
  4. On tap when session active: toggle an action menu overlay (list of action types).
  5. The action menu items should trigger opening the corresponding action drawers.
  6. Style: `position: fixed; bottom: 68px; right: 16px; z-index: 100; width: 56px; height: 56px; border-radius: 28px; background: var(--color-accent); color: var(--color-on-accent); border: none; box-shadow: var(--shadow-deep); cursor: pointer; font-size: 24px;`
  7. When action menu is open, show a list of action buttons (Skill Check, Shopping, Loot, Quote, Rumor) in a vertical stack above the FAB.

### Step 8: Add GlobalFAB to ShellLayout
- **File:** `src/components/shell/ShellLayout.tsx` (modify)
- **Action:** modify
- **Changes:**
  1. Import `GlobalFAB` from `./GlobalFAB`.
  2. Add `<GlobalFAB />` inside the ShellLayout div, after `<BottomNav />`.

### Step 9: Verify TypeScript compilation
- **Run:** `npx tsc --noEmit`
- **Expected:** Zero errors.

### Step 10: Commit
- **Stage:** `git add src/features/session/actions/ src/features/session/SessionQuickActions.tsx src/components/shell/GlobalFAB.tsx src/components/shell/ShellLayout.tsx`
- **Message:** `feat: global FAB and action drawer extraction`

## Acceptance Criteria

- `[STRUCTURAL]` At least 3 action drawer components exist under `src/features/session/actions/`. (REQ-007)
- `[STRUCTURAL]` `src/components/shell/GlobalFAB.tsx` exists and is rendered inside `ShellLayout`. (REQ-005)
- `[BEHAVIORAL]` FAB is visible on all screens within ShellLayout. When no session is active, tapping FAB shows a toast "Start a session first". When a session is active, tapping FAB opens an action menu. (REQ-005, REQ-006)
- `[BEHAVIORAL]` SessionQuickActions still works correctly after refactor — all existing quick action flows function identically. (REQ-007)
- `[MECHANICAL]` `npx tsc --noEmit` passes with no errors. (REQ-028)

## Verification Commands

- **Build:** `npx tsc --noEmit`
- **Tests:** No test framework detected — skip TDD steps, implement directly.
- **Acceptance:**
  - `ls src/features/session/actions/` — verify at least 3 drawer files exist.
  - Grep `ShellLayout.tsx` for `GlobalFAB` import and usage.
  - Grep `GlobalFAB.tsx` for `activeSession` check and `showToast('Start a session first')`.
  - Grep `SessionQuickActions.tsx` for imports of extracted drawer components.

## Patterns to Follow

- `src/features/notes/QuickNoteDrawer.tsx`: Drawer component pattern (props with `onClose`, `onSaved`, uses `Drawer` primitive).
- `src/components/primitives/Drawer.tsx`: Drawer primitive with `{ open, onClose, title, children }` props.
- `src/features/session/SessionQuickActions.tsx`: Source of all action drawer logic to extract.
- `src/components/shell/ShellLayout.tsx`: Shell layout pattern for adding GlobalFAB.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/features/session/actions/SkillCheckDrawer.tsx` | Create | Extracted skill check action drawer |
| `src/features/session/actions/ShoppingDrawer.tsx` | Create | Extracted shopping action drawer with coin calculator |
| `src/features/session/actions/LootDrawer.tsx` | Create | Extracted loot action drawer |
| `src/features/session/actions/QuoteDrawer.tsx` | Create | Extracted quote action drawer |
| `src/features/session/actions/RumorDrawer.tsx` | Create | Extracted rumor action drawer |
| `src/features/session/SessionQuickActions.tsx` | Modify | Thin orchestrator composing extracted drawers |
| `src/components/shell/GlobalFAB.tsx` | Create | Global floating action button for dice/actions |
| `src/components/shell/ShellLayout.tsx` | Modify | Add GlobalFAB to shell layout |
