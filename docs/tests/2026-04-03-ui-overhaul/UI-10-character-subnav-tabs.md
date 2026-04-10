---
scenario_id: "UI-10"
title: "CharacterSubNav tabs switch content"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - shell
---

# Scenario UI-10: CharacterSubNav tabs switch content

## Description
Verify the character sub-navigation uses Radix Tabs with Sheet, Skills, Gear, Magic tabs that switch screen content.

## Preconditions
- App running at https://localhost:4173
- Active character selected

## Steps

1. Navigate to https://localhost:4173/character/sheet
2. Dismiss stale session dialog if present
3. Verify tablist role element exists with 4 tabs
4. Verify tab labels: Sheet, Skills, Gear, Magic
5. Verify Sheet tab is selected (aria-selected)
6. Click Skills tab
7. Verify URL changes to /character/skills
8. Verify Skills tab is now selected
9. Click Gear tab
10. Verify URL changes to /character/gear
11. Click Magic tab
12. Verify URL changes to /character/magic

## Expected Results
- Four tabs with correct labels and GameIcon SVGs
- Tab selection state changes on click
- URL and screen content update per tab
- Tabs are keyboard navigable (arrow keys)
- No JS console errors

## Execution Tool
playwright — browser_navigate, browser_snapshot, browser_click

## Pass / Fail Criteria
- **Pass:** All 4 tabs render, switch content correctly, maintain selection state
- **Fail:** Tab switching broken, missing tabs, or incorrect URL routing
