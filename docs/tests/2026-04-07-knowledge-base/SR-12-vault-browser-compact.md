---
scenario_id: "SR-12"
title: "Vault Browser compact mode for session screen"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - ui
  - ss-07
---

# Scenario SR-12: Vault Browser compact mode for session screen

## Description
Verifies that when the VaultBrowser is embedded in a session screen, it renders in compact mode showing session-scoped notes with an "Open Knowledge Base" link, without category tabs.

## Preconditions
- App is built and running at https://localhost:4173
- A campaign with at least one session exists
- The session has at least one note

## Steps

1. Use `browser_navigate` to open https://localhost:4173
2. Navigate to a session screen (use browser_snapshot to find navigation, then browser_click)
3. Use `browser_snapshot` to capture the session screen
4. Locate the VaultBrowser compact section on the session screen
5. Verify that category tabs (All, People, Places, Loot, Notes) are NOT visible
6. Verify that session notes are displayed (cards or list items for notes in this session)
7. Verify an "Open Knowledge Base" link or button is visible
8. Use `browser_click` on "Open Knowledge Base"
9. Use `browser_snapshot` to verify navigation to /kb (full VaultBrowser mode)
10. Verify the URL is now /kb and category tabs are visible

## Expected Results
- Compact VaultBrowser on the session screen does not show category tabs
- Session notes are listed in the compact view
- "Open Knowledge Base" link is visible and functional
- Clicking the link navigates to /kb with the full VaultBrowser

## Execution Tool
playwright — Use browser_navigate and browser_click to reach session screen, browser_snapshot to verify compact mode

## Pass / Fail Criteria
- **Pass:** Compact mode shows session notes without category tabs, and the "Open Knowledge Base" link navigates to /kb
- **Fail:** Category tabs appear in compact mode, no notes shown, or the link is missing/broken
