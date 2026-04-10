---
scenario_id: "SR-10"
title: "Backlinks panel shows linking notes"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - ui
  - ss-06
---

# Scenario SR-10: Backlinks panel shows linking notes

## Description
Verifies that when viewing a note that other notes link to, the BacklinksPanel at the bottom of the NoteReader displays a list of the linking (source) notes.

## Preconditions
- App is built and running at https://localhost:4173
- At least two notes exist: Note A links to Note B via a wikilink
- Both notes have corresponding kb_nodes and a kb_edge from A to B

## Steps

1. Use `browser_navigate` to open https://localhost:4173
2. Use `browser_evaluate` to find a node that has incoming edges (is a link target):
   ```js
   const edges = await window.__db.kb_edges.toArray();
   if (edges.length === 0) return 'no-edges';
   const targetId = edges[0].toId;
   const targetNode = await window.__db.kb_nodes.get(targetId);
   const sourceNode = await window.__db.kb_nodes.get(edges[0].fromId);
   return JSON.stringify({ targetId, targetLabel: targetNode?.label, sourceLabel: sourceNode?.label });
   ```
3. Use `browser_navigate` to go to `https://localhost:4173/kb/{targetId}` (the note being linked to)
4. Use `browser_snapshot` to capture the NoteReader view
5. Scroll down to the bottom of the NoteReader to find the BacklinksPanel section
6. Use `browser_snapshot` to capture the backlinks area
7. Verify the BacklinksPanel heading is visible (e.g., "Backlinks", "Linked from", or similar)
8. Verify the panel lists the source note (Note A) that links to this note
9. Use `browser_click` on the backlink entry to verify it navigates to the source note

## Expected Results
- BacklinksPanel is visible at the bottom of the NoteReader
- The panel lists at least one linking note with its title
- Each backlink entry is tappable and navigates to the source note
- The backlinks accurately reflect the kb_edges data

## Execution Tool
playwright — Use browser_navigate to reach a linked note, browser_snapshot to verify BacklinksPanel

## Pass / Fail Criteria
- **Pass:** BacklinksPanel is visible, shows correct linking notes, and backlink entries are navigable
- **Fail:** No BacklinksPanel appears, it shows no entries when edges exist, or entries are not tappable
