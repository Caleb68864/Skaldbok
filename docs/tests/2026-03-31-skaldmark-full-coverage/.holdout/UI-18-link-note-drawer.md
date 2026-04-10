---
scenario_id: "UI-18"
title: "Link Note to session drawer"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
sequential: true
---

# Scenario UI-18: Link Note to session drawer

## Description
Verify the Link Note drawer opens from the Notes screen when an active session exists, displays unlinked notes, allows clicking a note to link it to the current session, and confirms the link was created.

## Preconditions
- App is running at localhost (default port)
- An active campaign exists
- An active session is running
- At least one note exists that is not yet linked to the current session (e.g., created in UI-15, UI-16, or UI-17)

## Steps
1. Navigate to `/notes`
2. Verify the "Link Note" button is visible in the action bar (it only appears when an active session exists)
3. Click the "Link Note" button
4. Verify the Link Note drawer appears (role="dialog", aria-label="Link note to session") with heading "Link Note to Session"
5. Verify a list of available (unlinked) notes is displayed with their titles
6. Identify a note from the list (e.g., one created in a prior scenario)
7. Click on that note's entry in the list
8. Verify the drawer closes after linking
9. Reopen the Link Note drawer by clicking "Link Note" again
10. Verify the previously linked note no longer appears in the unlinked notes list
11. Close the drawer

## Expected Results
- Link Note button only appears when an active session exists
- Drawer shows all campaign notes that are not yet linked to the current session
- Clicking a note links it to the active session and closes the drawer
- Re-opening the drawer confirms the note is no longer in the unlinked list

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Link Note drawer opens, displays unlinked notes, successfully links a note on click, and the linked note is removed from the available list on subsequent opens
- **Fail:** Link Note button is missing during active session, drawer does not show notes, linking fails, or the note still appears as unlinked after being linked
