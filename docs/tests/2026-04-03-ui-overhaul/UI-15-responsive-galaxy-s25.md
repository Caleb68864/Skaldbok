---
scenario_id: "UI-15"
title: "Responsive layout — Galaxy S25 phone (412x915)"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - responsive
---

# Scenario UI-15: Responsive layout — Galaxy S25 phone (412x915)

## Description
Verify the app renders correctly on a Galaxy S25 phone viewport (412x915). All content should be readable, touch targets adequate, and no horizontal scrolling.

## Preconditions
- App running at https://localhost:4173

## Steps

1. Resize viewport to 412x915
2. Navigate to https://localhost:4173/character/sheet
3. Dismiss stale session dialog if present
4. Verify Sheet screen renders in single-column layout
5. Verify all section panels stack vertically
6. Verify BottomNav fits within viewport width
7. Verify FAB is visible and not clipped
8. Take screenshot of Sheet screen
9. Navigate to /session
10. Verify session screen content is readable
11. Take screenshot
12. Navigate to /reference
13. Verify reference tables don't overflow horizontally
14. Take screenshot

## Expected Results
- Single-column layout on all screens
- No horizontal overflow/scrolling
- All text readable without zooming
- Touch targets visually adequate (44px+)
- BottomNav icons + labels visible
- FAB visible and clickable
- No JS console errors

## Execution Tool
playwright — browser_resize, browser_navigate, browser_snapshot, browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** All screens render in mobile layout without overflow
- **Fail:** Horizontal scroll, clipped content, or inaccessible elements
