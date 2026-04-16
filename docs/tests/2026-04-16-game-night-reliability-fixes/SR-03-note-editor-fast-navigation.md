---
scenario_id: "SR-03"
title: "NoteEditor pendingUpdatesRef persists edits on fast navigation"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - screen
  - critical
sequential: false
---

# Scenario SR-03: NoteEditor Persists Edits on Fast Navigation

## Description

Verifies R3 — the most critical regression from the red-team pass. The NoteEditor previously lost edits on any navigation within 800ms because its unmount cleanup only cleared the timer and never fired a save. After SS-3, `pendingUpdatesRef` holds the merged latest state and both the debounce AND the unmount cleanup replay it via `updateNote`.

## Preconditions

- Preview server up.
- Active campaign and session exist. Seed via `evaluate` if needed.
- At least one existing note in the active session.

## Steps

1. Navigate to the session screen: `https://localhost:4173/session`.
2. Click into an existing note to open it in the editor (route becomes `/note/:id/edit`).
3. Record the current title via `page.inputValue('input[type="text"]')`.
4. Type a new title with a distinctive marker, e.g., `"SR-03 fast-nav " + Date.now()`. Use `page.fill()` or per-keystroke `type()`.
5. **Within 100ms** of the last keystroke (well under the 800ms debounce), click the Back button (`button` with text "Back" in the editor header).
6. Reload the page fully.
7. Navigate back to the same note's editor.
8. Read the title field.

## Expected Results

- The title field after reload matches the distinctive marker typed at step 4.
- No console errors from `NoteEditorScreen` in the network/console log.
- The note's `updatedAt` in IndexedDB is newer than before the edit.

## Execution Tool

playwright — existing session_smoke.cjs demonstrates the DB-seeding + page-interaction pattern to copy.

## Pass / Fail Criteria

- **Pass:** Reloaded title matches the marker. The pending edit persisted despite navigation faster than the debounce.
- **Fail:** Reloaded title is the pre-edit value. This means the unmount flush did not fire — the R3 fix regressed.
