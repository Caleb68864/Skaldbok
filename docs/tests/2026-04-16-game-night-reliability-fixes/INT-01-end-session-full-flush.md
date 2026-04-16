---
scenario_id: "INT-01"
title: "End Session with pending note + character + combat update: all persist"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - integration
  - critical
sequential: true
---

# Scenario INT-01: End Session — Full Flush Integration

## Description

Integration scenario crossing SS-1 (flush bus), SS-2 (useAutosave), SS-3 (NoteEditor), SS-4 (encounter reopen), SS-6 (lifecycle consumers). This is the "don't lose data at the table" bar, end-to-end. Simulates a real game-night shutdown: the user has edits in three places simultaneously (note body, character field via Settings/Profile, combat participant HP), then clicks End Session. All three must persist.

**SEQUENTIAL** — mutates session + character + encounter state simultaneously.

## Preconditions

- Preview server up.
- Active campaign with:
  - Active session.
  - Active combat encounter with at least one participant.
  - Active character with a mutable field (e.g., HP or name).
  - At least one existing note in the session.

## Steps

1. Open the note editor for an existing note. Type a distinctive title marker (`INT-01 note-marker <timestamp>`). Do NOT wait 800ms.

2. Without navigating, use a second tab or `evaluate` to also update the character's name via Profile screen: set it to `INT-01 char-marker <timestamp>`. Do NOT wait 1000ms (the character autosave debounce).

3. Navigate into the combat encounter view. Decrement a participant's HP by one. Without waiting for the await chain to settle (50ms), trigger End Session.

4. End Session flow: click End Session → Confirm. The modal's Confirm button should read "Saving…" and be disabled during the flush.

5. Wait for End Session to complete (modal closes).

6. Reload the page fully (service-worker-blocked).

7. Assertions on post-reload state:
   a. Navigate to the (now-ended) session's notes. Find the note that was edited. Title field should contain the `note-marker` string.
   b. Reopen the session (via Resume) and enter the combat encounter view. Participant HP should reflect the decremented value.
   c. On Profile screen (via Resume or direct route), character name should contain the `char-marker` string.

## Expected Results

- None of the three in-flight edits are lost.
- The "Saving…" state was visibly shown on Confirm during flush.
- Session is ended (visible in past-sessions list).
- All three data points reflect the latest pre-End-Session edits.

## Execution Tool

playwright — the heaviest integration scenario. Requires careful timing to ensure all three edits are truly in-flight at End Session time. Use `Promise.resolve()` + microtask ordering to sequence the edits tightly.

## Pass / Fail Criteria

- **Pass:** All three markers present post-reload. Session ended.
- **Fail:** Any single marker missing (that data point was lost by the flush bus). Full end-to-end data-loss regression.
