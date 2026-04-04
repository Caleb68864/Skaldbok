---
scenario_id: "UI-12"
title: "GlobalFAB opens quick actions"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - shell
---

# Scenario UI-12: GlobalFAB opens quick actions

## Description
Verify the floating action button (FAB) renders with Lucide Sparkles/Plus icon, opens a quick action menu on click, and does not overlap with SessionLogOverlay buttons.

## Preconditions
- App running at https://localhost:4173
- Active session (FAB should show Sparkles icon)

## Steps

1. Navigate to https://localhost:4173/character/sheet
2. Dismiss stale session dialog if present
3. Verify FAB button exists with aria-label "Open quick actions"
4. Verify FAB has an SVG icon (Sparkles when session active)
5. Click the FAB button
6. Verify quick action menu appears with labeled items
7. Verify action items have Lucide icons
8. Click FAB again to close menu
9. Verify menu dismisses
10. Take screenshot

## Expected Results
- FAB visible in bottom-right corner
- Lucide icon renders correctly
- Quick action menu opens/closes on click
- Action items have icons + labels
- FAB does not overlap with other floating elements
- No JS console errors

## Execution Tool
playwright — browser_navigate, browser_snapshot, browser_click, browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** FAB renders, opens menu with action items, closes correctly
- **Fail:** FAB hidden, menu doesn't open, or overlap with other elements
