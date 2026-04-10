---
scenario_id: "UI-09"
title: "Character Library CRUD: create, import, set active, and delete"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - sequential
---

# Scenario UI-09: Character Library CRUD: create, import, set active, and delete

## Description
Verify the Character Library screen supports creating a new character via the name modal, importing a character from a JSON file, setting a character as active, and deleting a character with confirmation.

## Preconditions
- The app is running at localhost.
- A valid Skaldmark character JSON export file is available at a known path for import testing.
- No characters exist initially (or test starts from a clean state).

## Steps
1. Navigate to `http://localhost:5173/library`.
2. Assert the heading "Character Library" is visible.
3. Assert the empty state message "No characters yet. Create your first character to get started." is visible.
4. Assert the "Create your first character" large button is visible in the empty state.
5. Click "+ New Character" button (in the header area).
6. Assert the "New Character" modal opens with a text input (placeholder "Character name") and "Create" and "Cancel" buttons.
7. Assert the "Create" button is disabled when the input is empty.
8. Type "Aldric the Bold" in the character name input.
9. Assert the "Create" button is now enabled.
10. Click "Create".
11. Assert the modal closes. Assert a toast message "Character created and set as active" appears (first character auto-activates).
12. Assert "Aldric the Bold" appears in the character list as a Card with the name, "(Active)" badge, and action buttons (Export, Duplicate, Delete).
13. Assert the empty state message is no longer visible.
14. Click "+ New Character" again. Type "Brunhild the Wise". Click "Create".
15. Assert a "Set Active?" banner appears with text "Brunhild the Wise created -- Set Active?" and "Set Active" / "Dismiss" buttons.
16. Click "Dismiss". Assert the banner disappears. Assert "Aldric the Bold" still has the "(Active)" badge.
17. Assert "Brunhild the Wise" appears in the character list without the "(Active)" badge.
18. Locate "Brunhild the Wise" card. Click the "Set Active" button on it.
19. Assert the page navigates to `/sheet` (or `/character/sheet`). Navigate back to `/library`.
20. Assert "Brunhild the Wise" now has the "(Active)" badge and "Aldric the Bold" does not.
21. Click "Import Character" button. Assert the hidden file input is triggered.
22. Upload a valid character JSON file using Playwright file upload.
23. Assert a toast message "Character imported successfully" appears.
24. Assert the imported character appears in the library list.
25. Locate "Aldric the Bold" card. Click the "Delete" button.
26. Assert the "Delete Character" modal opens with text "Delete Aldric the Bold? This cannot be undone."
27. Click "Cancel". Assert the modal closes and "Aldric the Bold" is still in the list.
28. Click "Delete" on "Aldric the Bold" again. In the modal, click the "Delete" confirm button.
29. Assert a toast "Character deleted" appears. Assert "Aldric the Bold" is no longer in the character list.

## Expected Results
- First character creation auto-activates and shows "(Active)" badge.
- Second character shows "Set Active?" banner; dismissing keeps the original active.
- "Set Active" on a card switches the active character.
- Import reads a JSON file and adds the character to the library.
- Delete shows a confirmation modal; canceling preserves the character; confirming removes it.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Characters are created via modal, first auto-activates, import adds a character, set active switches correctly, and delete with confirmation removes the character.
- **Fail:** Modal does not open or save, first character is not auto-activated, import fails, set active does not switch, or delete does not remove the character after confirmation.
