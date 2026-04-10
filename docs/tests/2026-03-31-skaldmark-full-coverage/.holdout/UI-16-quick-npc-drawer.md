---
scenario_id: "UI-16"
title: "Quick NPC drawer creation"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
sequential: true
---

# Scenario UI-16: Quick NPC drawer creation

## Description
Verify the Quick NPC drawer opens from the Notes screen, accepts name, role, affiliation, tags, and description body, saves successfully, and the new NPC note appears under the "NPCs" section in the notes list.

## Preconditions
- App is running at localhost (default port)
- An active campaign exists
- An active session is running

## Steps
1. Navigate to `/notes`
2. Verify the action bar is visible with "Quick Note", "Quick NPC", and "Location" buttons
3. Note the current count displayed in the "NPCs" section header badge
4. Click the "Quick NPC" button
5. Verify the Quick NPC drawer appears (role="dialog") with NPC-specific form fields
6. Verify fields for name, role, and affiliation are present
7. Fill the name input with "Bartender Hrolf"
8. Fill the role input with "Innkeeper"
9. Fill the affiliation input with "The Rusty Axe Tavern"
10. In the tag picker, click one or more tag chips (e.g., "social")
11. Click into the rich text editor area and type "A grizzled former adventurer who runs the tavern."
12. Click the "Save" button
13. Verify the drawer closes
14. Verify a note titled "Bartender Hrolf" now appears in the "NPCs" section of the notes list
15. Verify the NPCs section header badge count has incremented by 1

## Expected Results
- Quick NPC drawer opens with name, role, affiliation fields plus tag picker and rich text editor
- Name is required for save
- Role and affiliation are optional fields stored in typeData
- After saving, the NPC note appears under the NPCs section
- Section badge count updates

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** NPC note is created with correct name, appears in the NPCs section, and badge count updates
- **Fail:** Drawer does not open, NPC-specific fields are missing, save fails, or NPC does not appear under the NPCs section
