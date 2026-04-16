---
scenario_id: "SR-11"
title: "Resume session shows ReopenEncounterPrompt + Undo toast closes encounter again"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - context
sequential: false
---

# Scenario SR-11: Resume Prompt + Undo Toast

## Description

Verifies R11. When a user resumes an ended session that had a prior active encounter, `CampaignContext.resumeSession` should show `ReopenEncounterPrompt` and, on Reopen, fire a 6-second toast with an Undo button. Clicking Undo calls `encounterRepository.end` to close the just-pushed segment. The Skip path (and the no-prior-encounter path) should show a "Session resumed" toast.

## Preconditions

- Preview server up.
- Campaign with an ended session that has one non-deleted encounter whose last segment has `endedAt` set. Seed via `evaluate`.

## Steps

1. Navigate to `/session` on the campaign — the "no active session" screen should show the ended session in the past-sessions list.
2. Click Resume on the ended session.
3. Observe the `ReopenEncounterPrompt` modal appears with title "Resume encounter?" and the encounter's name in the body.
4. Click Reopen (button text: `Reopen "encounter-name"`).
5. Observe:
   - A toast appears with message `Reopened "encounter-name"` and an Undo button.
   - The encounter is now active in the DB (segments array has a new open segment at the tail).
6. Click Undo on the toast within the 6s lifetime.
7. Observe:
   - The just-pushed segment is closed.
   - `encounter.status === 'ended'` again.
8. **Skip path:** repeat with a fresh ended session. This time in step 4, click Skip instead.
9. Observe:
   - Prompt closes.
   - Toast with message `Session resumed` appears.
   - No encounter is reopened.
10. **No-candidate path:** repeat with an ended session that has NO prior encounters. Click Resume.
11. Observe: no prompt shown. `Session resumed` toast appears directly.

## Expected Results

- Step 3: prompt appears with the candidate encounter.
- Step 5: Reopen toast with Undo button.
- Step 7: Undo closes the just-pushed segment; encounter ends again.
- Step 9: Skip path shows "Session resumed" toast.
- Step 11: No-candidate path shows "Session resumed" toast without any prompt.

## Execution Tool

playwright — direct Dexie seeding + page interaction.

## Pass / Fail Criteria

- **Pass:** All three paths (Reopen + Undo, Skip, no-candidate) behave exactly as specified with the right toasts.
- **Fail:** Any path fails — missing prompt, missing toast, Undo doesn't close the segment, or the wrong toast copy appears.
