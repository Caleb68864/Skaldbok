---
scenario_id: "UI-14"
title: "Manage Party drawer"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
sequential: true
---

# Scenario UI-14: Manage Party drawer

## Description
Verify the Manage Party drawer allows adding characters to the party, setting an active ("my") character, and removing a character. The drawer is accessible from both the More screen and the hamburger menu.

## Preconditions
- App is running at localhost (default port)
- An active campaign exists (created in UI-13 or pre-existing)
- At least two characters exist in the Character Library

## Steps
1. Navigate to `/more`
2. Click the "Manage Party" button
3. Verify the Manage Party drawer appears (role="dialog", aria-label="Manage party") with heading "Manage Party"
4. Verify "Current Members" section shows "No members yet." text
5. Verify the "Add Character" section lists available characters by name
6. Click the first available character name button to add them to the party
7. Verify the character now appears under "Current Members" with their name displayed
8. Verify a "Set mine" button and a "Remove" button are visible next to the member
9. Click the second available character name button to add another member
10. Verify both members are now listed under "Current Members"
11. Click the "Set mine" button next to the first member
12. Verify the first member now shows "(my character)" label next to their name
13. Verify the "Set mine" button for that member is now disabled (reduced opacity)
14. Click the "Remove" button next to the second member
15. Verify the second member is removed from the "Current Members" list
16. Verify the removed character reappears in the "Add Character" section
17. Click the close button (the X button in the drawer header) to close the drawer
18. Verify the drawer is no longer visible
19. Navigate to `/session`
20. Click the hamburger menu button (aria-label "Menu")
21. Click "Manage Party" in the hamburger menu
22. Verify the Manage Party drawer opens again
23. Verify the first member is still listed with "(my character)" label (state persisted)
24. Click the close button to dismiss

## Expected Results
- Manage Party drawer opens from More screen and hamburger menu
- Characters can be added from the available list
- Added characters appear under Current Members
- "Set mine" marks a member as the active character with visual indicator
- "Remove" removes a member and returns them to the available list
- Party state persists across drawer open/close cycles

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** All add, set-mine, and remove operations work correctly; state persists across drawer reopens
- **Fail:** Characters cannot be added, set-mine does not update, remove does not work, or state is lost when drawer is closed and reopened
