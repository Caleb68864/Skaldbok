---
scenario_id: "UI-01"
title: "Sheet Screen renders character data and resource controls"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario UI-01: Sheet Screen renders character data and resource controls

## Description
Verify the Sheet Screen renders all character panels (Identity, Attributes, Resources, Derived Values, Rest & Recovery) with correct data, and that resource increment/decrement controls function properly.

## Preconditions
- A character named "Test Warrior" has been created via the Character Library screen and set as active.
- The app is running at localhost (e.g., http://localhost:5173).

## Steps
1. Navigate to `http://localhost:5173/library`.
2. Click the "+ New Character" button.
3. In the modal, type "Test Warrior" in the character name input and click "Create".
4. If a "Set Active" banner appears, click "Set Active". Otherwise, the first character is auto-activated.
5. Navigate to `http://localhost:5173/character/sheet`.
6. Assert the "Identity" SectionPanel is visible and contains the text "Test Warrior" in the name input.
7. Assert the "Attributes" SectionPanel is visible. Verify attribute fields are rendered (look for abbreviations like "STR", "CON", "AGL", "INT", "WIL", "CHA").
8. Assert the "Resources" SectionPanel is visible. Verify "HP" and "WP" labels are present.
9. Locate the HP ResourceTracker. Note the current HP value displayed.
10. Click the HP decrement button (the "-" button next to the HP counter). Assert the HP current value decreased by 1.
11. Click the HP increment button (the "+" button next to the HP counter). Assert the HP current value increased by 1 (back to original).
12. Locate the WP ResourceTracker. Click the WP decrement button. Assert WP decreased by 1.
13. Click the WP increment button. Assert WP returned to original.
14. Assert the "Derived Values" SectionPanel is visible. Verify labels "Movement", "HP Max", "WP Max", "STR Damage Bonus", "AGL Damage Bonus" are present.
15. Assert the "Conditions" section is visible (either under Attributes or as a standalone panel). Verify condition toggle buttons are rendered.
16. Click the "Identity" SectionPanel collapse toggle. Assert the identity content is hidden.
17. Click the "Identity" SectionPanel collapse toggle again. Assert the identity content is visible again.

## Expected Results
- All five panels (Identity, Attributes, Resources, Derived Values, and conditionally Rest & Recovery) render without errors.
- The character name "Test Warrior" appears in the Identity panel.
- Six attribute fields (STR, CON, AGL, INT, WIL, CHA) are displayed with numeric values.
- HP and WP counters display current/max values and respond to increment/decrement clicks.
- Derived value labels are present with computed numeric values.
- SectionPanels collapse and expand when their toggle is clicked.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** All panels render with expected content, resource counters increment/decrement correctly, and collapsible panels toggle visibility.
- **Fail:** Any panel fails to render, resource counters do not update on click, or collapse/expand does not work.
