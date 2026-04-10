---
scenario_id: "SR-09"
title: "Note Reader renders read-only with tappable links"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - ui
  - ss-06
---

# Scenario SR-09: Note Reader renders read-only with tappable links

## Description
Verifies that navigating to /kb/{nodeId} renders the note content in a read-only view with styled wikilink chips that are tappable, not raw [[text]] syntax.

## Preconditions
- App is built and running at https://localhost:4173
- A campaign with at least one note exists that contains wikilinks or mentions
- The note has a corresponding kb_node with a known ID

## Steps

1. Use `browser_navigate` to open https://localhost:4173
2. Use `browser_evaluate` to find a note with wikilinks in its body:
   ```js
   const nodes = await window.__db.kb_nodes.where('type').equals('note').toArray();
   return JSON.stringify(nodes.map(n => ({ id: n.id, label: n.label, sourceId: n.sourceId })));
   ```
3. Use `browser_navigate` to go to `https://localhost:4173/kb/{nodeId}` using a node ID from step 2
4. Use `browser_snapshot` to capture the rendered NoteReader view
5. Verify the note title is displayed
6. Verify the note body content is rendered (not an editor — no contenteditable)
7. Verify wikilink references appear as styled chips (with background color, pill shape, or link styling)
8. Verify no raw `[[...]]` bracket syntax is visible in the rendered output
9. Use `browser_click` on a wikilink chip to verify it is tappable
10. Use `browser_snapshot` to verify navigation occurred (URL changed to the linked note's route)

## Expected Results
- NoteReader renders at /kb/{nodeId} with the note's title and body
- Content is read-only (no editable areas)
- Wikilinks display as styled, tappable chips
- No raw bracket syntax is visible
- Tapping a wikilink chip navigates to the linked note's /kb/{targetNodeId} route

## Execution Tool
playwright — Use browser_navigate to reach NoteReader, browser_snapshot to verify rendering

## Pass / Fail Criteria
- **Pass:** Note renders read-only with styled wikilink chips, and tapping a chip navigates correctly
- **Fail:** Raw [[text]] is shown, content is editable, or wikilink chips are not tappable
