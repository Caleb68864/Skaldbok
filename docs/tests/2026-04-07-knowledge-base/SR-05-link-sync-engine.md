---
scenario_id: "SR-05"
title: "Link sync engine populates graph on note save"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - database
  - ss-03
---

# Scenario SR-05: Link sync engine populates graph on note save

## Description
Verifies that saving a note containing a wikilink or mention in the editor triggers the link sync engine to create corresponding kb_nodes and kb_edges entries in IndexedDB.

## Preconditions
- App is built and running at https://localhost:4173
- A campaign with at least one session exists
- User is on a session screen where notes can be created

## Steps

1. Use `browser_navigate` to open https://localhost:4173
2. Use `browser_snapshot` to identify navigation to a session with notes
3. Navigate to a session screen where a new note can be created
4. Use `browser_click` to tap the "Add Note" or "+" button to create a new note
5. Use `browser_snapshot` to confirm the note editor is open
6. Use `browser_fill_form` or `browser_type` to enter a note title like "SR-05 Test Note"
7. In the note body editor, type content that includes a wikilink, e.g. "Met with [[Test NPC]] at the tavern"
8. Use `browser_snapshot` to verify the wikilink rendered as a chip/node in the editor
9. Save the note (tap save button or trigger save action)
10. Use `browser_evaluate` to check kb_nodes for the new note's node:
    ```js
    const nodes = await window.__db.kb_nodes.where('label').equals('SR-05 Test Note').toArray();
    return JSON.stringify(nodes);
    ```
11. Use `browser_evaluate` to check kb_edges for the link:
    ```js
    const edges = await window.__db.kb_edges.toArray();
    const relevant = edges.filter(e => e.fromId === nodes[0]?.id || e.toId === nodes[0]?.id);
    return JSON.stringify(relevant);
    ```
12. Use `browser_evaluate` to check if a node was created for "Test NPC":
    ```js
    const targets = await window.__db.kb_nodes.where('label').equals('Test NPC').toArray();
    return JSON.stringify(targets);
    ```

## Expected Results
- A kb_node entry exists for the saved note with correct label and type
- A kb_node entry exists for the linked target ("Test NPC"), possibly as a stub
- A kb_edge entry exists connecting the note node to the target node with type 'mentions'
- No console errors related to link sync

## Execution Tool
playwright — Use browser actions to create/save a note, then browser_evaluate to inspect IndexedDB

## Pass / Fail Criteria
- **Pass:** Both kb_nodes and at least one kb_edge are created automatically on save
- **Fail:** No kb_nodes or kb_edges entries are created, or the edge has incorrect fromId/toId
