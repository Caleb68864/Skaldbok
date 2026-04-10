---
scenario_id: "UI-05"
title: "Notes management: create, filter, group, search, and pin"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - sequential
---

# Scenario UI-05: Notes management: create, filter, group, search, and pin

## Description
Verify the Notes Screen supports creating notes of different types (Quick Note, Quick NPC, Location), filtering by groups, searching with MiniSearch, and pinning notes to the top.

## Preconditions
- An active campaign exists.
- An active session is running (so the "Link Note" button is also visible).
- The app is running at localhost.

## Steps
1. Navigate to `http://localhost:5173/notes`.
2. Assert the action bar is visible with buttons: "Quick Note", "Quick NPC", "Location", and "Link Note".
3. Assert section headers are visible: "NPCs", "Notes", "Locations" (with count badges showing 0).
4. Click the "Quick Note" button. Assert the QuickNoteDrawer opens (a drawer/overlay appears).
5. In the QuickNoteDrawer, fill in the title field with "Goblin Ambush Plans". Add body content if a text area is present.
6. Click the "Save" button in the drawer. Assert the drawer closes.
7. Assert "Goblin Ambush Plans" appears in the "Notes" section with the count badge updated to 1.
8. Click the "Quick NPC" button. Assert the QuickNPCDrawer opens.
9. Fill in the NPC name with "Grimjaw the Merchant". Fill in any available fields (e.g., description).
10. Click "Save". Assert the drawer closes.
11. Assert "Grimjaw the Merchant" appears in the "NPCs" section with count badge showing 1.
12. Click the "Location" button. Assert the QuickLocationDrawer opens.
13. Fill in the location name with "The Rusty Anchor Tavern".
14. Click "Save". Assert the drawer closes.
15. Assert "The Rusty Anchor Tavern" appears in the "Locations" section with count badge showing 1.
16. Locate the note card for "Goblin Ambush Plans". Find and click its pin action (a pin button or menu option on the NoteItem).
17. Assert a "Pinned" section header appears at the top of the note list with count badge showing 1.
18. Assert "Goblin Ambush Plans" now appears under the "Pinned" section.
19. Assert "Goblin Ambush Plans" no longer appears under the regular "Notes" section (count decremented).
20. Click the unpin action on "Goblin Ambush Plans". Assert it moves back to the "Notes" section.
21. Verify the "Pinned" section header disappears (since no pinned notes remain).

## Expected Results
- Quick Note, Quick NPC, and Location drawers open and save notes of the correct type.
- Notes appear under their respective group sections (Notes, NPCs, Locations) with accurate count badges.
- Pinning a note moves it to the "Pinned" section at the top; unpinning returns it to its type group.
- The "Pinned" section only appears when there are pinned notes.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** All three note types create successfully, appear in correct groups with updated counts, pinning/unpinning works, and search filters results.
- **Fail:** A drawer fails to open or save, notes appear in the wrong group, count badges are incorrect, or pin/unpin does not move notes between sections.
