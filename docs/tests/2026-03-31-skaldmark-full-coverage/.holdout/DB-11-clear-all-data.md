---
scenario_id: "DB-11"
title: "Clear All Data"
tool: "playwright"
sequential: true
type: test-scenario
tags:
  - test-scenario
---

# Scenario DB-11: Clear All Data

## Description
Verify the "Clear All Data" function from the Settings screen: trigger the clear action, confirm the prompt, and verify all tables are emptied and the app returns to its initial state.

## Preconditions
- App is running locally (e.g. http://localhost:5173)
- Database `skaldbok-db` is accessible
- Multiple tables have data (seed a variety of records to ensure thorough testing)

## Steps
1. Navigate to `http://localhost:5173` to initialize the app and Dexie
2. Seed data across multiple tables via `browser_evaluate`:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const campaignId = crypto.randomUUID();
   const noteId = crypto.randomUUID();
   const charId = crypto.randomUUID();
   const partyId = crypto.randomUUID();
   await db.table('campaigns').add({
     id: campaignId, name: 'Clear Test Campaign', description: '',
     status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
   });
   await db.table('characters').add({
     id: charId, name: 'Clear Test Hero', systemId: 'dragonbane',
     updatedAt: new Date().toISOString()
   });
   await db.table('notes').add({
     id: noteId, campaignId, sessionId: null, type: 'general',
     status: 'active', pinned: false, content: 'Clear test note',
     createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
   });
   await db.table('referenceNotes').add({
     id: crypto.randomUUID(), title: 'Clear Test Ref',
     content: 'Reference content', updatedAt: new Date().toISOString()
   });
   await db.table('appSettings').put({
     id: 'theme', value: 'dark'
   });
   await db.table('attachments').add({
     id: crypto.randomUUID(), noteId, campaignId, caption: 'Test',
     data: '', mimeType: 'image/png', createdAt: new Date().toISOString()
   });
   await db.table('entityLinks').add({
     id: crypto.randomUUID(), fromType: 'note', fromId: noteId,
     toType: 'character', toId: charId, createdAt: new Date().toISOString()
   });
   await db.table('parties').add({
     id: partyId, campaignId, createdAt: new Date().toISOString()
   });
   await db.table('partyMembers').add({
     id: crypto.randomUUID(), partyId, linkedCharacterId: charId
   });
   return 'Seeded all tables';
   ```
3. Use `browser_evaluate` to confirm data exists across tables:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const counts = {};
   for (const table of db.tables) {
     counts[table.name] = await table.count();
   }
   return counts;
   ```
4. Verify all seeded tables have at least 1 record
5. Navigate to `http://localhost:5173/settings`
6. Take a snapshot to confirm the Settings screen is loaded
7. Locate the "Clear All Data" or "Reset" button
8. Click the "Clear All Data" button
9. Handle the confirmation dialog: click "Confirm" or "Yes" (use `browser_handle_dialog` if needed)
10. Wait for the operation to complete
11. Use `browser_evaluate` to verify all tables are emptied:
    ```js
    const db = await new Dexie('skaldbok-db').open();
    const counts = {};
    for (const table of db.tables) {
      counts[table.name] = await table.count();
    }
    return counts;
    ```
12. Verify that `characters`, `referenceNotes`, `appSettings`, `campaigns`, `sessions`, `notes`, `entityLinks`, `parties`, `partyMembers`, and `attachments` all have 0 records
13. Navigate to the home screen (`http://localhost:5173/`) and take a snapshot
14. Verify the app is in its initial state (no characters, no campaigns, default theme)

## Expected Results
- All tables have data before the clear operation
- After clicking "Clear All Data" and confirming, every table is emptied
- The `characters`, `referenceNotes`, `appSettings`, `campaigns`, `sessions`, `notes`, `entityLinks`, `parties`, `partyMembers`, and `attachments` tables all report 0 records
- The app returns to its initial/onboarding state after the clear

## Execution Tool
playwright -- Use browser_evaluate to interact with Dexie DB directly, browser_navigate to load the app

## Pass / Fail Criteria
- **Pass:** All tables are emptied after clear, the app returns to its initial state, and no residual data remains in IndexedDB
- **Fail:** Any table retains data after the clear operation, or the app does not return to its initial state
