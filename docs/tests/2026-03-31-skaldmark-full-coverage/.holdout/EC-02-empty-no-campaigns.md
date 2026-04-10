---
scenario_id: "EC-02"
title: "Empty State -- No Campaigns"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EC-02: Empty State -- No Campaigns

## Description
Verifies that the app handles the empty state when no campaigns exist: Session screen shows a campaign creation prompt, and Notes screen shows an appropriate empty state.

## Preconditions
- App is running at localhost
- No campaigns exist in IndexedDB

## Steps
1. Navigate to the app root (`/`).
2. Use `browser_evaluate` to clear all campaign-related data:
   ```js
   const { db } = await import('/src/storage/db/client');
   await db.campaigns.clear();
   await db.sessions.clear();
   await db.notes.clear();
   await db.parties.clear();
   await db.partyMembers.clear();
   await db.attachments.clear();
   return 'cleared';
   ```
3. Navigate to `/session`.
4. Take a snapshot of the Session screen.
5. Verify the screen shows a campaign creation prompt, a "Create Campaign" button, or an empty state message indicating no active campaign.
6. Verify no error overlay or crash screen.
7. Navigate to `/notes`.
8. Take a snapshot of the Notes screen.
9. Verify the screen shows an appropriate empty state -- either "No notes" message, a prompt to create a campaign first, or an empty list with a disabled/hidden create button.
10. Check `browser_console_messages` for unhandled errors.
11. Verify that clicking any note-creation buttons either works (opens campaign creation flow) or shows a helpful toast/message about needing a campaign.

## Expected Results
- Session screen displays a clear prompt to create a campaign.
- Notes screen handles no-campaign state without crashing.
- No unhandled console errors.
- User has a clear path to create a campaign from the empty state.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Both screens show meaningful empty states; no crashes; user can initiate campaign creation.
- **Fail:** Screens crash, show blank content, or leave user with no actionable path forward.
