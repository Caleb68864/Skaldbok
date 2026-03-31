---
scenario_id: "UI-17"
title: "Quick Location drawer creation"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
sequential: true
---

# Scenario UI-17: Quick Location drawer creation

## Description
Verify the Quick Location drawer opens from the Notes screen, accepts name, location type, region, tags, and description body, saves successfully, and the new location note appears under the "Locations" section in the notes list.

## Preconditions
- App is running at localhost (default port)
- An active campaign exists
- An active session is running

## Steps
1. Navigate to `/notes`
2. Verify the action bar is visible with "Quick Note", "Quick NPC", and "Location" buttons
3. Note the current count displayed in the "Locations" section header badge
4. Click the "Location" button
5. Verify the Quick Location drawer appears (role="dialog") with location-specific form fields
6. Verify fields for name, location type, and region are present
7. Fill the name input with "Outskirt Ruins"
8. Fill the location type input with "Dungeon"
9. Fill the region input with "The Misty Vale"
10. In the tag picker, click one or more tag chips (e.g., "exploration", "mystery")
11. Click into the rich text editor area and type "Crumbling stone walls covered in moss. Something stirs in the depths."
12. Click the "Save" button
13. Verify the drawer closes
14. Verify a note titled "Outskirt Ruins" now appears in the "Locations" section of the notes list
15. Verify the Locations section header badge count has incremented by 1

## Expected Results
- Quick Location drawer opens with name, location type, region fields plus tag picker and rich text editor
- Name is required for save
- Location type and region are optional fields stored in typeData
- After saving, the location note appears under the Locations section
- Section badge count updates

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Location note is created with correct name, appears in the Locations section, and badge count updates
- **Fail:** Drawer does not open, location-specific fields are missing, save fails, or location does not appear under the Locations section
