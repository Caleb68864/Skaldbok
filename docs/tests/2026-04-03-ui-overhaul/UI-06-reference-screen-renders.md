---
scenario_id: "UI-06"
title: "Reference screen renders with tabs"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - screens
---

# Scenario UI-06: Reference screen renders with tabs

## Description
Verify the Reference screen renders with Game Reference / My Notes tabs, search bar, and collapsible rule sections.

## Preconditions
- App running at https://localhost:4173

## Steps

1. Navigate to https://localhost:4173/reference
2. Dismiss stale session dialog if present
3. Verify "Game Reference" and "My Notes" tabs exist
4. Verify search input field exists
5. Verify rule sections render: Measuring Time, Attributes, Conditions, etc.
6. Verify sub-tabs: Core Rules, Combat, Mishap Tables, Magic
7. Take screenshot

## Expected Results
- Both main tabs visible
- Search bar present
- Reference sections with collapsible panels
- Sub-tab navigation working
- No JS console errors

## Execution Tool
playwright — browser_navigate, browser_snapshot, browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** All reference elements render correctly
- **Fail:** Missing tabs, broken sections, or console errors
