---
scenario_id: "UI-03"
title: "Gear screen renders"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - screens
---

# Scenario UI-03: Gear screen renders

## Description
Verify the Gear screen renders with inventory sections and equipment panels.

## Preconditions
- App running at https://localhost:4173
- Active character in campaign

## Steps

1. Navigate to https://localhost:4173/character/gear
2. Dismiss stale session dialog if present
3. Verify Gear tab is selected in sub-nav
4. Verify inventory/equipment sections render
5. Take screenshot

## Expected Results
- Gear screen renders with proper sections
- No JS console errors
- Tailwind classes applied (no inline styles)

## Execution Tool
playwright — browser_navigate, browser_snapshot, browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** Screen renders correctly
- **Fail:** Missing sections or console errors
