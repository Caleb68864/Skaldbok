---
scenario_id: "SR-13"
title: "BestiaryScreen action labeled \"Delete\", \"View Trash\" link routes"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - screen
sequential: false
---

# Scenario SR-13: Bestiary UI — Delete Label + View Trash Link

## Description

Verifies R13. Phase 3 removes the Archive concept from the bestiary UI. The action on a creature's detail drawer reads "Delete" (not "Archive"), and the screen header includes a "View Trash" entry point that navigates to `/bestiary/trash`.

## Preconditions

- Preview server up.
- Active campaign with at least one creature template (not soft-deleted).

## Steps

1. Navigate to `/bestiary`.
2. Locate the screen header controls.
3. Observe: a "View Trash" button/link is present.
4. Click a creature card to open its detail drawer.
5. Observe the action buttons in the drawer:
   - "Edit" present.
   - "Delete" present (NOT "Archive").
   - No "Archive" button anywhere.
6. Go back from the drawer, return to the Bestiary header.
7. Click "View Trash".
8. Observe: URL changes to `/bestiary/trash` and the TrashScreen component renders.

## Expected Results

- Detail drawer's destructive action is labeled "Delete".
- No "Archive" label appears anywhere on BestiaryScreen.
- "View Trash" link navigates to `/bestiary/trash` successfully.
- No 404 or blank-screen catch-all redirect.

## Execution Tool

playwright — page navigation + DOM text assertions.

## Pass / Fail Criteria

- **Pass:** Drawer shows "Delete" not "Archive", "View Trash" link navigates correctly to `/bestiary/trash`.
- **Fail:** "Archive" still labeled anywhere, or "View Trash" routes elsewhere, or the route falls through to the `*` catch-all.
