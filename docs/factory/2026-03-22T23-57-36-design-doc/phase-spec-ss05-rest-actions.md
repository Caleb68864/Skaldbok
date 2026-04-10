# Phase Spec: SS-05 — Rest Actions (Shared Logic and UI)

## Dependencies
- **None** — Self-contained feature.

## Objective
Implement round rest and stretch rest action flows as shared logic, and add rest buttons to both SheetScreen and CombatScreen. Rest buttons are play-mode only.

## Requirements Covered
REQ-004, REQ-013, REQ-014, REQ-015

## Files to Modify
- `src/utils/restActions.ts` — **NEW FILE** — shared rest logic functions
- `src/screens/SheetScreen.tsx` — "Rest & Recovery" SectionPanel with rest buttons
- `src/screens/CombatScreen.tsx` — matching rest buttons
- `src/theme/theme.css` — rest button styles, rest modal/prompt styles

## Acceptance Criteria
1. `[STRUCTURAL]` SheetScreen has a "Rest & Recovery" `SectionPanel` containing Round Rest and Stretch Rest buttons.
2. `[STRUCTURAL]` CombatScreen has matching Round Rest and Stretch Rest buttons.
3. `[BEHAVIORAL]` Rest buttons are visible only in play mode. In edit mode, the rest section is hidden or buttons are disabled.
4. `[BEHAVIORAL]` Round Rest: opens a prompt/modal asking "Roll a d6 for WP recovery", accepts a number input (1-6), adds the value to `WP.current` (capped at `WP.max`), and shows a toast "Recovered X WP".
5. `[BEHAVIORAL]` Stretch Rest: opens a prompt/modal asking for WP d6 and HP d6 results, sets `WP.current = WP.max`, adds HP value to `HP.current` (capped at `HP.max`), optionally presents condition list to clear one, and shows a toast summary.
6. `[BEHAVIORAL]` Resting when already at full WP/HP works without error; toast shows "Already at full WP/HP".
7. `[BEHAVIORAL]` Entered values exceeding remaining capacity are automatically capped at max.
8. `[STRUCTURAL]` Rest buttons have >= 44px touch targets and use existing button styling patterns.
9. `[BEHAVIORAL]` No in-app dice rolling — all dice results are entered manually from physical dice.

## Implementation Steps

1. **Create rest utility** (`src/utils/restActions.ts`):
   - `applyRoundRest(character, wpRoll: number): { newWpCurrent: number; recovered: number; alreadyFull: boolean }` — adds wpRoll to WP.current, capped at WP.max.
   - `applyStretchRest(character, wpRoll: number, hpRoll: number, conditionToClear?: string): { newWpCurrent: number; newHpCurrent: number; wpRecovered: number; hpRecovered: number; conditionCleared?: string; alreadyFullWp: boolean; alreadyFullHp: boolean }` — sets WP to max, adds HP (capped), optionally clears condition.
   - Pure functions, no side effects. Character update is done by the calling component.

2. **Add rest UI to SheetScreen**:
   - Add a "Rest & Recovery" `SectionPanel` (play mode only).
   - Two buttons: "Round Rest" and "Stretch Rest".
   - Round Rest button: opens modal/prompt with number input (1-6). On confirm, call `applyRoundRest()`, update character, show toast.
   - Stretch Rest button: opens modal/prompt with two number inputs (WP d6, HP d6) and optional condition selector. On confirm, call `applyStretchRest()`, update character, show toast.

3. **Add rest UI to CombatScreen**:
   - Add matching Round Rest and Stretch Rest buttons.
   - Same modal/prompt flow as SheetScreen.
   - Share the same utility functions.

4. **Create rest prompt modal/dialog**:
   - Reuse existing modal patterns if available.
   - Number input with validation (1-6 range).
   - For stretch rest: two inputs + optional condition dropdown.
   - Cancel and Confirm buttons.

5. **Toast notifications**:
   - Round Rest: "Recovered X WP" or "Already at full WP".
   - Stretch Rest: "WP restored to max. Recovered X HP." + optional "Cleared [condition]".

6. **Add CSS**: Styles for rest buttons, rest modal in `theme.css`. All three themes via CSS custom properties.

## Edge Cases
- Rest when already at full WP/HP: works without error, toast shows "Already at full WP/HP".
- Entered value exceeding remaining capacity: automatically capped at max.
- Rest buttons in edit mode: hidden or disabled.
- No in-app dice rolling — all results entered manually.
- Input validation: only accept 1-6 for d6 rolls.

## Constraints
- Shared logic in utility file, consumed by both SheetScreen and CombatScreen.
- Modal/prompt reuses existing modal patterns if available.
- No new npm dependencies.
- Touch targets >= 44px.
- Components must not exceed 400 lines.

## Verification Commands
```bash
# Build check
npx vite build

# Verify new utility file
ls src/utils/restActions.ts

# Verify rest functions
grep -r "applyRoundRest\|applyStretchRest" src/utils/restActions.ts

# Verify rest UI on SheetScreen
grep -r "Rest.*Recovery\|Round Rest\|Stretch Rest" src/screens/SheetScreen.tsx

# Verify rest UI on CombatScreen
grep -r "Round Rest\|Stretch Rest" src/screens/CombatScreen.tsx

# Verify play-mode gating
grep -r "playMode\|editMode\|isEditMode\|isPlayMode" src/screens/SheetScreen.tsx
```
