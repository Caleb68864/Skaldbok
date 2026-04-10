---
scenario_id: "DB-01"
title: "Character CRUD"
tool: "playwright"
sequential: true
type: test-scenario
tags:
  - test-scenario
---

# Scenario DB-01: Character CRUD

## Description
Verify full character lifecycle: create via the library modal, read from library list, update on the sheet screen, and delete from library. Validate IndexedDB state at each step.

## Preconditions
- App is running locally (e.g. http://localhost:5173)
- Database `skaldbok-db` is accessible
- No pre-existing characters required (test creates its own)

## Steps
1. Navigate to the app: `browser_navigate` to `http://localhost:5173/library`
2. Take a snapshot to confirm the Character Library screen is loaded
3. Click the "Add Character" / "New Character" button to open the creation modal
4. Fill in the character name field with "Test Warrior"
5. Submit the creation form
6. Verify the character "Test Warrior" appears in the library list via snapshot
7. Use `browser_evaluate` to read the `characters` table and confirm the new record exists:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const chars = await db.table('characters').toArray();
   return chars.map(c => ({ id: c.id, name: c.name }));
   ```
8. Click on "Test Warrior" to navigate to the character sheet screen (`/character/sheet`)
9. Edit the character name from "Test Warrior" to "Test Warrior Updated"
10. Navigate back to `/library` and verify the updated name appears in the list
11. Use `browser_evaluate` to confirm the name update persisted in IndexedDB:
    ```js
    const db = await new Dexie('skaldbok-db').open();
    const chars = await db.table('characters').toArray();
    return chars.find(c => c.name === 'Test Warrior Updated');
    ```
12. Delete the character from the library (click delete button / context menu)
13. Confirm the deletion dialog if one appears
14. Verify "Test Warrior Updated" no longer appears in the library list
15. Use `browser_evaluate` to confirm the `characters` table no longer contains the deleted record:
    ```js
    const db = await new Dexie('skaldbok-db').open();
    const count = await db.table('characters').count();
    return count;
    ```

## Expected Results
- Character "Test Warrior" is created and visible in the library
- Character record exists in `characters` table with correct name
- Name update to "Test Warrior Updated" persists in IndexedDB
- After deletion, the character is removed from both the UI and IndexedDB

## Execution Tool
playwright -- Use browser_evaluate to interact with Dexie DB directly, browser_navigate to load the app

## Pass / Fail Criteria
- **Pass:** Character is created, read, updated, and deleted successfully in both the UI and IndexedDB `characters` table
- **Fail:** Any CRUD operation fails to reflect in the UI or IndexedDB, or the character persists after deletion
