---
scenario_id: "UI-17"
title: "Responsive layout — Galaxy A9 tablet (800x1280)"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - responsive
---

# Scenario UI-17: Responsive layout — Galaxy A9 tablet (800x1280)

## Description
Verify the app renders correctly on Galaxy A9 tablet viewport (800x1280).

## Preconditions
- App running at https://localhost:4173

## Steps

1. Resize viewport to 800x1280
2. Navigate to https://localhost:4173/character/sheet
3. Dismiss stale session dialog if present
4. Verify two-column layout similar to iPad
5. Take screenshot
6. Navigate to /reference
7. Verify reference tables render without horizontal scroll
8. Take screenshot

## Expected Results
- Similar layout to iPad (two-column on sheet)
- All content readable and accessible
- No horizontal overflow
- No JS console errors

## Execution Tool
playwright — browser_resize, browser_navigate, browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** Tablet layout renders correctly
- **Fail:** Layout breaks or content overflows
