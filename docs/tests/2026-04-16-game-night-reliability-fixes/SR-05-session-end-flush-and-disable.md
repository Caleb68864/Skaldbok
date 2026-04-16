---
scenario_id: "SR-05"
title: "SessionScreen.confirmEndSession awaits flushAll + disables button"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - screen
  - critical
sequential: false
---

# Scenario SR-05: End Session Awaits Flush + Disables Button

## Description

Verifies R5. `SessionScreen.confirmEndSession` awaits `flushAll()` before mutating session state. During the await the End Session button is visually disabled with "Saving…" so double-clicks don't trigger two end-session attempts. If any flush rejects, the operation aborts, surfaces an error toast, and leaves the session active.

## Preconditions

- Preview server up.
- Active session. Active character with a pending debounced note or profile edit.

## Steps

1. Navigate to `/session`.
2. Edit a session note's title quickly (keep the 800ms debounce pending).
3. Click the End Session button (opens `EndSessionModal`).
4. Click Confirm in the modal.
5. Observe the Confirm button between click and completion:
   - It should display "Saving…" text.
   - The `disabled` attribute should be present.
   - The surrounding backdrop should NOT close the modal on click (busy mode).
6. Wait for End Session to complete.
7. Reload the page.
8. Confirm the note's title reflects the edit (flush landed).
9. Confirm the session is now ended (visible in the past-sessions list).

## Expected Results

- Confirm button shows "Saving…" during flush.
- Confirm button is disabled while flush is in-flight.
- After completion, session is ended.
- Note title persists post-reload.
- No "Saving failed" toast.

## Execution Tool

playwright — via session_smoke.cjs-style runner.

## Pass / Fail Criteria

- **Pass:** "Saving…" label observed during flush, button disabled during flush, session ends, note persists.
- **Fail:** Button not disabled (double-click risk), OR note edit lost after reload, OR "Saving failed" toast appears without a simulated flush failure.
