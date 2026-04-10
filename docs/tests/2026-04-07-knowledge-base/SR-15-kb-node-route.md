---
scenario_id: "SR-15"
title: "KB Screen routing — /kb/:nodeId renders NoteReader"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - ui
  - ss-08
---

# Scenario SR-15: KB Screen routing — /kb/:nodeId renders NoteReader

## Description
Verifies that navigating to /kb/{nodeId} renders the NoteReader component within the ShellLayout, displaying the specific note's content.

## Preconditions
- App is built and running at https://localhost:4173
- A campaign exists with at least one note that has a corresponding kb_node

## Steps

1. Use `browser_navigate` to open https://localhost:4173
2. Use `browser_evaluate` to find a valid kb_node ID:
   ```js
   const nodes = await window.__db.kb_nodes.toArray();
   const noteNode = nodes.find(n => n.type === 'note') || nodes[0];
   return noteNode ? JSON.stringify({ id: noteNode.id, label: noteNode.label }) : 'no-nodes';
   ```
3. Use `browser_navigate` to open `https://localhost:4173/kb/{nodeId}` with the ID from step 2
4. Use `browser_snapshot` to capture the rendered page
5. Verify the NoteReader component is rendered (note title and body content visible)
6. Verify the note title matches the expected label from step 2
7. Verify the ShellLayout bottom navigation bar is visible
8. Verify the content is read-only (no editable text areas)
9. Use `browser_click` on the back button or browser_navigate_back to return
10. Use `browser_snapshot` to verify return to the previous screen

## Expected Results
- /kb/{nodeId} renders the NoteReader with the correct note content
- The note's title is displayed prominently
- ShellLayout bottom navigation is visible
- Content is presented in read-only mode
- Back navigation works correctly

## Execution Tool
playwright — Use browser_navigate to /kb/{nodeId}, browser_snapshot to verify NoteReader rendering

## Pass / Fail Criteria
- **Pass:** NoteReader renders at /kb/{nodeId} within ShellLayout showing the correct note content
- **Fail:** Route shows a 404 or blank page, wrong note content displayed, or bottom nav is missing
