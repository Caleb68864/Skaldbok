---
scenario_id: "DB-04"
title: "Note CRUD"
tool: "playwright"
sequential: true
type: test-scenario
tags:
  - test-scenario
---

# Scenario DB-04: Note CRUD

## Description
Verify note lifecycle: create a note via the quick drawer, read it in the notes list, update its content, delete it, and validate state in the IndexedDB `notes` table at each step.

## Preconditions
- App is running locally (e.g. http://localhost:5173)
- Database `skaldbok-db` is accessible
- An active campaign and session exist (seed if necessary)

## Steps
1. Seed campaign and session if needed using `browser_evaluate`:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const campCount = await db.table('campaigns').count();
   let campaignId;
   if (campCount === 0) {
     campaignId = crypto.randomUUID();
     await db.table('campaigns').add({
       id: campaignId, name: 'Note Test Campaign', description: '',
       status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
     });
   } else {
     campaignId = (await db.table('campaigns').toArray())[0].id;
   }
   return campaignId;
   ```
2. Navigate to `http://localhost:5173/notes`
3. Take a snapshot to confirm the Notes screen is loaded
4. Click the "New Note" or quick-add button to open the note creation drawer
5. Enter note title or content: "Session log: The party entered the dungeon"
6. Save the note
7. Verify the note appears in the notes list via snapshot
8. Use `browser_evaluate` to confirm the note exists in IndexedDB:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const notes = await db.table('notes').toArray();
   return notes.map(n => ({ id: n.id, type: n.type, status: n.status, pinned: n.pinned }));
   ```
9. Click on the note to open it for editing
10. Update the content to: "Session log: The party entered the dungeon and found treasure"
11. Save the changes
12. Use `browser_evaluate` to verify the content update persisted:
    ```js
    const db = await new Dexie('skaldbok-db').open();
    const notes = await db.table('notes').toArray();
    return notes[notes.length - 1];
    ```
13. Delete the note (click delete button or swipe to delete)
14. Confirm deletion if a dialog appears
15. Verify the note no longer appears in the notes list
16. Use `browser_evaluate` to confirm the note is removed from IndexedDB:
    ```js
    const db = await new Dexie('skaldbok-db').open();
    const notes = await db.table('notes').toArray();
    return notes.length;
    ```

## Expected Results
- Note is created and visible in the notes list
- Note record exists in `notes` table with correct `campaignId`, `type`, and `status`
- Content update persists in IndexedDB
- After deletion, the note is removed from both UI and IndexedDB

## Execution Tool
playwright -- Use browser_evaluate to interact with Dexie DB directly, browser_navigate to load the app

## Pass / Fail Criteria
- **Pass:** Note is created, read, updated, and deleted successfully with correct state in both UI and IndexedDB `notes` table
- **Fail:** Any CRUD operation fails to reflect in UI or IndexedDB, or note persists after deletion
