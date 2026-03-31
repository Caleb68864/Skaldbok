---
scenario_id: "UI-11"
title: "Settings Screen configuration"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario UI-11: Settings Screen configuration

## Description
Verify the Settings screen allows theme selection, bottom nav tab toggles, combat panel visibility toggles, clear data confirmation flow, and PWA install button presence. Changes should persist after navigating away and returning.

## Preconditions
- App is running at localhost (default port)
- At least one character exists (required for combat panel toggles)
- An active character is selected

## Steps
1. Navigate to `/settings`
2. Verify the page heading "Settings" is visible
3. In the "Theme" card, click the "Parchment" theme button
4. Verify the "Parchment" button now has an active border style (2px solid primary color)
5. In the "Bottom Navigation" card, locate the "Reference" tab row and click its toggle button (currently "ON" or "OFF")
6. Verify the toggle text changes (e.g., from "ON" to "OFF" or vice versa)
7. In the "Combat Panels" card, locate the "Death Rolls" panel row and click its toggle button
8. Verify the toggle text changes (e.g., from "ON" to "OFF" or vice versa)
9. Navigate away to `/character/sheet` using the bottom nav
10. Navigate back to `/settings`
11. Verify "Parchment" theme button still shows as selected (active border)
12. Verify the "Reference" bottom nav toggle retains its changed state
13. Verify the "Death Rolls" combat panel toggle retains its changed state
14. In the "Install App" card, verify either the "Install Skaldbok" button is visible or the fallback instructions text is present
15. In the "Danger Zone" card, click "Clear All Data"
16. Verify a modal appears with title "Are you sure?" and text about deleting all data
17. Click "Continue" in the modal
18. Verify a second modal appears with title "Final Confirmation" and an input field
19. Verify the "Delete Everything" button is disabled
20. Type "DELETE" into the confirmation input
21. Verify the "Delete Everything" button becomes enabled
22. Click "Cancel" to close without deleting

## Expected Results
- Theme selection updates immediately and persists across navigation
- Bottom nav tab toggles switch between ON/OFF and persist
- Combat panel toggles switch between ON/OFF and persist
- Clear data flow requires two-step confirmation with typed "DELETE" input
- PWA install section is always visible (either install button or fallback text)
- Cancel in the clear data modal closes without deleting anything

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** All theme, toggle, and clear-data UI interactions work as described; changes persist after navigation round-trip
- **Fail:** Any toggle does not change state, theme selection does not persist, clear data modal flow is broken, or combat panels section is missing when a character is active
