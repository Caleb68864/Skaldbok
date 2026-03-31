---
scenario_id: "SR-01"
title: "Universal Note Schema"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-01: Universal Note Schema

## Description
Verifies that the baseNoteSchema stores all required fields (id, campaignId, sessionId, title, body, status, pinned, tags, schemaVersion, createdAt, updatedAt) and that all 9 note types (generic, npc, combat, location, loot, rumor, quote, skill-check, recap) persist correctly in IndexedDB.

## Preconditions
- App is running at localhost
- No prior data in IndexedDB (fresh state or cleared)

## Steps
1. Navigate to the app root (`/`).
2. Create a campaign via the Session screen (`/session`) by tapping the campaign creation prompt or button.
3. Start a session within the new campaign.
4. For each of the 9 note types (`generic`, `npc`, `combat`, `location`, `loot`, `rumor`, `quote`, `skill-check`, `recap`), use `browser_evaluate` to insert a note directly into IndexedDB via Dexie:
   ```js
   const { db } = await import('/src/storage/db/client');
   await db.notes.put({
     id: crypto.randomUUID(),
     campaignId: '<campaignId>',
     sessionId: '<sessionId>',
     title: 'Test <type> note',
     body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body for <type>' }] }] },
     type: '<type>',
     status: 'active',
     pinned: false,
     tags: ['test', '<type>'],
     schemaVersion: 1,
     createdAt: new Date().toISOString(),
     updatedAt: new Date().toISOString(),
   });
   ```
5. Navigate to `/notes`.
6. Use `browser_evaluate` to read all notes from the `notes` table:
   ```js
   const { db } = await import('/src/storage/db/client');
   return await db.notes.toArray();
   ```
7. For each returned note, verify the presence and correct types of all baseNoteSchema fields: `id` (string), `campaignId` (string), `sessionId` (string|undefined), `title` (string), `body` (object), `status` ('active'|'archived'), `pinned` (boolean), `tags` (array), `schemaVersion` (number), `createdAt` (string), `updatedAt` (string).
8. Verify exactly 9 notes exist, one per type.
9. Take a snapshot of the Notes screen to confirm notes render in the UI.

## Expected Results
- All 9 note types are stored in IndexedDB with the full baseNoteSchema shape.
- Each note contains all required fields with correct data types.
- The Notes screen renders without errors and shows the created notes.
- No Zod validation errors appear in the console (check via `browser_console_messages`).

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** All 9 note types stored with correct schema fields; Notes screen renders them; no console errors.
- **Fail:** Any note type missing, any schema field absent or wrong type, or console shows validation errors.
