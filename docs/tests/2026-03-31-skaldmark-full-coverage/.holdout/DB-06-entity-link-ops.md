---
scenario_id: "DB-06"
title: "EntityLink Operations"
tool: "playwright"
sequential: true
type: test-scenario
tags:
  - test-scenario
---

# Scenario DB-06: EntityLink Operations

## Description
Verify entity link operations: create a link between entities, read links from and to an entity, bulk delete links for a note, and validate the IndexedDB `entityLinks` table.

## Preconditions
- App is running locally (e.g. http://localhost:5173)
- Database `skaldbok-db` is accessible
- A note and a character exist (seed via browser_evaluate if needed)

## Steps
1. Navigate to `http://localhost:5173` to initialize the app and Dexie
2. Seed a note and character via `browser_evaluate`:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const campaignId = crypto.randomUUID();
   const noteId = crypto.randomUUID();
   const charId = crypto.randomUUID();
   await db.table('campaigns').add({
     id: campaignId, name: 'Link Test Campaign', description: '',
     status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
   });
   await db.table('notes').add({
     id: noteId, campaignId, sessionId: null, type: 'general',
     status: 'active', pinned: false, content: 'Link test note',
     createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
   });
   await db.table('characters').add({
     id: charId, name: 'Link Test Hero', systemId: 'dragonbane',
     updatedAt: new Date().toISOString()
   });
   return { campaignId, noteId, charId };
   ```
3. Create an entity link between the note and the character via `browser_evaluate`:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const notes = await db.table('notes').toArray();
   const chars = await db.table('characters').toArray();
   const noteId = notes.slice(-1)[0].id;
   const charId = chars.slice(-1)[0].id;
   await db.table('entityLinks').add({
     id: crypto.randomUUID(),
     fromType: 'note', fromId: noteId,
     toType: 'character', toId: charId,
     createdAt: new Date().toISOString()
   });
   return await db.table('entityLinks').toArray();
   ```
4. Read links from the note using `browser_evaluate`:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const noteId = (await db.table('notes').toArray()).slice(-1)[0].id;
   const links = await db.table('entityLinks').where('fromId').equals(noteId).toArray();
   return links;
   ```
5. Verify the link has correct `fromType`, `fromId`, `toType`, and `toId`
6. Read links to the character using `browser_evaluate`:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const charId = (await db.table('characters').toArray()).slice(-1)[0].id;
   const links = await db.table('entityLinks').where('toId').equals(charId).toArray();
   return links;
   ```
7. Add a second link from the same note to another entity, then bulk delete all links for that note:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const noteId = (await db.table('notes').toArray()).slice(-1)[0].id;
   await db.table('entityLinks').add({
     id: crypto.randomUUID(),
     fromType: 'note', fromId: noteId,
     toType: 'location', toId: 'some-location-id',
     createdAt: new Date().toISOString()
   });
   const before = await db.table('entityLinks').where('fromId').equals(noteId).count();
   await db.table('entityLinks').where('fromId').equals(noteId).delete();
   const after = await db.table('entityLinks').where('fromId').equals(noteId).count();
   return { before, after };
   ```
8. Verify `before` is 2 and `after` is 0

## Expected Results
- Entity link is created between note and character with correct fields
- Reading links by `fromId` returns links originating from the note
- Reading links by `toId` returns links pointing to the character
- Bulk delete by `fromId` removes all links for that note

## Execution Tool
playwright -- Use browser_evaluate to interact with Dexie DB directly, browser_navigate to load the app

## Pass / Fail Criteria
- **Pass:** Entity links are created, queryable by fromId and toId, and bulk deletion by note removes all associated links from the `entityLinks` table
- **Fail:** Links are not created correctly, queries return wrong results, or bulk delete leaves orphaned records
