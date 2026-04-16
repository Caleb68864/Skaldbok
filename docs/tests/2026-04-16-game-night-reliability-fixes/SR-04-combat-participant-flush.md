---
scenario_id: "SR-04"
title: "Combat participant in-flight update flushes on session end"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - screen
sequential: false
---

# Scenario SR-04: Combat Participant In-Flight Update Flushes on Session End

## Description

Verifies R4. `CombatEncounterView` tracks its latest in-flight participant update promise in a ref and registers a flush with the bus that awaits it. This means an HP change issued milliseconds before `End Session` still lands.

## Preconditions

- Preview server up.
- Active campaign + session + combat encounter with at least one participant. Seed via `evaluate` if needed.

## Steps

1. Navigate into the combat encounter view (from the session timeline, click into the combat encounter).
2. On a participant, decrease HP (e.g., click the minus button) to trigger `handleUpdateParticipantState`.
3. **Immediately** (within 50ms, before the await chain settles) navigate back and click End Session → Confirm.
4. Wait for the End Session flow to complete (the modal should show "Saving…" while the flush is in progress, then close).
5. After the session ends, reload the page.
6. Reopen the session (Resume from the library). Re-enter the combat encounter.
7. Read the participant's HP.

## Expected Results

- End Session completes without error.
- The participant's HP reflects the decremented value — the in-flight update landed.
- No "Saving failed" toast appears.
- Session status is `ended` in IndexedDB.

## Execution Tool

playwright — use the same session_smoke.cjs-style approach. The combat flow may need DB seeding since combat encounters aren't default seeded.

## Pass / Fail Criteria

- **Pass:** HP post-reload reflects the decrement that was in-flight at End Session time.
- **Fail:** HP reverts to the pre-decrement value (update was lost because End Session didn't await it).
