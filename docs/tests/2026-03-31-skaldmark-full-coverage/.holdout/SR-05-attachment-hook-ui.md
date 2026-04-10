---
scenario_id: "SR-05"
title: "Attachment Hook and UI"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-05: Attachment Hook and UI

## Description
Verifies that the useNoteAttachments hook works correctly and that attachment UI components render thumbnails, support caption editing, and manage object URL lifecycle properly.

## Preconditions
- App is running at localhost
- A campaign and session exist with at least one note
- sequential: true

## Steps
1. Navigate to `/session` and ensure an active campaign and session exist.
2. Navigate to `/notes`.
3. Create a new note via the Quick Note drawer (tap the add/create button, fill in title "Attachment Test Note", save).
4. Open the newly created note by tapping on it in the notes list.
5. Take a snapshot to identify the attach/image button in the note editor UI.
6. Look for an attach button (camera icon, paperclip icon, or "Attach" label).
7. Prepare a test image file and use `browser_file_upload` to attach an image via the file input:
   - First use `browser_evaluate` to create a test image file programmatically if no file input is visible:
     ```js
     // Create a 100x100 red PNG as test data
     const canvas = document.createElement('canvas');
     canvas.width = 100;
     canvas.height = 100;
     const ctx = canvas.getContext('2d');
     ctx.fillStyle = 'red';
     ctx.fillRect(0, 0, 100, 100);
     return canvas.toDataURL('image/png');
     ```
8. Upload the image file using the attach button or file input.
9. Wait for the thumbnail to render in the note editor area.
10. Take a snapshot to verify the thumbnail is visible.
11. Verify the thumbnail image element exists in the DOM (look for `<img>` with a blob: or object URL src).
12. Tap on the thumbnail or its caption area to edit the caption.
13. Type "Red test square" as the caption.
14. Save/confirm the caption.
15. Use `browser_evaluate` to verify the attachment exists in IndexedDB with the caption:
    ```js
    const { db } = await import('/src/storage/db/client');
    const atts = await db.attachments.toArray();
    return JSON.stringify(atts.map(a => ({ id: a.id, caption: a.caption, filename: a.filename })));
    ```
16. Navigate away from the note (back to notes list).
17. Re-open the same note.
18. Verify the thumbnail still renders (object URL recreated on mount).
19. Check browser console for any object URL leak warnings via `browser_console_messages`.

## Expected Results
- Attach button is visible in the note editor.
- Image upload creates a thumbnail that renders inline.
- Caption editing persists to IndexedDB.
- Navigating away and back recreates the thumbnail (object URLs regenerated).
- No object URL memory leak warnings in console.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Thumbnail renders after upload; caption persists; re-mount recreates thumbnails; no console errors.
- **Fail:** Upload fails, no thumbnail shown, caption lost, or object URL errors in console.
