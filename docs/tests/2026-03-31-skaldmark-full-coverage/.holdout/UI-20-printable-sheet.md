---
scenario_id: "UI-20"
title: "Printable character sheet layout"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario UI-20: Printable character sheet layout

## Description
Verify the printable character sheet screen renders character data in a print-friendly layout, provides a back button, print button, and color/B&W toggle, and does not display navigation elements (bottom nav, campaign header).

## Preconditions
- App is running at localhost (default port)
- An active character is selected (so the print screen renders data instead of redirecting to /library)

## Steps
1. Navigate to `/print`
2. Verify the page does not show the bottom navigation bar (no "Session", "Notes", "Character" links)
3. Verify the page does not show the campaign header bar
4. Verify character data is rendered on the page (character name, attributes, or other sheet content from the PrintableSheet component)
5. Verify the floating print toolbar is visible with three buttons: "Back" (with arrow), "Print", and a color mode toggle (initially showing "B&W")
6. Click the color mode toggle button (initially labeled "B&W")
7. Verify the button label changes to "Color" (indicating the sheet is now in B&W mode)
8. Click the color mode toggle again
9. Verify the button label returns to "B&W" (back to color mode)
10. Click the "Back" button
11. Verify navigation returns to the previous page (e.g., the page navigated from)
12. Navigate to `/settings`
13. Verify the "Print Character Sheet" card has a "Print Character Sheet" button
14. Click "Print Character Sheet"
15. Verify the URL is now `/print` and the printable sheet is displayed

## Expected Results
- /print route renders the PrintableSheet component with character data
- No bottom nav or campaign header is visible (print route is outside the shell layout)
- Floating toolbar provides Back, Print, and Color/B&W toggle
- Color mode toggle switches between "B&W" and "Color" labels
- Back button navigates to the previous page
- Print Character Sheet button in Settings navigates to /print

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Printable sheet renders character data without navigation chrome, toolbar buttons function correctly, and color mode toggle switches between modes
- **Fail:** Navigation elements are visible on the print page, character data does not render, toolbar is missing, color toggle does not work, or back button fails to navigate
