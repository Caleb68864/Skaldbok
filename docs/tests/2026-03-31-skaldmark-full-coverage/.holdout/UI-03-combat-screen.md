---
scenario_id: "UI-03"
title: "Combat Screen resources, conditions, equipment, and rest"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario UI-03: Combat Screen resources, conditions, equipment, and rest

## Description
Verify the Combat Screen displays HP/WP resource panels, condition toggles, equipment toggle buttons, death roll counters (when HP reaches 0), and rest action buttons with their modals.

## Preconditions
- A character exists and is set as active with at least one weapon and armor equipped.
- The app is in Play Mode so the Rest & Recovery section is visible.

## Steps
1. Navigate to `http://localhost:5173/character/combat`.
2. Assert the "Resources" SectionPanel is visible with "HP" and "WP" labels.
3. Locate the HP CombatResourcePanel. Note the current HP value. Click the decrement button. Assert HP decreased by 1.
4. Click the increment button. Assert HP returned to original.
5. Locate the WP CombatResourcePanel. Click decrement. Assert WP decreased by 1. Click increment. Assert WP returned.
6. Assert the "Conditions" SectionPanel is visible. Verify condition toggle buttons are rendered (e.g., Exhausted, Sickly, Dazed, Angry, Scared, Disheartened).
7. Click the "Exhausted" condition toggle. Assert it becomes active (visually toggled on).
8. Click the "Exhausted" condition toggle again. Assert it becomes inactive.
9. Assert the "Equipment" SectionPanel is visible with "Weapons" and "Armor" sub-labels.
10. If a weapon is listed, click its toggle button. Assert the weapon toggles between equipped (border highlighted with accent color) and unequipped state.
11. If armor is listed, click its toggle button. Assert the equipped/unequipped state toggles.
12. Decrement HP to 0 by clicking the HP decrement button repeatedly until HP current shows 0.
13. Assert the "Death Rolls" SectionPanel appears with the text "Character is DOWN!".
14. Assert "Failures:" label is visible with 3 circular toggle buttons.
15. Click the first death roll failure button. Assert it fills (background changes to danger color).
16. Assert "Successes:" label is visible with 3 circular toggle buttons.
17. Click the first death success button. Assert it fills (background changes to success color).
18. Click the "Reset" button below the death roll counters. Assert all failure and success marks are cleared.
19. Increment HP back above 0. Assert the Death Rolls section disappears.
20. Assert the "Rest & Recovery" SectionPanel is visible (Play Mode). Verify "Round Rest", "Stretch Rest", and "Shift Rest" buttons are present.
21. Click the "Round Rest" button. Assert a modal appears with title "Round Rest" and an input for "d6 Result (1-6)".
22. Type "3" in the d6 input and click "Confirm". Assert the modal closes.
23. Click the "Stretch Rest" button. Assert a modal appears with title "Stretch Rest" and inputs for WP d6 and HP d6.
24. Type "4" in WP d6 input, type "5" in HP d6 input, and click "Confirm". Assert the modal closes.

## Expected Results
- HP and WP resource panels render with current/max values and respond to increment/decrement.
- Condition toggles render for all six Dragonbane conditions and toggle on/off on click.
- Equipment items toggle between equipped and unequipped states.
- Death Rolls section appears only when HP is 0, with failure/success counters that toggle and reset.
- Rest modals open with correct inputs and close on confirm.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** All resource controls work, conditions toggle, equipment toggles, death rolls appear at HP 0 and reset, rest modals open and close correctly.
- **Fail:** Any resource control fails to update, conditions do not toggle, death rolls do not appear at HP 0, or rest modals fail to open/close.
