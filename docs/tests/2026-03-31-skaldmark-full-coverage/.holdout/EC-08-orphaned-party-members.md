---
scenario_id: "EC-08"
title: "Orphaned Party Members"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EC-08: Orphaned Party Members

## Description
Verifies that deleting a character who is a party member either cleans up the partyMembers record automatically or handles the orphaned reference gracefully without crashes or stale data in the UI.

## Preconditions
- App is running at localhost
- sequential: true

## Steps
1. Navigate to `/library`.
2. Create a new character named "Doomed Warrior" via the create button.
3. Use `browser_evaluate` to get the character ID:
   ```js
   const { db } = await import('/src/storage/db/client');
   const chars = await db.characters.toArray();
   const doomed = chars.find(c => c.name === 'Doomed Warrior');
   return doomed?.id;
   ```
4. Navigate to `/session` and ensure a campaign exists.
5. If no party exists, use `browser_evaluate` to create one:
   ```js
   const { db } = await import('/src/storage/db/client');
   const campaigns = await db.campaigns.toArray();
   const campId = campaigns[0].id;
   let parties = await db.parties.where('campaignId').equals(campId).toArray();
   if (parties.length === 0) {
     await db.parties.put({
       id: crypto.randomUUID(),
       campaignId: campId,
       name: 'Test Party',
       schemaVersion: 1,
       createdAt: new Date().toISOString(),
       updatedAt: new Date().toISOString(),
     });
     parties = await db.parties.where('campaignId').equals(campId).toArray();
   }
   return parties[0].id;
   ```
6. Add the "Doomed Warrior" as a party member:
   ```js
   const { db } = await import('/src/storage/db/client');
   const parties = await db.parties.toArray();
   const partyId = parties[0].id;
   const chars = await db.characters.toArray();
   const doomed = chars.find(c => c.name === 'Doomed Warrior');
   await db.partyMembers.put({
     id: crypto.randomUUID(),
     partyId,
     linkedCharacterId: doomed.id,
     role: 'adventurer',
     schemaVersion: 1,
     createdAt: new Date().toISOString(),
     updatedAt: new Date().toISOString(),
   });
   const members = await db.partyMembers.where('partyId').equals(partyId).toArray();
   return members.length;
   ```
7. Verify partyMembers count includes "Doomed Warrior".
8. Navigate to `/library`.
9. Delete "Doomed Warrior" via the library UI (long press or delete action).
10. Use `browser_evaluate` to check if the party member record was cleaned up:
    ```js
    const { db } = await import('/src/storage/db/client');
    const members = await db.partyMembers.toArray();
    const orphaned = members.filter(m => {
      // Check if linkedCharacterId still references a valid character
      return true; // Will filter below
    });
    const chars = await db.characters.toArray();
    const charIds = new Set(chars.map(c => c.id));
    const orphanedMembers = members.filter(m => !charIds.has(m.linkedCharacterId));
    return JSON.stringify({ totalMembers: members.length, orphanedCount: orphanedMembers.length, orphanedIds: orphanedMembers.map(m => m.linkedCharacterId) });
    ```
11. Navigate to `/session` and open the Manage Party drawer.
12. Take a snapshot.
13. Verify the deleted character does not appear in the party list, or if it does, it shows gracefully (e.g., "Unknown character" placeholder).
14. Check `browser_console_messages` for errors related to missing character references.

## Expected Results
- Either: the partyMembers record is automatically deleted when the character is removed (clean cascade), OR the party UI handles the orphaned reference gracefully without crashing.
- No blank entries, null reference errors, or broken UI in the party management view.
- Console shows no unhandled errors.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Party member cleaned up on delete OR orphaned reference handled gracefully in UI; no crashes or console errors.
- **Fail:** UI crashes when rendering orphaned party member, blank entries appear, or unhandled console errors.
