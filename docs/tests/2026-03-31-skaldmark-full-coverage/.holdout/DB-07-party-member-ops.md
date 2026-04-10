---
scenario_id: "DB-07"
title: "Party and PartyMember Operations"
tool: "playwright"
sequential: true
type: test-scenario
tags:
  - test-scenario
---

# Scenario DB-07: Party and PartyMember Operations

## Description
Verify party and party member operations: create a party for a campaign, add members, read members, remove a member, and validate the IndexedDB `parties` and `partyMembers` tables.

## Preconditions
- App is running locally (e.g. http://localhost:5173)
- Database `skaldbok-db` is accessible
- An active campaign and at least two characters exist (seed if needed)

## Steps
1. Navigate to `http://localhost:5173` to initialize the app and Dexie
2. Seed a campaign and two characters via `browser_evaluate`:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const campaignId = crypto.randomUUID();
   const char1Id = crypto.randomUUID();
   const char2Id = crypto.randomUUID();
   await db.table('campaigns').add({
     id: campaignId, name: 'Party Test Campaign', description: '',
     status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
   });
   await db.table('characters').bulkAdd([
     { id: char1Id, name: 'Fighter', systemId: 'dragonbane', updatedAt: new Date().toISOString() },
     { id: char2Id, name: 'Mage', systemId: 'dragonbane', updatedAt: new Date().toISOString() }
   ]);
   return { campaignId, char1Id, char2Id };
   ```
3. Navigate to `http://localhost:5173/session` to view the campaign
4. Open the "Manage Party" drawer (click the party management button)
5. Add "Fighter" to the party via the UI
6. Add "Mage" to the party via the UI
7. Use `browser_evaluate` to verify the `parties` table has a party for this campaign:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const parties = await db.table('parties').toArray();
   return parties.map(p => ({ id: p.id, campaignId: p.campaignId }));
   ```
8. Use `browser_evaluate` to verify the `partyMembers` table has both members:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const members = await db.table('partyMembers').toArray();
   return members.map(m => ({ id: m.id, partyId: m.partyId, linkedCharacterId: m.linkedCharacterId }));
   ```
9. Verify two members are returned with correct `linkedCharacterId` values
10. Remove "Mage" from the party via the UI (click remove button)
11. Use `browser_evaluate` to confirm only one member remains:
    ```js
    const db = await new Dexie('skaldbok-db').open();
    const members = await db.table('partyMembers').toArray();
    return members.length;
    ```
12. Verify the remaining member is "Fighter" (by `linkedCharacterId`)

## Expected Results
- A party is created in the `parties` table linked to the campaign
- Both characters are added as party members in `partyMembers`
- Members are queryable by `partyId` and `linkedCharacterId`
- Removing a member leaves only the remaining member in `partyMembers`

## Execution Tool
playwright -- Use browser_evaluate to interact with Dexie DB directly, browser_navigate to load the app

## Pass / Fail Criteria
- **Pass:** Party is created for the campaign, members are added and readable, and member removal correctly updates both UI and `partyMembers` table
- **Fail:** Party is not linked to campaign, members are not added, or removal does not correctly update the `partyMembers` table
