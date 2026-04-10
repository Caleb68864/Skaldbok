---
scenario_id: "UI-08"
title: "Character Library screen renders"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - screens
---

# Scenario UI-08: Character Library screen renders

## Description
Verify the Character Library screen renders with character list, Import/New Character buttons, and action buttons per character.

## Preconditions
- App running at https://localhost:4173
- At least one character exists

## Steps

1. Navigate to https://localhost:4173/library
2. Dismiss stale session dialog if present
3. Verify "Character Library" heading
4. Verify "Import Character" and "+ New Character" buttons exist
5. Verify at least one character card is displayed with name
6. Verify character action buttons: Set Active, Export, Duplicate, Delete
7. Take screenshot

## Expected Results
- Library heading visible
- Action buttons present
- Character cards displayed with action buttons
- No JS console errors

## Execution Tool
playwright — browser_navigate, browser_snapshot, browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** Library renders with character cards and all buttons
- **Fail:** Missing elements or console errors
