---
scenario_id: "SR-06"
title: "Tiptap parser extracts wikilinks and mentions"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - unit
  - ss-03
---

# Scenario SR-06: Tiptap parser extracts wikilinks and mentions

## Description
Verifies that the extractLinksFromTiptapJSON utility correctly identifies wikiLink, mention, and descriptorMention nodes from a Tiptap JSON document and returns them in separate arrays.

## Preconditions
- App is built and running at https://localhost:4173
- The extractLinksFromTiptapJSON function is accessible in the app bundle (either exported on window or importable)

## Steps

1. Use `browser_navigate` to open https://localhost:4173
2. Use `browser_evaluate` to call the parser with sample Tiptap JSON:
   ```js
   // Access the parser — adjust path based on how it's exposed
   const { extractLinksFromTiptapJSON } = await import('/src/features/knowledge-base/utils/tiptap-parser.ts');
   
   const sampleDoc = {
     type: 'doc',
     content: [
       {
         type: 'paragraph',
         content: [
           { type: 'text', text: 'Spoke with ' },
           { type: 'mention', attrs: { id: 'npc-1', label: 'Aldric' } },
           { type: 'text', text: ' about ' },
           { type: 'wikiLink', attrs: { target: 'The Lost Temple', label: 'The Lost Temple' } },
           { type: 'text', text: '. The ' },
           { type: 'descriptorMention', attrs: { id: 'item-1', label: 'Sword of Dawn', category: 'loot' } },
           { type: 'text', text: ' was discussed.' }
         ]
       }
     ]
   };
   
   const result = extractLinksFromTiptapJSON(sampleDoc);
   return JSON.stringify(result);
   ```
3. If the direct import does not work, use `browser_evaluate` to manually walk the Tiptap JSON tree:
   ```js
   function extractLinks(doc) {
     const wikiLinks = [], mentions = [], descriptorMentions = [];
     function walk(node) {
       if (node.type === 'wikiLink') wikiLinks.push(node.attrs);
       if (node.type === 'mention') mentions.push(node.attrs);
       if (node.type === 'descriptorMention') descriptorMentions.push(node.attrs);
       if (node.content) node.content.forEach(walk);
     }
     walk(doc);
     return { wikiLinks, mentions, descriptorMentions };
   }
   // Run with the sampleDoc from above
   ```
4. Verify the result contains:
   - wikiLinks array with one entry (target: 'The Lost Temple')
   - mentions array with one entry (id: 'npc-1', label: 'Aldric')
   - descriptorMentions array with one entry (id: 'item-1', label: 'Sword of Dawn')

## Expected Results
- wikiLinks array has exactly 1 item with target = 'The Lost Temple'
- mentions array has exactly 1 item with label = 'Aldric'
- descriptorMentions array has exactly 1 item with label = 'Sword of Dawn'
- No errors thrown during extraction

## Execution Tool
playwright — Use browser_evaluate to run parser logic in the app's JavaScript context

## Pass / Fail Criteria
- **Pass:** All three arrays are populated with the correct entries from the sample document
- **Fail:** Any array is empty, contains wrong entries, or the function throws an error
