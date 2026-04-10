---
scenario_id: "EC-06"
title: "Long Text Handling"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EC-06: Long Text Handling

## Description
Verifies that creating a note with a very long title (200+ characters) and very long body (10000+ characters) does not cause UI overflow, handles text truncation where appropriate, and persists data correctly.

## Preconditions
- App is running at localhost
- A campaign and session exist
- sequential: true

## Steps
1. Navigate to `/session`, ensure an active campaign and session.
2. Use `browser_evaluate` to create a note with extremely long content:
   ```js
   const { db } = await import('/src/storage/db/client');
   const campaigns = await db.campaigns.toArray();
   const campaignId = campaigns[0].id;
   const longTitle = 'A'.repeat(250) + ' -- End of Title';
   const longBodyText = 'Lorem ipsum dolor sit amet. '.repeat(500); // ~14000 chars
   const noteId = crypto.randomUUID();
   await db.notes.put({
     id: noteId,
     campaignId,
     title: longTitle,
     body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: longBodyText }] }] },
     type: 'generic',
     status: 'active',
     pinned: false,
     tags: ['long-test'],
     schemaVersion: 1,
     createdAt: new Date().toISOString(),
     updatedAt: new Date().toISOString(),
   });
   return noteId;
   ```
3. Navigate to `/notes`.
4. Take a snapshot of the notes list.
5. Verify the long title is truncated or wrapped in the list view (no horizontal overflow or layout breakage).
6. Check that the note list item does not extend beyond the viewport width.
7. Open the note by tapping on it.
8. Take a snapshot of the note editor/viewer.
9. Verify the full title is displayed or editable in the detail view.
10. Verify the full body text is present (scroll down if needed).
11. Use `browser_evaluate` to verify the data persisted correctly:
    ```js
    const { db } = await import('/src/storage/db/client');
    const note = await db.notes.get('<noteId>');
    return JSON.stringify({ titleLength: note.title.length, bodyContentLength: JSON.stringify(note.body).length });
    ```
12. Verify titleLength is 256 (250 A's + " -- End of Title") and body content is preserved.
13. Check `browser_console_messages` for rendering errors or React warnings.
14. Navigate back to the notes list and verify no layout issues persist.

## Expected Results
- Long titles are truncated with ellipsis in list views but fully accessible in the editor.
- Long body text renders without layout breakage (scrollable).
- Full data persists correctly in IndexedDB with no truncation.
- No horizontal overflow or broken CSS layouts.
- No console errors or React rendering warnings.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** List truncates title gracefully; editor shows full content; data persists completely; no layout overflow.
- **Fail:** Layout breaks, text overflows viewport, data truncated in DB, or rendering errors.
