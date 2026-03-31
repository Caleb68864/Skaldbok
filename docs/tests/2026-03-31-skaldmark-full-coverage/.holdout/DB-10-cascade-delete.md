---
scenario_id: "DB-10"
title: "Cascade Delete"
tool: "playwright"
sequential: true
type: test-scenario
tags:
  - test-scenario
---

# Scenario DB-10: Cascade Delete

## Description
Verify cascade delete behavior: create a note with attachments and entity links, delete the note, and confirm that associated attachments and entity links are also deleted. This is a critical data integrity test.

## Preconditions
- App is running locally (e.g. http://localhost:5173)
- Database `skaldbok-db` is accessible
- No specific pre-existing data required (test seeds its own)

## Steps
1. Navigate to `http://localhost:5173` to initialize the app and Dexie
2. Seed a campaign, note, attachments, and entity links via `browser_evaluate`:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const campaignId = crypto.randomUUID();
   const noteId = crypto.randomUUID();
   const charId = crypto.randomUUID();
   await db.table('campaigns').add({
     id: campaignId, name: 'Cascade Test Campaign', description: '',
     status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
   });
   await db.table('notes').add({
     id: noteId, campaignId, sessionId: null, type: 'general',
     status: 'active', pinned: false, content: 'Cascade delete test note',
     createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
   });
   await db.table('attachments').bulkAdd([
     { id: crypto.randomUUID(), noteId, campaignId, caption: 'Map 1', data: '', mimeType: 'image/png', createdAt: new Date().toISOString() },
     { id: crypto.randomUUID(), noteId, campaignId, caption: 'Map 2', data: '', mimeType: 'image/png', createdAt: new Date().toISOString() }
   ]);
   await db.table('entityLinks').bulkAdd([
     { id: crypto.randomUUID(), fromType: 'note', fromId: noteId, toType: 'character', toId: charId, createdAt: new Date().toISOString() },
     { id: crypto.randomUUID(), fromType: 'note', fromId: noteId, toType: 'location', toId: 'loc-1', createdAt: new Date().toISOString() }
   ]);
   return { campaignId, noteId };
   ```
3. Use `browser_evaluate` to verify the seeded data:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const notes = await db.table('notes').count();
   const attachments = await db.table('attachments').count();
   const links = await db.table('entityLinks').count();
   return { notes, attachments, links };
   ```
4. Verify counts: 1 note, 2 attachments, 2 entity links
5. Navigate to `http://localhost:5173/notes`
6. Locate the seeded note "Cascade delete test note" in the list
7. Delete the note via the UI (click delete, confirm if prompted)
8. Use `browser_evaluate` to verify the note was deleted:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   return await db.table('notes').count();
   ```
9. Verify notes count is 0
10. Use `browser_evaluate` to verify attachments were cascade deleted:
    ```js
    const db = await new Dexie('skaldbok-db').open();
    return await db.table('attachments').count();
    ```
11. Verify attachments count is 0
12. Use `browser_evaluate` to verify entity links were cascade deleted:
    ```js
    const db = await new Dexie('skaldbok-db').open();
    return await db.table('entityLinks').count();
    ```
13. Verify entity links count is 0

## Expected Results
- Note, attachments, and entity links are all seeded correctly
- Deleting the note via UI triggers cascade deletion
- All attachments linked to the note are deleted from `attachments` table
- All entity links originating from the note are deleted from `entityLinks` table
- No orphaned records remain in any table

## Execution Tool
playwright -- Use browser_evaluate to interact with Dexie DB directly, browser_navigate to load the app

## Pass / Fail Criteria
- **Pass:** Deleting a note cascades to remove all associated attachments and entity links, leaving zero orphaned records in IndexedDB
- **Fail:** Note is deleted but attachments or entity links persist (orphaned records), or cascade delete does not trigger
