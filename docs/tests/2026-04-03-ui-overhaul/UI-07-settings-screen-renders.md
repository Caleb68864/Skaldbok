---
scenario_id: "UI-07"
title: "Settings screen renders all options"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - screens
---

# Scenario UI-07: Settings screen renders all options

## Description
Verify the Settings screen renders Install App, Theme selector, Default Mode toggle, Bottom Navigation toggles, and Combat Panels toggles.

## Preconditions
- App running at https://localhost:4173

## Steps

1. Navigate to https://localhost:4173/settings
2. Dismiss stale session dialog if present
3. Verify "Settings" heading
4. Verify "Install App" section with Install button
5. Verify "Theme" section with Dark, Parchment, Light options
6. Verify "Default Mode" section with Play/Edit toggle
7. Verify "Bottom Navigation" section with toggle switches for each tab
8. Verify "Combat Panels" section with toggles
9. Take screenshot

## Expected Results
- All settings sections rendered
- Theme options show descriptions
- Toggle switches are interactive
- No JS console errors

## Execution Tool
playwright — browser_navigate, browser_snapshot, browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** All settings sections render with correct controls
- **Fail:** Missing sections or broken controls
