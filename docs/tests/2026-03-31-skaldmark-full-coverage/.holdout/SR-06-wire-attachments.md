---
scenario_id: "SR-06"
title: "Wire Attachments Across Drawers"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-06: Wire Attachments Across Drawers

## Description
Verifies that the Attach button is present and functional on all note creation/editing flows: QuickNote, QuickNPC, and QuickLocation drawers.

## Preconditions
- App is running at localhost
- A campaign and session exist
- sequential: true

## Steps
1. Navigate to `/session` and ensure an active campaign and session exist.
2. Navigate to `/notes`.

**QuickNote Drawer:**
3. Tap the button to create a new generic note (Quick Note / add button).
4. Take a snapshot of the QuickNote drawer.
5. Verify an Attach or image upload button is present in the drawer.
6. Fill in the title "QN Attach Test".
7. Tap the Attach button and upload a test image via `browser_file_upload`.
8. Verify the attachment thumbnail appears in the drawer.
9. Save the note.
10. Use `browser_evaluate` to verify the note has an attachment in IndexedDB.

**QuickNPC Drawer:**
11. Open the QuickNPC drawer (from Session screen quick actions or Notes screen NPC button).
12. Take a snapshot of the QuickNPC drawer.
13. Verify an Attach button is present.
14. Fill in NPC name "Test NPC".
15. Tap Attach and upload a test image.
16. Verify the attachment thumbnail appears.
17. Save the NPC note.
18. Use `browser_evaluate` to verify the NPC note has an attachment.

**QuickLocation Drawer:**
19. Open the QuickLocation drawer (from Session screen quick actions or Notes screen location button).
20. Take a snapshot of the QuickLocation drawer.
21. Verify an Attach button is present.
22. Fill in location name "Test Tavern".
23. Tap Attach and upload a test image.
24. Verify the attachment thumbnail appears.
25. Save the location note.
26. Use `browser_evaluate` to verify the location note has an attachment.

## Expected Results
- All three drawer types (QuickNote, QuickNPC, QuickLocation) have an Attach button.
- Image upload works from each drawer and creates a thumbnail preview.
- After saving, attachments are persisted in IndexedDB linked to the correct note.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** All three drawers have attach buttons; uploads succeed; attachments linked to correct notes in DB.
- **Fail:** Any drawer missing attach button, upload fails, or attachments not linked to the saved note.
