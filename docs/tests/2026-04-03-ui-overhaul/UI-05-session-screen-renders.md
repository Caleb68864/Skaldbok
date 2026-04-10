---
scenario_id: "UI-05"
title: "Session screen renders with log"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - screens
---

# Scenario UI-05: Session screen renders with log

## Description
Verify the Session screen renders campaign name, session info, quick log actions, export buttons, notes list, and note type filters.

## Preconditions
- App running at https://localhost:4173
- Active session exists

## Steps

1. Navigate to https://localhost:4173/session
2. Dismiss stale session dialog if present
3. Verify campaign name heading is visible
4. Verify session date/time info displayed
5. Verify "End Session" button exists
6. Verify quick log action buttons: Skill Check, Cast Spell, Ability, Condition, Damage, etc.
7. Verify Notes section with filter chips: All, Generic, NPC, Location, Combat, Loot, Rumor, Quote, Skill Check, Recap
8. Verify session log entries are listed
9. Take screenshot

## Expected Results
- Campaign name and session info displayed
- All quick log buttons rendered
- Note filters visible
- Session log entries listed with timestamps
- No JS console errors

## Execution Tool
playwright — browser_navigate, browser_snapshot, browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** All session elements render correctly
- **Fail:** Missing elements, broken layout, or console errors
