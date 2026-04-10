---
scenario_id: "UI-01"
title: "Sheet screen renders with all sections"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - screens
---

# Scenario UI-01: Sheet screen renders with all sections

## Description
Verify the character Sheet screen renders all expected sections (Identity, Attributes, Resources, Derived Values, Rest & Recovery) using Tailwind classes.

## Preconditions
- App running at https://localhost:4173
- Active character exists in a campaign
- Dismiss any stale session dialogs

## Steps

1. Navigate to https://localhost:4173/character/sheet
2. Dismiss stale session dialog if present (click "Continue")
3. Verify the page title area contains "Sheet" tab as selected
4. Verify "Identity" section panel exists with Name, Kin, Profession, Age, Weakness fields
5. Verify "Attributes" section panel exists with STR, CON, AGL, INT, WIL, CHA
6. Verify "Resources" section panel exists with Hit Points and Willpower Points counters
7. Verify "Derived Values" section panel exists
8. Verify "Rest & Recovery" section panel exists with Round Rest, Stretch Rest, Shift Rest buttons
9. Take a screenshot for visual verification

## Expected Results
- All 5 section panels visible and expanded
- Character name field shows existing character name
- Attribute values displayed with condition toggles
- Resource counters have +/- buttons
- No JavaScript console errors (except SSL/PWA)

## Execution Tool
playwright — Navigate with browser_navigate, verify with browser_snapshot, capture with browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** All 5 sections render, no JS errors, all interactive elements present
- **Fail:** Any section missing, JS errors in console, or layout broken
