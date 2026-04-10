---
scenario_id: "SR-14"
title: "KB Screen routing — /kb renders VaultBrowser"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - ui
  - ss-08
---

# Scenario SR-14: KB Screen routing — /kb renders VaultBrowser

## Description
Verifies that navigating to /kb renders the VaultBrowser component within the ShellLayout, with the bottom navigation bar visible and the KB tab active.

## Preconditions
- App is built and running at https://localhost:4173
- A campaign exists

## Steps

1. Use `browser_navigate` to open https://localhost:4173/kb
2. Use `browser_snapshot` to capture the full page
3. Verify the VaultBrowser component is rendered (category tabs or note cards visible)
4. Verify the ShellLayout bottom navigation bar is visible at the bottom of the screen
5. Verify the KB/Knowledge Base tab in the bottom nav is in an active/selected state
6. Verify the page title or header indicates the Knowledge Base screen
7. Use `browser_click` on a different bottom nav tab (e.g., Sessions or Campaign)
8. Use `browser_snapshot` to verify navigation away from /kb
9. Use `browser_click` on the KB bottom nav tab
10. Use `browser_snapshot` to verify return to /kb with VaultBrowser rendered

## Expected Results
- /kb route renders the VaultBrowser component
- ShellLayout bottom navigation is visible
- The KB tab in bottom nav is highlighted as active
- Navigation away and back works correctly via bottom nav

## Execution Tool
playwright — Use browser_navigate to /kb, browser_snapshot to verify layout and navigation

## Pass / Fail Criteria
- **Pass:** VaultBrowser renders at /kb within ShellLayout, bottom nav is visible with KB tab active
- **Fail:** /kb shows a blank page, bottom nav is missing, or the KB tab is not highlighted
