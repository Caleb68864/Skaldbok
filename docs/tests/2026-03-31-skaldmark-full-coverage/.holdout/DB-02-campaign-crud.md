---
scenario_id: "DB-02"
title: "Campaign CRUD"
tool: "playwright"
sequential: true
type: test-scenario
tags:
  - test-scenario
---

# Scenario DB-02: Campaign CRUD

## Description
Verify campaign lifecycle: create a campaign, read and confirm it is active, update its name and description, and validate state in the IndexedDB `campaigns` table.

## Preconditions
- App is running locally (e.g. http://localhost:5173)
- Database `skaldbok-db` is accessible
- No pre-existing campaigns required

## Steps
1. Navigate to the app: `browser_navigate` to `http://localhost:5173/session`
2. Take a snapshot to confirm the Session screen is loaded
3. Click the "New Campaign" or campaign creation button
4. Fill in campaign name: "Misty Vale Campaign"
5. Fill in campaign description: "Adventures in the Misty Vale"
6. Submit the campaign creation form
7. Verify the campaign "Misty Vale Campaign" appears as the active campaign in the UI
8. Use `browser_evaluate` to confirm the campaign record exists in IndexedDB:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const campaigns = await db.table('campaigns').toArray();
   return campaigns.map(c => ({ id: c.id, name: c.name, status: c.status }));
   ```
9. Click edit on the campaign to open the edit form
10. Update the campaign name to "Misty Vale Campaign - Revised"
11. Update the description to "Revised adventures in the Misty Vale"
12. Save the changes
13. Verify the updated name is reflected in the UI
14. Use `browser_evaluate` to confirm the update persisted:
    ```js
    const db = await new Dexie('skaldbok-db').open();
    const campaigns = await db.table('campaigns').toArray();
    return campaigns.find(c => c.name === 'Misty Vale Campaign - Revised');
    ```

## Expected Results
- Campaign "Misty Vale Campaign" is created and shown as active
- Campaign record exists in `campaigns` table with correct name, description, and status
- Name and description updates persist in IndexedDB
- UI reflects all changes immediately

## Execution Tool
playwright -- Use browser_evaluate to interact with Dexie DB directly, browser_navigate to load the app

## Pass / Fail Criteria
- **Pass:** Campaign is created, shown as active, updated successfully, and all changes are reflected in both UI and IndexedDB `campaigns` table
- **Fail:** Campaign does not appear after creation, updates are not persisted, or IndexedDB state does not match UI
