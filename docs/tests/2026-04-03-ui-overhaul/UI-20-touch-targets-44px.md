---
scenario_id: "UI-20"
title: "Touch targets meet 44px minimum"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - audit
---

# Scenario UI-20: Touch targets meet 44px minimum

## Description
Verify all interactive elements (buttons, links, toggle switches) meet the 44x44px minimum touch target size per Apple HIG and WCAG 2.5.5.

## Preconditions
- App running at https://localhost:4173

## Steps

1. Navigate to https://localhost:4173/character/sheet
2. Dismiss stale session dialog if present
3. Use browser_evaluate to measure computed height of Button elements
4. Verify all buttons have height >= 44px
5. Verify BottomNav links have height >= 44px
6. Verify FAB has width and height >= 44px
7. Navigate to /settings
8. Verify toggle switches have height >= 44px
9. Navigate to /session
10. Verify quick log action buttons have height >= 44px

## Expected Results
- All Button variants: computed height >= 44px
- BottomNav items: computed height >= 44px
- FAB: width and height >= 44px (actually 56px/w-14)
- Toggle switches: touch-friendly size
- IconButtons: min-h-[44px] and min-w-[44px]

## Execution Tool
playwright — browser_navigate, browser_evaluate to measure element dimensions

## Pass / Fail Criteria
- **Pass:** All measured interactive elements >= 44px in their tap dimension
- **Fail:** Any interactive element below 44px
