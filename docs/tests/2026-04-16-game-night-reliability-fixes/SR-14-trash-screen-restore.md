---
scenario_id: "SR-14"
title: "TrashScreen at /bestiary/trash lists deleted, Restore round-trip"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - screen
sequential: false
---

# Scenario SR-14: TrashScreen Restore Round-Trip

## Description

Verifies R14. The TrashScreen lists soft-deleted creature templates (via `creatureTemplateRepository.getDeleted()`) and offers Restore per row. Clicking Restore clears `deletedAt` + `softDeletedBy` on the row and cascade-restores every edge sharing the same `softDeletedBy` (via `restoreLinksForTxId`).

## Preconditions

- Preview server up.
- Campaign with a creature that's been soft-deleted via BestiaryScreen's "Delete" action (cascade-soft-deleted any `represents` edges under a shared txId).

## Steps

1. Confirm the deleted creature is gone from the main Bestiary list.
2. Navigate to `/bestiary/trash`.
3. Observe:
   - Loading indicator appears briefly (if `getDeleted` hasn't resolved yet).
   - Deleted creature listed with name, category, "Deleted <timestamp>" subtitle.
   - Restore button present per row.
4. Click Restore.
5. Observe: row disappears from TrashScreen list. If it was the only one, the empty-state "Nothing deleted. Deleted creatures show up here with a Restore button." renders.
6. Navigate back to `/bestiary`.
7. Observe: the restored creature appears in the main list again.
8. Inspect DB:
   ```js
   // creature row: deletedAt === null / undefined, softDeletedBy === null / undefined.
   // All entity links that shared the creature's softDeletedBy txId: deletedAt === null.
   ```

## Expected Results

- TrashScreen lists the deleted creature.
- Empty-state copy is "Nothing deleted…" when the list is empty.
- Loading-state copy is "Loading deleted creatures…" on initial render.
- Restore removes the row from Trash AND restores it to Bestiary.
- Cascade restore brings back previously-deleted `represents` edges atomically.

## Execution Tool

playwright — standard navigation + click + DB inspection.

## Pass / Fail Criteria

- **Pass:** Creature visible in Trash, Restore click returns it to Bestiary, DB shows cleared `deletedAt` on both the creature and its cascaded edges.
- **Fail:** Creature missing from Trash (`getDeleted` broken), Restore doesn't clear deletedAt, or edges stay deleted after restore (cascade broken).
