---
scenario_id: "SR-03"
title: "Attachment Table DB Schema"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-03: Attachment Table DB Schema

## Description
Verifies that the attachments table exists in IndexedDB with the correct Dexie schema (version 4) and indexes: id, noteId, campaignId, createdAt.

## Preconditions
- App is running at localhost
- sequential: true

## Steps
1. Navigate to the app root (`/`).
2. Wait for the app to finish loading (Loading... text disappears).
3. Use `browser_evaluate` to inspect the Dexie database schema:
   ```js
   const { db } = await import('/src/storage/db/client');
   const tables = db.tables.map(t => ({ name: t.name, schema: t.schema }));
   return JSON.stringify(tables);
   ```
4. Parse the returned JSON and locate the `attachments` table entry.
5. Verify the `attachments` table exists.
6. Verify the attachments table indexes include: `id` (primary key), `noteId`, `campaignId`, `createdAt`.
7. Use `browser_evaluate` to check the current database version:
   ```js
   const { db } = await import('/src/storage/db/client');
   return db.verno;
   ```
8. Verify the database version is at least 4 (version 4 introduced attachments).
9. Use `browser_evaluate` to verify the Attachment type shape by inserting and reading a test record:
   ```js
   const { db } = await import('/src/storage/db/client');
   const testId = crypto.randomUUID();
   await db.attachments.put({
     id: testId,
     noteId: 'test-note',
     campaignId: 'test-campaign',
     filename: 'test.jpg',
     mimeType: 'image/jpeg',
     sizeBytes: 1024,
     blob: new Blob(['test'], { type: 'image/jpeg' }),
     caption: 'Test caption',
     createdAt: new Date().toISOString(),
   });
   const record = await db.attachments.get(testId);
   await db.attachments.delete(testId);
   return JSON.stringify({ id: record.id, noteId: record.noteId, campaignId: record.campaignId, filename: record.filename, mimeType: record.mimeType, sizeBytes: record.sizeBytes, hasBlob: record.blob instanceof Blob, caption: record.caption, createdAt: record.createdAt });
   ```
10. Verify all fields are present and correctly typed.

## Expected Results
- The `attachments` table exists in the Dexie schema.
- Indexes include id (primary key), noteId, campaignId, createdAt.
- Database version is >= 4.
- A test attachment record round-trips correctly with all expected fields.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Attachments table exists with correct indexes; DB version >= 4; test record round-trips with all fields intact.
- **Fail:** Table missing, indexes wrong, DB version too low, or record fields missing/mistyped.
