---
scenario_id: "UI-09"
title: "BottomNav shows Lucide icons and navigates"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - shell
---

# Scenario UI-09: BottomNav shows Lucide icons and navigates

## Description
Verify the bottom navigation bar shows Lucide icons (Scroll, Flame, BookOpen) with labels, has backdrop-blur effect, and navigates correctly between main sections.

## Preconditions
- App running at https://localhost:4173

## Steps

1. Navigate to https://localhost:4173/character/sheet
2. Dismiss stale session dialog if present
3. Verify bottom navigation exists with role="navigation"
4. Verify three nav links: Characters, Session, Reference
5. Verify each link has an SVG icon (Lucide) and text label
6. Verify "Characters" link is active/highlighted
7. Click "Session" link
8. Verify URL changed to /session
9. Verify "Session" link is now active
10. Click "Reference" link
11. Verify URL changed to /reference
12. Take screenshot of final state

## Expected Results
- Three nav items with Lucide SVG icons + text labels
- Active tab visually distinguished (accent color)
- Navigation works between all three sections
- Backdrop-blur CSS present on nav element
- No JS console errors

## Execution Tool
playwright — browser_navigate, browser_snapshot, browser_click, browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** All three tabs render with icons, navigation works, active state correct
- **Fail:** Missing icons, broken navigation, or no active state indicator
