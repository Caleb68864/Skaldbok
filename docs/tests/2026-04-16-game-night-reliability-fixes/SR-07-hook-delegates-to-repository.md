---
scenario_id: "SR-07"
title: "useSessionEncounter.reopenEncounter delegates to repository helper"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - hook
sequential: false
---

# Scenario SR-07: useSessionEncounter Delegates Reopen to Repository

## Description

Verifies R7. After SS-4 refactor, the hook's reopen function is a thin wrapper — the atomic transaction logic lives in the repository. This scenario confirms the hook behavior still works end-to-end from the UI (the SessionBar "Reopen" button should call the repository helper and refresh state).

## Preconditions

- Preview server up.
- Active session with a recently-ended encounter visible in the `SessionBar` "recently ended" list.

## Steps

1. Navigate to `/session` on an active session with an ended encounter.
2. Locate the SessionBar at the top/bottom of the screen (shows recent ended encounters with a Reopen button).
3. Click Reopen on the ended encounter.
4. Observe:
   - The previously-active encounter (if any) closes gracefully.
   - The clicked encounter flips to active.
   - `refresh()` fires — the UI re-renders with the new active state.
5. Inspect DB:
   ```js
   // The clicked encounter.status === 'active', segments has a fresh open segment at tail.
   ```

## Expected Results

- No error toasts.
- UI updates (active encounter pill changes).
- Exactly one active encounter on the session post-click.
- No console errors from the hook or repository.

## Execution Tool

playwright — via session_smoke.cjs-style runner.

## Pass / Fail Criteria

- **Pass:** Reopen click lands, UI updates, DB state is atomic.
- **Fail:** Error toast, UI shows stale state, or DB has two active encounters (non-atomic regression).
