---
scenario_id: "DB-05"
title: "Attachment CRUD"
tool: "playwright"
sequential: true
type: test-scenario
tags:
  - test-scenario
---

# Scenario DB-05: Attachment CRUD

## Description
Verify attachment lifecycle: create an attachment on a note, read attachments by note, update a caption, delete a single attachment, and delete all attachments by note. Validate the IndexedDB `attachments` table at each step.

## Preconditions
- App is running locally (e.g. http://localhost:5173)
- Database `skaldbok-db` is accessible
- A note exists in the `notes` table (seed via browser_evaluate if needed)

## Steps
1. Seed a campaign and note if needed using `browser_evaluate`:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   let campaignId, noteId;
   const camps = await db.table('campaigns').toArray();
   if (camps.length === 0) {
     campaignId = crypto.randomUUID();
     await db.table('campaigns').add({
       id: campaignId, name: 'Attachment Test Campaign', description: '',
       status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
     });
   } else { campaignId = camps[0].id; }
   noteId = crypto.randomUUID();
   await db.table('notes').add({
     id: noteId, campaignId, sessionId: null, type: 'general',
     status: 'active', pinned: false, content: 'Attachment test note',
     createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
   });
   return { campaignId, noteId };
   ```
2. Create an attachment directly via `browser_evaluate`:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const noteId = (await db.table('notes').toArray()).slice(-1)[0].id;
   const campaignId = (await db.table('notes').toArray()).slice(-1)[0].campaignId;
   const attId = crypto.randomUUID();
   await db.table('attachments').add({
     id: attId, noteId, campaignId, caption: 'Map of the dungeon',
     data: 'base64-placeholder', mimeType: 'image/png',
     createdAt: new Date().toISOString()
   });
   return attId;
   ```
3. Read attachments by noteId using `browser_evaluate`:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const noteId = (await db.table('notes').toArray()).slice(-1)[0].id;
   const attachments = await db.table('attachments').where('noteId').equals(noteId).toArray();
   return attachments.map(a => ({ id: a.id, noteId: a.noteId, caption: a.caption }));
   ```
4. Verify the attachment record exists with correct `noteId` and `caption`
5. Update the attachment caption using `browser_evaluate`:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const att = (await db.table('attachments').toArray()).slice(-1)[0];
   await db.table('attachments').update(att.id, { caption: 'Updated map caption' });
   return await db.table('attachments').get(att.id);
   ```
6. Verify the caption is updated to "Updated map caption"
7. Delete a single attachment using `browser_evaluate`:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const att = (await db.table('attachments').toArray()).slice(-1)[0];
   await db.table('attachments').delete(att.id);
   return await db.table('attachments').count();
   ```
8. Verify the attachment count is 0
9. Add two more attachments, then delete all by noteId using `browser_evaluate`:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const noteId = (await db.table('notes').toArray()).slice(-1)[0].id;
   const campaignId = (await db.table('notes').toArray()).slice(-1)[0].campaignId;
   await db.table('attachments').bulkAdd([
     { id: crypto.randomUUID(), noteId, campaignId, caption: 'Att 1', data: '', mimeType: 'image/png', createdAt: new Date().toISOString() },
     { id: crypto.randomUUID(), noteId, campaignId, caption: 'Att 2', data: '', mimeType: 'image/png', createdAt: new Date().toISOString() }
   ]);
   const before = await db.table('attachments').where('noteId').equals(noteId).count();
   await db.table('attachments').where('noteId').equals(noteId).delete();
   const after = await db.table('attachments').where('noteId').equals(noteId).count();
   return { before, after };
   ```
10. Verify `before` is 2 and `after` is 0

## Expected Results
- Attachment is created and linked to the correct note via `noteId`
- Reading by `noteId` returns the correct attachment(s)
- Caption update persists in IndexedDB
- Single delete removes only the targeted attachment
- Bulk delete by `noteId` removes all attachments for that note

## Execution Tool
playwright -- Use browser_evaluate to interact with Dexie DB directly, browser_navigate to load the app

## Pass / Fail Criteria
- **Pass:** All attachment CRUD operations succeed: create, read by noteId, update caption, single delete, and bulk delete by noteId all produce correct IndexedDB state
- **Fail:** Any operation fails, attachment is not linked to the correct note, or records persist after deletion
