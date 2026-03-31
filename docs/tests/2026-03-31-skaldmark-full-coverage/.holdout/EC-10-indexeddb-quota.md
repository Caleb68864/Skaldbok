---
scenario_id: "EC-10"
title: "IndexedDB Quota Handling"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EC-10: IndexedDB Quota Handling

## Description
Verifies that the app handles IndexedDB storage quota gracefully by checking current storage usage via the Storage API and ensuring the app does not crash when approaching storage limits.

## Preconditions
- App is running at localhost
- Browser supports navigator.storage.estimate()

## Steps
1. Navigate to the app root (`/`).
2. Use `browser_evaluate` to check the current storage estimate:
   ```js
   const estimate = await navigator.storage.estimate();
   return JSON.stringify({
     usage: estimate.usage,
     quota: estimate.quota,
     usageMB: (estimate.usage / (1024 * 1024)).toFixed(2),
     quotaMB: (estimate.quota / (1024 * 1024)).toFixed(2),
     percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(4),
   });
   ```
3. Record the baseline storage usage.
4. Use `browser_evaluate` to add moderate data to IndexedDB (simulate normal usage):
   ```js
   const { db } = await import('/src/storage/db/client');
   const campaigns = await db.campaigns.toArray();
   const campId = campaigns[0]?.id || 'test-camp';
   // Add 50 notes with moderate body content
   for (let i = 0; i < 50; i++) {
     await db.notes.put({
       id: `quota-test-${i}`,
       campaignId: campId,
       title: `Quota Test Note ${i}`,
       body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'X'.repeat(1000) }] }] },
       type: 'generic',
       status: 'active',
       pinned: false,
       tags: ['quota-test'],
       schemaVersion: 1,
       createdAt: new Date().toISOString(),
       updatedAt: new Date().toISOString(),
     });
   }
   return 'added 50 notes';
   ```
5. Re-check storage estimate to verify usage increased:
   ```js
   const estimate = await navigator.storage.estimate();
   return JSON.stringify({
     usageMB: (estimate.usage / (1024 * 1024)).toFixed(2),
     quotaMB: (estimate.quota / (1024 * 1024)).toFixed(2),
     percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(4),
   });
   ```
6. Navigate to `/notes` and verify all notes render without errors.
7. Take a snapshot.
8. Use `browser_evaluate` to check if the app has any storage quota error handling:
   ```js
   // Test that a write operation handles quota errors gracefully
   try {
     const { db } = await import('/src/storage/db/client');
     // Try writing a moderately large blob
     await db.attachments.put({
       id: 'quota-blob-test',
       noteId: 'quota-test-0',
       campaignId: 'test-camp',
       filename: 'large.jpg',
       mimeType: 'image/jpeg',
       sizeBytes: 1024 * 1024,
       blob: new Blob([new ArrayBuffer(1024 * 1024)], { type: 'image/jpeg' }),
       createdAt: new Date().toISOString(),
     });
     await db.attachments.delete('quota-blob-test');
     return 'write succeeded';
   } catch (e) {
     return 'write failed: ' + e.message;
   }
   ```
9. Verify the write either succeeds or fails gracefully (no unhandled exception).
10. Clean up test data:
    ```js
    const { db } = await import('/src/storage/db/client');
    await db.notes.where('id').startsWithIgnoreCase('quota-test-').delete();
    return 'cleaned';
    ```
11. Check `browser_console_messages` for any quota-related warnings or errors.

## Expected Results
- navigator.storage.estimate() returns valid usage and quota values.
- App handles storage operations without unhandled exceptions.
- Normal data volumes (50 notes) are well within quota.
- Write operations either succeed or fail gracefully with error handling.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Storage estimate works; data writes succeed; no unhandled quota errors; app remains functional.
- **Fail:** Storage API unavailable, writes crash the app, or unhandled quota exceptions in console.
