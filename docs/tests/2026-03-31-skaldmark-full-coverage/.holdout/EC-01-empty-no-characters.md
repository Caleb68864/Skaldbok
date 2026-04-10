---
scenario_id: "EC-01"
title: "Empty State -- No Characters"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EC-01: Empty State -- No Characters

## Description
Verifies that the app handles the empty state gracefully when no characters exist: the Character Library shows an appropriate empty message, and the Character Sheet screen redirects or shows a placeholder.

## Preconditions
- App is running at localhost
- IndexedDB is cleared or no characters exist in the characters table

## Steps
1. Navigate to the app root (`/`).
2. Use `browser_evaluate` to clear all characters from IndexedDB:
   ```js
   const { db } = await import('/src/storage/db/client');
   await db.characters.clear();
   return 'cleared';
   ```
3. Navigate to `/library`.
4. Take a snapshot of the Character Library screen.
5. Verify the screen displays an empty state message (e.g., "No characters", "Create your first character", or a create button prompt).
6. Verify no error messages or blank white screens appear.
7. Navigate to `/character/sheet`.
8. Take a snapshot.
9. Verify one of: (a) the screen redirects back to `/library` or a creation flow, (b) a placeholder/empty state is shown, or (c) the sheet renders with blank/default values.
10. Check `browser_console_messages` for any unhandled errors or React rendering exceptions.
11. Navigate to `/character/skills`, `/character/gear`, `/character/magic`, `/character/combat` in sequence.
12. For each, take a snapshot and verify no crash or unhandled error.

## Expected Results
- Character Library shows a clear empty state with a way to create a new character.
- Character Sheet and sub-screens handle missing character data gracefully (no crash, no blank screen).
- No unhandled exceptions in the browser console.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** All screens render gracefully with empty state messaging; no console errors; navigation works.
- **Fail:** Any screen crashes, shows a blank page, or produces unhandled console errors.
