---
scenario_id: "UI-04"
title: "Magic screen renders"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - screens
---

# Scenario UI-04: Magic screen renders

## Description
Verify the Magic screen renders with spell list and magic-related sections.

## Preconditions
- App running at https://localhost:4173
- Active character in campaign

## Steps

1. Navigate to https://localhost:4173/character/magic
2. Dismiss stale session dialog if present
3. Verify Magic tab is selected in sub-nav
4. Verify magic/spell sections render
5. Take screenshot

## Expected Results
- Magic screen renders with proper sections
- No JS console errors
- Tailwind classes applied (no inline styles)

## Execution Tool
playwright — browser_navigate, browser_snapshot, browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** Screen renders correctly
- **Fail:** Missing sections or console errors
