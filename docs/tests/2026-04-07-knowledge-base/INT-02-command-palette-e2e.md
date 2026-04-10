---
scenario_id: "INT-02"
title: "End-to-end: search in command palette and navigate"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - integration
  - end-to-end
---

# Scenario INT-02: End-to-end: search in command palette and navigate

## Description
End-to-end integration test: open the command palette from any screen, search for an NPC name, tap the result, and verify landing on the correct NoteReader view for that NPC.

## Preconditions
- App is built and running at https://localhost:4173
- A campaign exists with at least one NPC note or person-type kb_node with a known name
- The command palette is accessible from the current screen

## Steps

1. Use `browser_navigate` to open https://localhost:4173
2. Use `browser_evaluate` to find a known NPC/person node:
   ```js
   const nodes = await window.__db.kb_nodes.where('type').equals('person').toArray();
   return nodes.length > 0 ? JSON.stringify({ id: nodes[0].id, label: nodes[0].label }) : 'no-people';
   ```
3. Use `browser_snapshot` to identify the command palette trigger (search icon or button)
4. Use `browser_click` on the command palette trigger (or `browser_press_key` for Ctrl+K / Cmd+K)
5. Use `browser_snapshot` to verify the command palette modal is open with a search input
6. Use `browser_type` to enter the first few characters of the NPC name from step 2
7. Use `browser_snapshot` to verify search results appear
8. Verify the expected NPC appears in the result list (fuzzy match on the partial name)
9. Use `browser_click` on the NPC result entry
10. Use `browser_snapshot` to capture the resulting page
11. Verify the URL is now /kb/{npcNodeId} matching the node ID from step 2
12. Verify the NoteReader displays the NPC's name as the title
13. Verify the page content is rendered in read-only mode

## Expected Results
- Command palette opens from the home screen
- Typing a partial NPC name returns the matching NPC in results
- Clicking the result navigates to /kb/{nodeId} for that NPC
- The NoteReader displays the correct NPC name and content
- The entire flow completes without errors

## Execution Tool
playwright — Full browser interaction flow using click, type, snapshot for command palette search and navigation

## Pass / Fail Criteria
- **Pass:** Command palette search finds the NPC, selection navigates to the correct NoteReader view with the right content
- **Fail:** Command palette does not open, search returns no results for a known NPC, or navigation lands on the wrong page
