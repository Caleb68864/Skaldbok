---
scenario_id: "SR-07"
title: "Wikilink input rule converts [[text]] to node"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - ui
  - ss-04
---

# Scenario SR-07: Wikilink input rule converts [[text]] to node

## Description
Verifies that typing `[[Test Note]]` in the Tiptap note editor triggers the input rule and converts the text into an inline wikilink chip node.

## Preconditions
- App is built and running at https://localhost:4173
- A campaign with at least one session exists
- User can open the note editor

## Steps

1. Use `browser_navigate` to open https://localhost:4173
2. Navigate to a session screen where notes can be created or edited
3. Use `browser_click` to open a new note or edit an existing note
4. Use `browser_snapshot` to confirm the editor is visible and focused
5. Use `browser_click` to focus the note body editor area (the Tiptap contenteditable div)
6. Use `browser_type` to type the following text: `This links to [[Test Note]] here`
7. Wait briefly for the input rule to process (use `browser_snapshot` after typing)
8. Use `browser_snapshot` to capture the editor state after the closing `]]`
9. Verify that the text "Test Note" appears as a styled chip/inline node, not as raw `[[Test Note]]` text
10. Use `browser_evaluate` to inspect the Tiptap editor's JSON content:
    ```js
    // Access the editor instance
    const editorEl = document.querySelector('.ProseMirror');
    const editor = editorEl?.pmViewDesc?.view?.state?.doc;
    // Or check for wikiLink node type in rendered DOM
    const chips = document.querySelectorAll('[data-type="wikiLink"], .wikilink-chip, [data-node-type="wikiLink"]');
    return chips.length;
    ```

## Expected Results
- After typing `[[Test Note]]`, the raw bracket syntax disappears
- A styled inline wikilink chip appears in its place showing "Test Note"
- The chip is visually distinct (e.g., background color, border, or pill styling)
- The editor's internal document model contains a wikiLink node type

## Execution Tool
playwright — Use browser_type to simulate typing, browser_snapshot to verify visual conversion

## Pass / Fail Criteria
- **Pass:** The `[[Test Note]]` text converts to a styled wikilink chip node in the editor
- **Fail:** The raw `[[Test Note]]` text remains as plain text, or no chip node appears
