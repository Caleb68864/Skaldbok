---
scenario_id: "SR-10"
title: "Stale-session modal re-prompts on route change, honors Continue"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - context
sequential: false
---

# Scenario SR-10: Stale-Session Route-Change Re-Check

## Description

Verifies R10. A session older than 24 hours should trigger `StaleSessionModal` every time the user navigates between routes. After Continue is clicked, the modal remembers the session id and does NOT re-prompt for that session — unless the session changes (new session earns a fresh warning).

## Preconditions

- Preview server up.
- Active session with `startedAt` set more than 24 hours in the past (seed via `evaluate` — e.g., `startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()`).

## Steps

1. Navigate to `https://localhost:4173/session` (triggers hydration).
2. Wait for the stale session modal to appear ("Stale Session" heading, "End It" / "Continue" buttons).
3. **Without dismissing**, navigate to `/library` via click or direct URL change.
4. Observe: the modal reappears on the library route.
5. Navigate back to `/session`.
6. Observe: modal appears again.
7. Click Continue.
8. Navigate to `/library` → `/kb` → `/session` in sequence.
9. Observe: modal does NOT reappear for the same session.
10. End the stale session via End Session. Start a new session. Set ITS `startedAt` to >24h ago. Navigate across routes.
11. Observe: the new session earns a fresh warning.

## Expected Results

- Steps 2, 4, 6: modal appears each time (route-change-driven check).
- Step 9: modal does NOT appear (dismissed-id ref suppresses re-prompt).
- Step 11: modal appears for the new session (different id = fresh warning).

## Execution Tool

playwright — direct Dexie seeding + page navigation.

## Pass / Fail Criteria

- **Pass:** Modal re-prompts until Continue, stays suppressed after Continue for the same session, re-prompts for a different stale session.
- **Fail:** Modal fails to re-prompt after a route change (hydration-only check regressed), OR continues to prompt after Continue for the same session.
