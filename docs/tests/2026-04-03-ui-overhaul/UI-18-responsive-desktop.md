---
scenario_id: "UI-18"
title: "Responsive layout — Desktop (1920x1080)"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - responsive
---

# Scenario UI-18: Responsive layout — Desktop (1920x1080)

## Description
Verify the app renders correctly on desktop viewport (1920x1080) with full-width layout.

## Preconditions
- App running at https://localhost:4173

## Steps

1. Resize viewport to 1920x1080
2. Navigate to https://localhost:4173/character/sheet
3. Dismiss stale session dialog if present
4. Verify Sheet screen uses full width effectively
5. Verify two-column panels (Attributes | Resources)
6. Verify BottomNav spans full width
7. Take screenshot
8. Navigate to /settings
9. Verify settings utilize desktop width
10. Take screenshot

## Expected Results
- Full-width layout with two-column panels
- No content uncomfortably stretched
- BottomNav centered and spaced
- FAB positioned correctly
- No JS console errors

## Execution Tool
playwright — browser_resize, browser_navigate, browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** Desktop layout renders with proper use of space
- **Fail:** Content too narrow or layout broken at wide viewport
