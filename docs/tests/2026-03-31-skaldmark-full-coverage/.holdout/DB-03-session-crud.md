---
scenario_id: "DB-03"
title: "Session CRUD"
tool: "playwright"
sequential: true
type: test-scenario
tags:
  - test-scenario
---

# Scenario DB-03: Session CRUD

## Description
Verify session lifecycle: create a session within a campaign, read the active session, update session status, and validate the IndexedDB `sessions` table. Requires an existing campaign.

## Preconditions
- App is running locally (e.g. http://localhost:5173)
- Database `skaldbok-db` is accessible
- An active campaign exists (create one via DB-02 or seed via browser_evaluate)

## Steps
1. Seed a campaign if none exists using `browser_evaluate`:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const count = await db.table('campaigns').count();
   if (count === 0) {
     await db.table('campaigns').add({
       id: crypto.randomUUID(),
       name: 'Test Campaign',
       description: 'Seeded for session test',
       status: 'active',
       createdAt: new Date().toISOString(),
       updatedAt: new Date().toISOString()
     });
   }
   return await db.table('campaigns').toArray();
   ```
2. Navigate to `http://localhost:5173/session`
3. Take a snapshot to confirm the Session screen is loaded with the active campaign
4. Click the "Start Session" or "New Session" button
5. Verify a new session is created and shown as active in the UI
6. Use `browser_evaluate` to confirm the session record in IndexedDB:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const sessions = await db.table('sessions').toArray();
   return sessions.map(s => ({ id: s.id, campaignId: s.campaignId, status: s.status }));
   ```
7. Verify the session status is "active" (or equivalent)
8. Click the "End Session" or session status toggle button
9. Confirm the session status changes in the UI (e.g. "completed" or "ended")
10. Use `browser_evaluate` to verify the status update persisted:
    ```js
    const db = await new Dexie('skaldbok-db').open();
    const sessions = await db.table('sessions').toArray();
    return sessions.map(s => ({ id: s.id, status: s.status, date: s.date }));
    ```

## Expected Results
- A new session is created and linked to the active campaign
- Session record exists in `sessions` table with correct `campaignId` and `status`
- Session status update (active to completed/ended) persists in IndexedDB
- The compound index `[campaignId+status]` is queryable

## Execution Tool
playwright -- Use browser_evaluate to interact with Dexie DB directly, browser_navigate to load the app

## Pass / Fail Criteria
- **Pass:** Session is created, linked to campaign, status is updated, and all state is correctly reflected in IndexedDB `sessions` table
- **Fail:** Session is not created, not linked to campaign, status update does not persist, or IndexedDB state is inconsistent
