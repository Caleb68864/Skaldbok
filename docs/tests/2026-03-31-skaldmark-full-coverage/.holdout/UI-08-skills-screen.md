---
scenario_id: "UI-08"
title: "Skills Screen display, filters, dragon marks, and boon/bane"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario UI-08: Skills Screen display, filters, dragon marks, and boon/bane

## Description
Verify the Skills Screen renders skill categories with values, supports filter tabs (Relevant/All), dragon mark toggling in play mode, per-skill boon/bane override cycling, and global boon/bane selector.

## Preconditions
- A character exists and is set as active with at least a few trained skills (e.g., Awareness, Sneaking).
- The app is in Play Mode (so dragon mark toggles are visible and skill value inputs are locked).

## Steps
1. Navigate to `http://localhost:5173/character/skills`.
2. Assert the page heading "Skills" is visible.
3. Assert the filter chips "Relevant" and "All" are visible. Assert "Relevant" is active by default.
4. In the "Relevant" filter, assert only trained skills are displayed (skills with value > 0 or trained flag).
5. Click the "All" filter chip. Assert all skill categories render with all skills visible, including untrained ones showing base chance values.
6. Click the "Relevant" filter chip to return to the filtered view.
7. Locate a trained skill row (e.g., one with a shield icon and bold name text). Assert it has a numeric value input and a probability display.
8. Assert the Global Boon/Bane selector is visible with three segments: "Boon", "Normal", "Bane".
9. Assert "Normal" is the active/pressed segment by default (aria-pressed="true").
10. Click the "Boon" segment. Assert it becomes active. Assert probability displays update across skill rows (values should show "with boon" text).
11. Click the "Normal" segment to reset.
12. Click the "Bane" segment. Assert it becomes active. Assert probability displays show "with bane" text.
13. Click "Normal" to reset.
14. Locate a skill row's per-skill boon/bane override button (showing text content of a circle symbol). Assert it displays the default state.
15. Click the override button once. Assert it changes to show the boon symbol (star) and title changes to "Override: Boon".
16. Click the override button again. Assert it changes to the bane symbol (cross) with title "Override: Bane".
17. Click the override button a third time. Assert it returns to the default state (no override).
18. Locate a trained skill row. Find the dragon mark toggle button (contains dragon emoji). Click it.
19. Assert the skill row gains the `dragon-marked` CSS class.
20. Assert the dragon mark count badge appears near the header showing "1 marked".
21. Click the dragon mark toggle again. Assert the `dragon-marked` class is removed and the count badge disappears or updates.
22. Switch to Edit Mode. Navigate back to `/character/skills`.
23. Assert skill value inputs are now editable (not disabled). Change a skill value by typing a new number. Assert the input updates.
24. Assert trained checkboxes are visible. Toggle a skill's trained checkbox. Assert the skill value recalculates based on the linked attribute.

## Expected Results
- Skills render in categorized groups with names, linked attribute tags, values, and probability displays.
- "Relevant" filter shows only trained/non-zero skills; "All" shows everything.
- Global boon/bane selector updates probability displays across all skills.
- Per-skill override button cycles through none, boon, bane states.
- Dragon mark toggles add/remove the `dragon-marked` class and update the count badge.
- In Edit Mode, skill values are editable and trained checkboxes toggle with value recalculation.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Filter tabs work, global and per-skill boon/bane controls update probabilities, dragon marks toggle and count correctly, and edit mode enables value editing.
- **Fail:** Filter does not change displayed skills, boon/bane selectors do not update probabilities, dragon marks fail to toggle, or edit mode does not enable inputs.
