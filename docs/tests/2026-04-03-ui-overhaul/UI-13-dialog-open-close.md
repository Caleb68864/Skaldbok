---
scenario_id: "UI-13"
title: "Dialog opens and closes (keyboard + click)"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - components
---

# Scenario UI-13: Dialog opens and closes (keyboard + click)

## Description
Verify the shadcn Dialog component (used for modals) opens with animation, traps focus, closes on Escape key, and closes on backdrop click.

## Preconditions
- App running at https://localhost:4173
- A dialog trigger exists (e.g., stale session dialog, or navigate to trigger one)

## Steps

1. Navigate to https://localhost:4173/session (triggers stale session dialog)
2. Verify dialog element with role="dialog" appears
3. Verify dialog has a heading and descriptive content
4. Verify dialog has action buttons
5. Verify focus is within the dialog (tab key stays inside)
6. Press Escape key
7. Verify dialog closes
8. Navigate again to re-trigger dialog
9. Click outside the dialog (backdrop area)
10. Verify dialog closes

## Expected Results
- Dialog renders with proper ARIA role
- Focus trapped within dialog
- Escape key closes dialog
- Backdrop click closes dialog
- Smooth animation on open/close
- No JS console errors

## Execution Tool
playwright — browser_navigate, browser_snapshot, browser_press_key, browser_click

## Pass / Fail Criteria
- **Pass:** Dialog opens, focus trapped, closes via Escape and backdrop click
- **Fail:** Focus escapes dialog, keyboard close broken, or backdrop click doesn't work
