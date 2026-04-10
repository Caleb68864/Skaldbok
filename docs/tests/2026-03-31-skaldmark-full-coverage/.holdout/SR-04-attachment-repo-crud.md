---
scenario_id: "SR-04"
title: "Attachment Repository CRUD"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-04: Attachment Repository CRUD

## Description
Verifies that all attachment CRUD operations work correctly: create, read by note, read by campaign, update caption, delete single, and delete by note.

## Preconditions
- App is running at localhost
- sequential: true

## Steps
1. Navigate to the app root (`/`).
2. Use `browser_evaluate` to create a test attachment via the repository:
   ```js
   const { createAttachment } = await import('/src/storage/repositories/attachmentRepository');
   const att = await createAttachment({
     noteId: 'note-1',
     campaignId: 'camp-1',
     filename: 'photo1.jpg',
     mimeType: 'image/jpeg',
     sizeBytes: 2048,
     blob: new Blob(['fake-image-data'], { type: 'image/jpeg' }),
     caption: 'First photo',
   });
   return JSON.stringify({ id: att.id, noteId: att.noteId });
   ```
3. Create a second attachment for the same note and a third for a different note (same campaign):
   ```js
   const { createAttachment } = await import('/src/storage/repositories/attachmentRepository');
   await createAttachment({ noteId: 'note-1', campaignId: 'camp-1', filename: 'photo2.jpg', mimeType: 'image/jpeg', sizeBytes: 1024, blob: new Blob(['data2'], { type: 'image/jpeg' }) });
   await createAttachment({ noteId: 'note-2', campaignId: 'camp-1', filename: 'map.png', mimeType: 'image/png', sizeBytes: 4096, blob: new Blob(['data3'], { type: 'image/png' }), caption: 'Dungeon map' });
   return 'ok';
   ```
4. Read by note -- verify `getAttachmentsByNote('note-1')` returns exactly 2 attachments:
   ```js
   const { getAttachmentsByNote } = await import('/src/storage/repositories/attachmentRepository');
   const atts = await getAttachmentsByNote('note-1');
   return JSON.stringify(atts.map(a => a.filename));
   ```
5. Read by campaign -- verify `getAttachmentsByCampaign('camp-1')` returns exactly 3 attachments:
   ```js
   const { getAttachmentsByCampaign } = await import('/src/storage/repositories/attachmentRepository');
   const atts = await getAttachmentsByCampaign('camp-1');
   return atts.length;
   ```
6. Update caption on the first attachment:
   ```js
   const { getAttachmentsByNote, updateAttachmentCaption } = await import('/src/storage/repositories/attachmentRepository');
   const atts = await getAttachmentsByNote('note-1');
   await updateAttachmentCaption(atts[0].id, 'Updated caption');
   const updated = await getAttachmentsByNote('note-1');
   return updated.find(a => a.id === atts[0].id)?.caption;
   ```
7. Verify updated caption equals 'Updated caption'.
8. Delete single attachment:
   ```js
   const { getAttachmentsByNote, deleteAttachment } = await import('/src/storage/repositories/attachmentRepository');
   const atts = await getAttachmentsByNote('note-1');
   await deleteAttachment(atts[0].id);
   const remaining = await getAttachmentsByNote('note-1');
   return remaining.length;
   ```
9. Verify note-1 now has exactly 1 attachment.
10. Delete by note:
    ```js
    const { deleteAttachmentsByNote, getAttachmentsByNote } = await import('/src/storage/repositories/attachmentRepository');
    await deleteAttachmentsByNote('note-1');
    const remaining = await getAttachmentsByNote('note-1');
    return remaining.length;
    ```
11. Verify note-1 has 0 attachments. Verify note-2 still has 1 attachment (not affected by delete-by-note).
12. Clean up test data.

## Expected Results
- Create returns a valid attachment record with generated id and createdAt.
- Read by note returns only attachments for that note.
- Read by campaign returns all attachments in the campaign.
- Update caption persists the new value.
- Delete single removes only the targeted attachment.
- Delete by note removes all attachments for that note but not others.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** All CRUD operations return expected counts and values; no data leaks across notes.
- **Fail:** Any CRUD operation returns wrong count, wrong data, or affects unrelated records.
