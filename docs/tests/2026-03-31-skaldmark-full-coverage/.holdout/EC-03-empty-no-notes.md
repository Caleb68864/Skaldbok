---
scenario_id: "EC-03"
title: "Empty State -- No Notes"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EC-03: Empty State -- No Notes

## Description
Verifies that the Notes screen displays an appropriate empty list state with visible creation prompts/buttons when a campaign exists but has no notes.

## Preconditions
- App is running at localhost
- A campaign exists with an active session, but no notes

## Steps
1. Navigate to the app root (`/`).
2. Use `browser_evaluate` to ensure a campaign exists but clear all notes:
   ```js
   const { db } = await import('/src/storage/db/client');
   await db.notes.clear();
   const campaigns = await db.campaigns.toArray();
   if (campaigns.length === 0) {
     // Create a minimal campaign
     await db.campaigns.put({
       id: 'test-camp',
       name: 'Test Campaign',
       description: '',
       status: 'active',
       schemaVersion: 1,
       createdAt: new Date().toISOString(),
       updatedAt: new Date().toISOString(),
     });
   }
   return 'ready';
   ```
3. Navigate to `/notes`.
4. Take a snapshot of the Notes screen.
5. Verify the screen shows an empty list state -- look for text like "No notes yet", "Create your first note", or similar empty state messaging.
6. Verify that note creation buttons are visible and enabled (Quick Note, Quick NPC, Quick Location buttons should be present).
7. Verify the search input is either hidden or shows gracefully with no results.
8. Tap a creation button (e.g., Quick Note).
9. Verify the creation drawer opens.
10. Close the drawer without saving.
11. Check `browser_console_messages` for errors.

## Expected Results
- Notes screen shows an empty state message when no notes exist.
- Creation buttons/prompts are visible and functional.
- Search input handles empty state gracefully.
- No console errors.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Empty state message displayed; creation buttons visible and functional; no errors.
- **Fail:** Screen shows stale data, crashes, or hides creation controls in empty state.
