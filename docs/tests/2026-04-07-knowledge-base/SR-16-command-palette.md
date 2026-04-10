---
scenario_id: "SR-16"
title: "Command Palette search and navigation"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - ui
  - ss-09
---

# Scenario SR-16: Command Palette search and navigation

## Description
Verifies that the command palette can be opened, accepts a search query with fuzzy matching, displays results, and navigates to the selected result.

## Preconditions
- App is built and running at https://localhost:4173
- A campaign exists with multiple notes or kb_nodes with known labels

## Steps

1. Use `browser_navigate` to open https://localhost:4173
2. Use `browser_snapshot` to identify the command palette trigger (search icon, button, or keyboard shortcut)
3. Use `browser_click` on the command palette trigger button (or use `browser_press_key` for keyboard shortcut like Ctrl+K or Cmd+K)
4. Use `browser_snapshot` to verify the command palette overlay/modal is visible with a search input
5. Use `browser_fill_form` or `browser_type` to enter a partial/fuzzy search query (e.g., a few characters of a known note title)
6. Use `browser_snapshot` to verify search results appear below the input
7. Verify the results show matching items with fuzzy matching (partial matches highlighted)
8. Verify each result shows the item's label/title and optionally its type
9. Use `browser_click` on one of the search results
10. Use `browser_snapshot` to verify the command palette closed and navigation occurred
11. Verify the URL changed to the appropriate route (e.g., /kb/{nodeId}) for the selected result

## Expected Results
- Command palette opens with a search input field
- Typing a query produces filtered results with fuzzy matching
- Results display the node label and type
- Clicking a result navigates to the corresponding NoteReader or detail view
- The command palette closes after selection

## Execution Tool
playwright — Use browser_click to open palette, browser_type to search, browser_snapshot to verify results

## Pass / Fail Criteria
- **Pass:** Command palette opens, fuzzy search returns matching results, and selecting a result navigates correctly
- **Fail:** Palette does not open, search returns no results for known items, or navigation fails after selection
