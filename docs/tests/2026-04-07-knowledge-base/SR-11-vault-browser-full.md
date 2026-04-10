---
scenario_id: "SR-11"
title: "Vault Browser shows campaign notes with category tabs"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - ui
  - ss-07
---

# Scenario SR-11: Vault Browser shows campaign notes with category tabs

## Description
Verifies that navigating to /kb renders the VaultBrowser in full mode with category tabs (All, People, Places, Loot, Notes) and displays note cards.

## Preconditions
- App is built and running at https://localhost:4173
- A campaign exists with at least one note or kb_node

## Steps

1. Use `browser_navigate` to open https://localhost:4173/kb
2. Use `browser_snapshot` to capture the VaultBrowser view
3. Verify that category tab buttons are visible: All, People, Places, Loot, Notes
4. Verify the "All" tab is selected by default (active/highlighted state)
5. Verify that note cards are displayed in the main content area
6. Use `browser_click` on the "People" tab
7. Use `browser_snapshot` to verify the view filters to show only people-type nodes
8. Use `browser_click` on the "Places" tab
9. Use `browser_snapshot` to verify the view filters to show only place-type nodes
10. Use `browser_click` on the "All" tab to return to the unfiltered view
11. Use `browser_snapshot` to verify all cards are shown again

## Expected Results
- VaultBrowser renders at /kb with category tabs visible
- "All" tab is selected by default and shows all node cards
- Clicking a category tab filters the displayed cards to that type only
- Each card shows the node's label/title
- Tab switching is responsive and updates the card list

## Execution Tool
playwright — Use browser_navigate to /kb, browser_click on tabs, browser_snapshot to verify filtering

## Pass / Fail Criteria
- **Pass:** Category tabs are visible, tab switching filters cards correctly, and cards display node titles
- **Fail:** Tabs are missing, tab clicks do not filter, or no cards are displayed
