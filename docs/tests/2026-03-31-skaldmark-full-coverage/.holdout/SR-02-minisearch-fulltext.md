---
scenario_id: "SR-02"
title: "MiniSearch Full-Text Search"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-02: MiniSearch Full-Text Search

## Description
Verifies that MiniSearch full-text search works with field weighting (title:2 > tags:1.5 > body:1) and that the search index updates correctly on create, update, and delete operations.

## Preconditions
- App is running at localhost
- A campaign and session exist
- sequential: true (depends on data state)

## Steps
1. Navigate to `/session` and ensure an active campaign and session exist (create if needed).
2. Navigate to `/notes`.
3. Create three notes via the Quick Note drawer with distinct content:
   - Note A: title="Dragon Lair", body="A cave in the mountains", tags=["dungeon"]
   - Note B: title="Mountain Pass", body="A dragon guards the bridge", tags=["travel"]
   - Note C: title="Tavern Rumors", body="The innkeeper mentions gold", tags=["dragon", "gossip"]
4. Wait for notes to appear in the list.
5. Locate the search input on the Notes screen and type "dragon".
6. Take a snapshot to capture search results.
7. Verify search results ordering: Note A ("Dragon Lair" -- title match, weight 2) should rank highest. Note C (tag match "dragon", weight 1.5) should rank second. Note B (body match, weight 1) should rank third.
8. Clear the search input and type "gold".
9. Verify only Note C appears (body match for "gold").
10. Clear search. Delete Note C via its context menu or swipe action.
11. Type "dragon" in search again.
12. Verify Note C no longer appears in results (index updated on delete).
13. Edit Note B's title to "Dragon Bridge" via the note editor.
14. Clear and re-type "dragon" in search.
15. Verify Note B now ranks higher (title match after update).

## Expected Results
- Search returns results weighted by field: title > tags > body.
- Deleting a note removes it from the search index immediately.
- Updating a note's title re-indexes it with the new content.
- Fuzzy matching works (e.g., "dragn" returns results due to fuzzy: 0.2).
- Prefix matching works (e.g., "dra" returns dragon-related results).

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Search results respect field weighting order; index updates on CRUD; fuzzy/prefix matching works.
- **Fail:** Results unordered, deleted notes still appear, updated content not re-indexed, or search returns no results.
