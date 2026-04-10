---
scenario_id: "SR-08"
title: "Wikilink autocomplete triggers on [["
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - ui
  - ss-04
---

# Scenario SR-08: Wikilink autocomplete triggers on [[

## Description
Verifies that typing `[[` in the note editor triggers an autocomplete dropdown with suggestions from existing knowledge base nodes.

## Preconditions
- App is built and running at https://localhost:4173
- A campaign with existing notes or kb_nodes exists (so there are suggestions to show)
- User can open the note editor

## Steps

1. Use `browser_navigate` to open https://localhost:4173
2. Navigate to a session screen and open a note editor
3. Use `browser_snapshot` to confirm the editor is visible
4. Use `browser_click` to focus the note body editor area
5. Use `browser_type` to type `[[`
6. Use `browser_snapshot` to capture the state after typing `[[`
7. Verify that an autocomplete dropdown/popover appears with a list of suggestions
8. Use `browser_type` to type a few characters of a known note or node name to filter
9. Use `browser_snapshot` to verify the dropdown filters to matching results
10. Use `browser_click` to select one of the autocomplete suggestions
11. Use `browser_snapshot` to verify the selected item was inserted as a wikilink chip

## Expected Results
- Typing `[[` triggers a visible autocomplete dropdown
- The dropdown contains suggestions from existing kb_nodes or notes
- Typing additional characters filters the suggestions
- Clicking a suggestion inserts a wikilink chip node for that item
- The dropdown dismisses after selection

## Execution Tool
playwright — Use browser_type to trigger autocomplete, browser_snapshot to verify dropdown visibility

## Pass / Fail Criteria
- **Pass:** Autocomplete dropdown appears on `[[`, shows relevant suggestions, and inserts a chip on selection
- **Fail:** No dropdown appears, dropdown is empty, or selection does not insert a wikilink chip
