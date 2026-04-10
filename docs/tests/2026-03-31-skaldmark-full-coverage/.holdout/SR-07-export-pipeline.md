---
scenario_id: "SR-07"
title: "Export Pipeline with Attachments"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-07: Export Pipeline with Attachments

## Description
Verifies that exporting a note with attachments produces a zip file containing the markdown, binary image files in an attachments/ folder, and sidecar .md metadata files. Exporting a note without attachments produces a plain markdown file.

## Preconditions
- App is running at localhost
- A campaign and session exist
- sequential: true

## Steps
1. Navigate to `/session`, ensure an active campaign and session.
2. Navigate to `/notes`.

**Export without attachments:**
3. Create a note "Plain Export Test" with body text "No images here" and no attachments.
4. Use `browser_evaluate` to call the export function directly and capture the output:
   ```js
   const { getNotesByCampaign } = await import('/src/storage/repositories/noteRepository');
   const { getAttachmentsByNote } = await import('/src/storage/repositories/attachmentRepository');
   const { renderNoteToMarkdown } = await import('/src/utils/export/renderNote');
   const { getLinksFrom } = await import('/src/storage/repositories/entityLinkRepository');
   const notes = await getNotesByCampaign('<campaignId>');
   const note = notes.find(n => n.title === 'Plain Export Test');
   const links = await getLinksFrom(note.id, 'introduced_in');
   const atts = await getAttachmentsByNote(note.id);
   const md = renderNoteToMarkdown(note, links, notes, atts.map(a => a.filename));
   return JSON.stringify({ attachmentCount: atts.length, markdownLength: md.length, hasYamlFrontmatter: md.startsWith('---') });
   ```
5. Verify attachmentCount is 0 and markdown is a valid string with YAML frontmatter.

**Export with attachments:**
6. Create a note "Image Export Test" with body text "Has images".
7. Use `browser_evaluate` to add two test attachments to this note:
   ```js
   const { createAttachment } = await import('/src/storage/repositories/attachmentRepository');
   const { db } = await import('/src/storage/db/client');
   const notes = await db.notes.toArray();
   const note = notes.find(n => n.title === 'Image Export Test');
   await createAttachment({ noteId: note.id, campaignId: note.campaignId, filename: 'battle-map.jpg', mimeType: 'image/jpeg', sizeBytes: 5000, blob: new Blob(['fake-jpg-data'], { type: 'image/jpeg' }), caption: 'Battle map' });
   await createAttachment({ noteId: note.id, campaignId: note.campaignId, filename: 'npc-portrait.jpg', mimeType: 'image/jpeg', sizeBytes: 3000, blob: new Blob(['fake-jpg-data-2'], { type: 'image/jpeg' }), caption: 'NPC portrait' });
   return 'ok';
   ```
8. Use `browser_evaluate` to simulate the zip export and inspect contents:
   ```js
   const { getNotesByCampaign } = await import('/src/storage/repositories/noteRepository');
   const { getAttachmentsByNote } = await import('/src/storage/repositories/attachmentRepository');
   const { renderNoteToMarkdown } = await import('/src/utils/export/renderNote');
   const { renderAttachmentSidecar } = await import('/src/utils/export/renderAttachmentSidecar');
   const { getLinksFrom } = await import('/src/storage/repositories/entityLinkRepository');
   const { bundleToZip } = await import('/src/utils/export/bundleToZip');
   const notes = await getNotesByCampaign('<campaignId>');
   const note = notes.find(n => n.title === 'Image Export Test');
   const links = await getLinksFrom(note.id, 'introduced_in');
   const atts = await getAttachmentsByNote(note.id);
   const md = renderNoteToMarkdown(note, links, notes, atts.map(a => a.filename));
   const filesMap = new Map();
   filesMap.set('Image-Export-Test.md', md);
   for (const att of atts) {
     filesMap.set('attachments/' + att.filename, att.blob);
     filesMap.set('attachments/' + att.filename.replace('.jpg', '.md'), renderAttachmentSidecar(att, note));
   }
   const zipBlob = await bundleToZip(filesMap);
   return JSON.stringify({ zipSize: zipBlob.size, fileCount: filesMap.size, files: Array.from(filesMap.keys()) });
   ```
9. Verify the zip contains: 1 markdown file, 2 image blobs in attachments/, 2 sidecar .md files in attachments/.
10. Verify sidecar files have metadata (caption, noteId, filename).

## Expected Results
- Note without attachments exports as plain markdown (no zip).
- Note with attachments exports as zip containing markdown + attachments/ folder.
- Each attachment has a binary file and a sidecar .md metadata file.
- Sidecar metadata includes caption, filename, and note reference.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Plain export produces markdown only; attachment export produces zip with correct structure (5 files: 1 md + 2 images + 2 sidecars).
- **Fail:** Wrong file count, missing attachments folder, missing sidecars, or zip generation fails.
