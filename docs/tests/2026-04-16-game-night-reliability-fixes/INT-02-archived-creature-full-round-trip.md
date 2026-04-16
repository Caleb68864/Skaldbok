---
scenario_id: "INT-02"
title: "Full archived-creature soft-delete round-trip (migration → trash → restore)"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - integration
sequential: true
---

# Scenario INT-02: Full Archived-Creature Round-Trip

## Description

Integration scenario crossing SS-5 (cascade helper), SS-9 (v9 migration), SS-10 (bestiary soft-delete + archive removal), SS-11 (TrashScreen). End-to-end: a legacy `status='archived'` creature with `represents` edges is migrated to soft-deleted on first v9 open, appears in the TrashScreen, and can be restored. After restore, the creature reappears in BestiaryScreen and the previously-cascaded edges are back.

**SEQUENTIAL** — triggers a one-way Dexie version bump. Run in fresh IndexedDB context.

## Preconditions

- Fresh browser context (incognito or cleared IndexedDB).
- Skaldbok-db seeded at v8 with:
  - Active campaign.
  - One creatureTemplate with `status: 'archived'`, no `deletedAt` (legacy).
  - Two `represents` entity links pointing at that creature (encounterParticipant → creature).

## Steps

1. Open the app at `https://localhost:4173/` — this triggers v9 migration.
2. Wait for hydration.
3. Navigate to `/bestiary`.
4. Observe: the migrated creature does NOT appear in the main bestiary list (it's now soft-deleted).
5. Click "View Trash" in the header.
6. Observe:
   - URL is `/bestiary/trash`.
   - The migrated creature is listed.
   - "Deleted" timestamp matches the migration time (within a few seconds of app load).
7. Click Restore on that row.
8. Observe: row disappears from Trash.
9. Navigate back to `/bestiary`.
10. Observe: the creature is now in the main list.
11. Inspect DB to confirm the cascade round-trip:
    ```js
    // creature row: deletedAt === null, softDeletedBy === null.
    // Both entity links that had the shared migration softDeletedBy: deletedAt === null again.
    ```
12. Inspect metadata to confirm the pre-migration snapshot is still present (retention policy):
    ```js
    // metadata table has one row with key 'bestiary-pre-v9-snapshot'.
    ```

## Expected Results

- Migration runs cleanly on first load.
- Creature visible in Trash with accurate "Deleted at" timestamp.
- Restore round-trip works: creature back in Bestiary, cascaded edges back to non-deleted.
- Snapshot survives restore (retained for recovery, per spec).

## Execution Tool

playwright — direct v8 seeding + page navigation + DB inspection.

## Pass / Fail Criteria

- **Pass:** Full round-trip succeeds. All three DB observations hold (creature restored, edges restored, snapshot retained).
- **Fail:** Migration skips the archived creature, OR Trash doesn't list it, OR Restore doesn't cascade edges, OR snapshot is missing post-restore.
