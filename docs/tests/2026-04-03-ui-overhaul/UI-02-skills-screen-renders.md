---
scenario_id: "UI-02"
title: "Skills screen renders"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - screens
---

# Scenario UI-02: Skills screen renders

## Description
Verify the Skills screen renders with skill list, boon/normal/bane columns, and filter chips.

## Preconditions
- App running at https://localhost:4173
- Active character in campaign

## Steps

1. Navigate to https://localhost:4173/character/skills
2. Dismiss stale session dialog if present
3. Verify "Skills" heading is present
4. Verify filter chips exist: "Relevant" and "All"
5. Verify column headers: BOON, NORMAL, BANE
6. Take screenshot

## Expected Results
- Skills heading visible
- Filter chips rendered
- Column layout correct
- No JS console errors

## Execution Tool
playwright — browser_navigate, browser_snapshot, browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** Screen renders with correct layout and no errors
- **Fail:** Missing elements or console errors
