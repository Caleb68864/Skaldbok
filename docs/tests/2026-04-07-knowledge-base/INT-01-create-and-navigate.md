---
scenario_id: "INT-01"
title: "End-to-end: create note with wikilink, navigate via KB"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - integration
  - end-to-end
---

# Scenario INT-01: End-to-end: create note with wikilink, navigate via KB

## Description
End-to-end integration test: create a new note with a wikilink to another note, save it, navigate to /kb, find the note, tap into it, tap the wikilink, and verify navigation to the linked note.

## Preconditions
- App is built and running at https://localhost:4173
- A campaign with at least one session exists
- At least one existing note or kb_node exists to link to (or a known target name)

## Steps

1. Use `browser_navigate` to open https://localhost:4173
2. Navigate to a session screen where notes can be created
3. Use `browser_click` to create a new note (tap "Add Note" or "+" button)
4. Use `browser_snapshot` to confirm the note editor is open
5. Use `browser_fill_form` or `browser_type` to set the note title to "INT-01 Journey Log"
6. Use `browser_click` to focus the note body editor
7. Use `browser_type` to type: "We traveled to [[The Iron Keep]] today"
8. Wait for the wikilink input rule to convert `[[The Iron Keep]]` into a chip
9. Use `browser_snapshot` to verify the wikilink chip is visible in the editor
10. Save the note (tap save button)
11. Use `browser_snapshot` to confirm save succeeded (no error messages)
12. Use `browser_navigate` to go to https://localhost:4173/kb
13. Use `browser_snapshot` to capture the VaultBrowser
14. Locate the "INT-01 Journey Log" card in the list
15. Use `browser_click` on the card to open it
16. Use `browser_snapshot` to verify NoteReader renders with the note content
17. Verify the wikilink "The Iron Keep" appears as a styled chip in the read-only view
18. Use `browser_click` on the "The Iron Keep" wikilink chip
19. Use `browser_snapshot` to verify navigation to /kb/{ironKeepNodeId}
20. Verify the destination page shows "The Iron Keep" as the title or heading

## Expected Results
- Note is created and saved with a wikilink successfully
- The note appears in the VaultBrowser at /kb
- Tapping the note card opens the NoteReader with correct content
- Wikilink is rendered as a styled chip in the NoteReader
- Tapping the wikilink chip navigates to the linked note's page
- The linked note page displays the correct title

## Execution Tool
playwright — Full browser interaction flow using navigate, click, type, snapshot, and screenshot

## Pass / Fail Criteria
- **Pass:** Complete flow from note creation through wikilink navigation succeeds without errors at each step
- **Fail:** Any step fails: note cannot be created, wikilink does not convert, note does not appear in KB, or wikilink navigation breaks
