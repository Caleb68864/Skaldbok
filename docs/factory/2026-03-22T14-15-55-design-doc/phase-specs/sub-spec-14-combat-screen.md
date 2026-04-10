---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 14
title: "Combat Screen"
date: 2026-03-22
dependencies: ["9", "10"]
---

# Sub-Spec 14: Combat Screen

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Build the Combat screen optimized for one-handed tablet use during live play. Features oversized HP/WP counters (visibly larger than on the Sheet screen), large condition toggles, death roll tracking (success/failure counters), and a quick summary of the currently equipped weapon and armor/helmet. All controls work in Play Mode. Changes made here are reflected on the Sheet screen via shared character context.

## Interface Contracts

### Provides
- `src/screens/CombatScreen.tsx`: Full combat screen component
- `src/components/fields/CombatResourcePanel.tsx`: Oversized HP/WP counter panel
- `src/components/fields/QuickConditionPanel.tsx`: Large condition toggles optimized for combat

### Requires
- From sub-spec 9: `ResourceTracker` concept (but Combat uses larger variants), `useAutosave` hook
- From sub-spec 10: Mode is irrelevant here -- Combat screen controls are always interactive (it is a Play Mode screen)
- From sub-spec 7: `useActiveCharacter()` for character data

### Shared State
- ActiveCharacterContext: all changes flow through the same context, so Sheet and Combat share state

## Implementation Steps

### Step 1: Create CombatResourcePanel component
- **File:** `src/components/fields/CombatResourcePanel.tsx`
- **Action:** create
- **Changes:** Oversized HP and WP counters:
  - Large number display (font-size 3-4rem)
  - Decrement/increment buttons with 60x60px+ touch targets
  - Current/max display: "7 / 10"
  - Color-coded: HP uses a health color (red when low), WP uses a mana/magic color
  - Death roll section: appears when HP reaches 0, shows success/failure counters (3 each, like checkboxes or counter)

### Step 2: Create QuickConditionPanel component
- **File:** `src/components/fields/QuickConditionPanel.tsx`
- **Action:** create
- **Changes:** Large condition toggles in a 2x3 or 3x2 grid:
  - Each toggle is a large button (min 64x64px) with condition name
  - Active conditions are highlighted with `--color-danger` or similar
  - Tap toggles the condition on/off
  - Shows the linked attribute abbreviation subtly

### Step 3: Build CombatScreen
- **File:** `src/screens/CombatScreen.tsx`
- **Action:** modify (replace placeholder)
- **Changes:**
  - Guard: redirect to /library if no active character
  - Top section: `CombatResourcePanel` with HP and WP
  - Middle section: `QuickConditionPanel` with all 6 conditions
  - Death rolls section: Two counters (Successes: 0/3, Failures: 0/3) -- visible always but prominently highlighted when HP is 0
  - Equipment summary section: Show name of equipped weapon (if any) and armor/helmet names with ratings. Read-only display -- editing happens on Gear screen.
  - All controls are interactive regardless of Play/Edit mode (Combat is inherently a play screen)
  - Changes flow through `updateCharacter()` -> autosave

### Step 4: Verify
- **Run:** `npx tsc --noEmit && npm run build`
- **Expected:** Passes.

### Step 5: Commit
- **Stage:** `git add src/screens/CombatScreen.tsx src/components/fields/CombatResourcePanel.tsx src/components/fields/QuickConditionPanel.tsx`
- **Message:** `feat: combat screen`

## Acceptance Criteria

- `[BEHAVIORAL]` HP and WP counters on the Combat screen have visibly larger touch targets than on the Sheet screen (REQ-029)
- `[BEHAVIORAL]` Condition toggles on the Combat screen are functional and persist changes (REQ-029)
- `[BEHAVIORAL]` Death roll counter increments/decrements and persists (REQ-029)
- `[STRUCTURAL]` The Combat screen shows a summary of the currently equipped weapon and armor/helmet (REQ-029)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework -- verify in browser.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - Large counters: Visually compare HP counter size on Combat vs Sheet screen -- Combat should be noticeably larger
  - Conditions: Toggle a condition on Combat screen, navigate to Sheet screen, verify same condition is toggled
  - Death rolls: Increment death roll success counter, reload, verify persisted
  - Equipment summary: Equip a weapon on Gear screen, go to Combat, verify weapon name shown

## Patterns to Follow

- Combat screen components are distinct from Sheet screen components -- they have their own oversized styling, not shared with the regular-sized Sheet variants.
- All character mutations go through `useActiveCharacter().updateCharacter()` -- the same context as Sheet, ensuring consistency.
- Death roll counters use the same `resources.deathRolls` field on the character record.
- Equipment summary reads `character.weapons.filter(w => w.equipped)` and `character.armor`/`character.helmet`.

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/components/fields/CombatResourcePanel.tsx | Create | Oversized HP/WP counters for combat |
| src/components/fields/QuickConditionPanel.tsx | Create | Large condition toggle grid |
| src/screens/CombatScreen.tsx | Modify | Full combat screen replacing placeholder |
