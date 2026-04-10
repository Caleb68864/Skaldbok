---
scenario_id: "UI-04"
title: "Session lifecycle: start, quick actions, and end"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - sequential
---

# Scenario UI-04: Session lifecycle: start, quick actions, and end

## Description
Verify the full session lifecycle on the Session Screen: starting a session, observing active state with timer and quick actions, using session quick actions (skill check, rest logging), and ending the session via confirmation modal.

## Preconditions
- A character exists and is set as active.
- An active campaign exists (created via the campaign creation flow or settings).
- No session is currently active.

## Steps
1. Navigate to `http://localhost:5173/session`.
2. Assert the campaign name heading is visible (e.g., an `<h2>` with the campaign name).
3. Assert the text "No sessions yet." is visible OR a "Last Session" recap card is visible.
4. Assert the "Start Session" button is visible.
5. Click "Start Session".
6. Assert the session card appears with a session title (auto-generated, e.g., "Session 1") inside an `<h3>` element.
7. Assert the "Started:" timestamp text is visible.
8. Assert a session timer badge is visible showing elapsed time (e.g., "0m" or "1m").
9. Assert the "End Session" button is visible.
10. Assert the "Export Session" and "Export + Notes (ZIP)" buttons are visible.
11. Assert the SessionQuickActions component is visible below the session card. Look for quick action buttons (skill check chips, rest buttons, etc.).
12. Assert the "Start Combat" button is visible.
13. Click a skill check quick action chip (e.g., one of the core skills like "AWARENESS"). Assert a drawer or interaction opens for logging the skill check result.
14. Select a result (e.g., "success") and confirm. Assert the drawer closes.
15. Click the "End Session" button.
16. Assert the EndSessionModal appears with a confirmation prompt containing the session title.
17. Click the confirm button in the end session modal (the primary action button).
18. Assert the modal closes and the session card is replaced by the "Start Session" button and a "Last Session" recap card.
19. Assert the "Last Session" recap card shows the session title and date.
20. Assert "Past Sessions" heading appears with the ended session listed.

## Expected Results
- Clicking "Start Session" transitions the UI to active session state with timer, export buttons, and quick actions.
- Quick action buttons are interactive and open drawers for logging.
- "End Session" opens a confirmation modal; confirming it ends the session and returns to the idle state.
- The ended session appears in the "Past Sessions" list.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Session starts, shows active state with timer and quick actions, skill check logging works, session ends via modal, and past session appears in history.
- **Fail:** Session fails to start, active state UI elements are missing, quick actions do not respond, end session modal does not appear, or ended session is not listed in history.
