---
scenario_id: "UI-10"
title: "Reference Screen tabs, search, and reference notes CRUD"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario UI-10: Reference Screen tabs, search, and reference notes CRUD

## Description
Verify the Reference Screen supports switching between the Game Reference and My Notes tabs, searching reference content, and creating/editing/deleting reference notes via the editor drawer.

## Preconditions
- The app is running at localhost.
- No reference notes exist initially.

## Steps
1. Navigate to `http://localhost:5173/reference`.
2. Assert two tab buttons are visible: "Game Reference" and "My Notes".
3. Assert the "Game Reference" tab is active by default (bold/highlighted styling).
4. Assert a search input with placeholder "Search reference..." is visible.
5. Assert reference sections are rendered as SectionPanel components with titles and content.
6. Type "combat" in the search input. Assert the displayed sections filter to only those matching "combat" (sections with combat-related titles or content).
7. Clear the search input. Assert all reference sections reappear.
8. Type "xyznonexistent" in the search input. Assert the "No sections match your search." empty state is visible.
9. Clear the search input.
10. Click the "My Notes" tab button. Assert it becomes active.
11. Assert the heading "Reference Notes" is visible.
12. Assert the empty state text "No reference notes yet. Add your own shorthand notes for quick reference during play." is visible.
13. Assert the "+ Add Note" button is visible.
14. Click "+ Add Note". Assert a Drawer opens with title "New Note".
15. Assert the drawer has a "Title" input and a "Content" textarea.
16. Fill in Title with "Initiative Rules Cheat Sheet".
17. Fill in Content with "Draw initiative cards at start of each round. Lowest acts first. Swap allowed once per round."
18. Click "Save". Assert the drawer closes.
19. Assert "Initiative Rules Cheat Sheet" appears as a Card in the notes list with the content preview visible.
20. Click on the "Initiative Rules Cheat Sheet" card. Assert the drawer reopens with title "Edit Note" and the fields pre-filled.
21. Change the Title to "Initiative Quick Reference". Click "Save". Assert the drawer closes.
22. Assert the updated title "Initiative Quick Reference" is visible on the card.
23. Click "+ Add Note" again. Fill in Title with "Temporary Note". Fill in Content with "Delete me." Click "Save".
24. Assert "Temporary Note" appears in the notes list.
25. Locate the "Temporary Note" card. Click the "Delete" button on it.
26. Assert a "Delete Note" modal appears with text "Delete Temporary Note? This cannot be undone."
27. Click "Delete" to confirm. Assert the modal closes and "Temporary Note" is removed from the list.
28. Assert "Initiative Quick Reference" is still present.
29. Click the "Game Reference" tab. Assert the reference sections reappear and the notes view is hidden.
30. Click the "My Notes" tab. Assert "Initiative Quick Reference" is still present (persisted in IndexedDB).

## Expected Results
- Tab switching toggles between Game Reference content and My Notes view.
- Search filters reference sections by matching text and shows empty state for no matches.
- Reference notes can be created via the drawer with title and content.
- Clicking a note card re-opens the drawer for editing with pre-filled data.
- Saving edits updates the card display.
- Deleting a note shows confirmation and removes it from the list.
- Notes persist across tab switches (IndexedDB storage).

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Tabs switch correctly, search filters and shows empty state, notes are created/edited/deleted via drawer and modal, and data persists across tab switches.
- **Fail:** Tabs do not switch views, search does not filter, drawer fails to open or save, delete does not remove the note, or notes disappear on tab switch.
