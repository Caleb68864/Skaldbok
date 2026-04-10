---
scenario_id: "UI-15"
title: "Quick Note drawer creation"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
sequential: true
---

# Scenario UI-15: Quick Note drawer creation

## Description
Verify the Quick Note drawer opens from the Notes screen, accepts a title, tags, and rich text body content, saves successfully, and the new note appears in the Notes list under the "Notes" section.

## Preconditions
- App is running at localhost (default port)
- An active campaign exists
- An active session is running (start one from `/session` if needed, so notes are linked)

## Steps
1. Navigate to `/session`
2. If no active session exists (no "End Session" button visible), click "Start Session" to begin one
3. Navigate to `/notes`
4. Verify the action bar is visible with "Quick Note", "Quick NPC", and "Location" buttons
5. Note the current count displayed in the "Notes" section header badge
6. Click the "Quick Note" button
7. Verify the Quick Note drawer appears (role="dialog", aria-label="Quick note")
8. Verify a title input field, tag picker area, and rich text editor area are present
9. Verify the "Save" button is present
10. Fill the title input with "Test Session Note"
11. In the tag picker, click one or more tag chips to select tags (e.g., "exploration", "important")
12. Click into the rich text editor (Tiptap) area and type "This is a test note with rich text content."
13. Click the "Save" button
14. Verify the drawer closes
15. Verify a note titled "Test Session Note" now appears in the "Notes" section of the notes list
16. Verify the Notes section header badge count has incremented by 1

## Expected Results
- Quick Note drawer opens with title input, tag picker, and Tiptap rich text editor
- Title is required (Save should not work with empty title)
- Tags can be selected from predefined chips
- Rich text content can be entered in the Tiptap editor
- After saving, the note appears in the Notes section list
- Section badge count updates to reflect the new note

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Note is created with correct title, appears in the notes list, and section count updates
- **Fail:** Drawer does not open, save fails, note does not appear in list, or section count does not update
