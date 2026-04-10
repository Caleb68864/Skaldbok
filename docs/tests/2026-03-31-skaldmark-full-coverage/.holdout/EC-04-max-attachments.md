---
scenario_id: "EC-04"
title: "Max Attachments Limit"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EC-04: Max Attachments Limit

## Description
Verifies that the maximum 10 attachment limit per note is enforced. Attempting to add an 11th attachment shows a toast notification, and exactly 10 attachments remain stored.

## Preconditions
- App is running at localhost
- A campaign and session exist with at least one note
- sequential: true

## Steps
1. Navigate to `/session`, ensure an active campaign and session.
2. Use `browser_evaluate` to create a test note and add exactly 10 attachments:
   ```js
   const { db } = await import('/src/storage/db/client');
   const { createAttachment } = await import('/src/storage/repositories/attachmentRepository');
   const notes = await db.notes.toArray();
   let noteId = notes[0]?.id;
   let campaignId = notes[0]?.campaignId;
   if (!noteId) {
     // Create a note if none exists
     const id = crypto.randomUUID();
     const campaigns = await db.campaigns.toArray();
     campaignId = campaigns[0].id;
     await db.notes.put({
       id, campaignId, title: 'Max Attach Test', body: {}, type: 'generic',
       status: 'active', pinned: false, tags: [], schemaVersion: 1,
       createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
     });
     noteId = id;
   }
   for (let i = 1; i <= 10; i++) {
     await createAttachment({
       noteId, campaignId,
       filename: `photo-${i}.jpg`,
       mimeType: 'image/jpeg',
       sizeBytes: 1024,
       blob: new Blob([`data-${i}`], { type: 'image/jpeg' }),
       caption: `Photo ${i}`,
     });
   }
   const atts = await db.attachments.where('noteId').equals(noteId).toArray();
   return JSON.stringify({ noteId, count: atts.length });
   ```
3. Verify the count is exactly 10.
4. Navigate to `/notes` and open the note.
5. Take a snapshot to see 10 attachment thumbnails.
6. Attempt to add an 11th attachment via the UI (tap Attach button, upload an image).
7. Alternatively, use `browser_evaluate` to simulate the hook behavior:
   ```js
   // The useNoteAttachments hook checks count and shows toast
   const { db } = await import('/src/storage/db/client');
   const notes = await db.notes.toArray();
   const noteId = notes.find(n => n.title === 'Max Attach Test')?.id || notes[0].id;
   const atts = await db.attachments.where('noteId').equals(noteId).toArray();
   return atts.length;
   ```
8. Verify a toast notification appears with text containing "Maximum 10 attachments" or similar.
9. Use `browser_evaluate` to confirm still exactly 10 attachments in IndexedDB for this note.
10. Check `browser_console_messages` for the toast trigger (no unhandled errors).

## Expected Results
- 10 attachments are stored successfully.
- Attempting an 11th attachment triggers a toast: "Maximum 10 attachments per note".
- The 11th attachment is NOT stored in IndexedDB.
- Exactly 10 attachments remain after the failed attempt.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** 10 attachments stored; 11th rejected with toast; count remains 10.
- **Fail:** More than 10 attachments stored, no toast shown, or app crashes on limit.
