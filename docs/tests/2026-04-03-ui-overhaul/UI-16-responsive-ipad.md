---
scenario_id: "UI-16"
title: "Responsive layout — iPad tablet (810x1080)"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - responsive
---

# Scenario UI-16: Responsive layout — iPad tablet (810x1080)

## Description
Verify the app renders correctly on iPad viewport (810x1080). Sheet screen should show two-column layout for Attributes+Resources and Derived Values+Rest & Recovery.

## Preconditions
- App running at https://localhost:4173

## Steps

1. Resize viewport to 810x1080
2. Navigate to https://localhost:4173/character/sheet
3. Dismiss stale session dialog if present
4. Verify Sheet screen uses two-column layout (Attributes beside Resources)
5. Verify Identity section spans full width
6. Verify Derived Values beside Rest & Recovery
7. Take screenshot of Sheet
8. Navigate to /session
9. Verify session content fits tablet width
10. Take screenshot
11. Navigate to /settings
12. Verify settings layout
13. Take screenshot

## Expected Results
- Two-column layout on Sheet (Attributes | Resources, Derived | Rest)
- Content fills tablet width appropriately
- No wasted space or overly narrow columns
- All interactive elements accessible
- No JS console errors

## Execution Tool
playwright — browser_resize, browser_navigate, browser_snapshot, browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** Two-column layout renders on tablet, all content accessible
- **Fail:** Single-column on tablet (wasted space) or broken columns
