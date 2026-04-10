---
scenario_id: "DB-09"
title: "Reference Notes CRUD"
tool: "playwright"
sequential: true
type: test-scenario
tags:
  - test-scenario
---

# Scenario DB-09: Reference Notes CRUD

## Description
Verify reference note lifecycle: create a reference note via the reference screen, read it, update its content, delete it, and validate the IndexedDB `referenceNotes` table at each step.

## Preconditions
- App is running locally (e.g. http://localhost:5173)
- Database `skaldbok-db` is accessible
- No pre-existing reference notes required

## Steps
1. Navigate to `http://localhost:5173/reference`
2. Take a snapshot to confirm the Reference screen is loaded
3. Click the "New Reference Note" or add button
4. Enter the title: "Dragonbane Combat Rules"
5. Enter content: "Initiative is drawn each round using cards."
6. Save the reference note
7. Verify the note "Dragonbane Combat Rules" appears in the reference list
8. Use `browser_evaluate` to confirm the record in IndexedDB:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const refs = await db.table('referenceNotes').toArray();
   return refs.map(r => ({ id: r.id, title: r.title || r.name, updatedAt: r.updatedAt }));
   ```
9. Click on the reference note to open it for editing
10. Update the content to: "Initiative is drawn each round. Surprised characters act last."
11. Save the changes
12. Use `browser_evaluate` to verify the update persisted:
    ```js
    const db = await new Dexie('skaldbok-db').open();
    const refs = await db.table('referenceNotes').toArray();
    return refs.slice(-1)[0];
    ```
13. Verify the `updatedAt` timestamp has changed
14. Delete the reference note (click delete button)
15. Confirm deletion if a dialog appears
16. Verify the note no longer appears in the reference list
17. Use `browser_evaluate` to confirm deletion from IndexedDB:
    ```js
    const db = await new Dexie('skaldbok-db').open();
    const count = await db.table('referenceNotes').count();
    return count;
    ```

## Expected Results
- Reference note is created and visible in the reference list
- Record exists in `referenceNotes` table with correct content and `updatedAt`
- Content update persists and `updatedAt` is refreshed
- After deletion, the note is removed from both UI and IndexedDB

## Execution Tool
playwright -- Use browser_evaluate to interact with Dexie DB directly, browser_navigate to load the app

## Pass / Fail Criteria
- **Pass:** Reference note is created, read, updated (with timestamp change), and deleted successfully in both UI and IndexedDB `referenceNotes` table
- **Fail:** Any CRUD operation fails to reflect in UI or IndexedDB, timestamps are not updated, or note persists after deletion
