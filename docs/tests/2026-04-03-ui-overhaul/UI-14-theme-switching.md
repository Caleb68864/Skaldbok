---
scenario_id: "UI-14"
title: "Theme switching works without reload"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - components
---

# Scenario UI-14: Theme switching works without reload

## Description
Verify theme switching between dark, parchment, and light themes works instantly without page reload, and all Tailwind classes resolve correctly via CSS custom properties.

## Preconditions
- App running at https://localhost:4173

## Steps

1. Navigate to https://localhost:4173/settings
2. Dismiss stale session dialog if present
3. Take screenshot of current theme (dark by default)
4. Verify data-theme attribute on document element is "dark"
5. Click "Parchment" theme option
6. Verify data-theme changes to "parchment" without page reload
7. Take screenshot of parchment theme
8. Navigate to /character/sheet to verify theme persists across routes
9. Take screenshot showing theme on Sheet screen
10. Navigate back to /settings
11. Click "Light" theme option
12. Verify data-theme changes to "light"
13. Take screenshot of light theme
14. Click "Dark" to restore default
15. Verify data-theme is "dark" again

## Expected Results
- Theme changes instantly (no flicker, no reload)
- CSS custom properties update across all elements
- Theme persists across navigation
- All three themes visually distinct
- No broken colors or missing styles in any theme
- No JS console errors

## Execution Tool
playwright — browser_navigate, browser_snapshot, browser_click, browser_evaluate, browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** All three themes render correctly, switch instantly, persist
- **Fail:** Flicker on switch, colors break, or theme doesn't persist
