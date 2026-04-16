---
scenario_id: "SR-12"
title: "Dexie v9 migration transforms archived rows + writes snapshot"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - db
  - critical
sequential: true
---

# Scenario SR-12: Dexie v9 Migration (Sequential)

## Description

Verifies R12. The v9 upgrade transforms every `creatureTemplate` with `status='archived'` into a soft-deleted row (`deletedAt` + `softDeletedBy`), moves status to `'active'` (the tombstone is `deletedAt`, not status), cascade-soft-deletes related `represents` edges, and writes a pre-migration snapshot to `metadata` under key `bestiary-pre-v9-snapshot`. All writes use `tx.table(...)` (not repository helpers). Idempotent: second open is a no-op.

**SEQUENTIAL** — this scenario forces a schema version change. Run in isolation in a fresh browser profile / incognito so `skaldbok-db` can be re-seeded at v8 between runs.

## Preconditions

- Preview server up.
- Fresh IndexedDB (incognito or cleared beforehand). The migration only runs on first open of the new version.
- Before opening the app at v9-aware code, seed the DB at v8 with:
  - One creatureTemplate with `status: 'archived'`, no `deletedAt` (legacy shape).
  - Two `represents` entity links where that creature is the `toEntityId`.
  - For control: one creatureTemplate with `status: 'active'`.

## Steps

1. Open a fresh browser context. Before navigating to the app, use `evaluate` to open IndexedDB at version 8 and seed the three rows described in preconditions.
2. Navigate to `https://localhost:4173/` to trigger the Dexie upgrade.
3. Wait for hydration.
4. Query IndexedDB to inspect post-migration state:
   ```js
   await page.evaluate(async () => {
     const db = await new Promise((resolve, reject) => {
       const req = indexedDB.open('skaldbok-db');
       req.onsuccess = () => resolve(req.result);
       req.onerror = () => reject(req.error);
     });
     const tx = db.transaction(['creatureTemplates', 'entityLinks', 'metadata'], 'readonly');
     const ct = await new Promise(r => { const req = tx.objectStore('creatureTemplates').getAll(); req.onsuccess = () => r(req.result); });
     const el = await new Promise(r => { const req = tx.objectStore('entityLinks').getAll(); req.onsuccess = () => r(req.result); });
     const md = await new Promise(r => { const req = tx.objectStore('metadata').getAll(); req.onsuccess = () => r(req.result); });
     return { version: db.version, creatures: ct, links: el, metadata: md };
   });
   ```

5. Assertions on returned data:
   - `result.version === 9`.
   - The previously-archived creature row now has `deletedAt` set, `softDeletedBy` set (string), and `status === 'active'`. The control creature is unchanged (no `deletedAt`).
   - Both `represents` edges now share the **same** `softDeletedBy` value as the migrated creature (cascade worked).
   - The `metadata` table contains exactly one row with `key === 'bestiary-pre-v9-snapshot'`. Its `value` is a JSON string that parses to an object containing both `creatureTemplates` and `entityLinks` arrays with the pre-migration row shapes.

6. **Idempotence check:** reload the page.
7. Query again. Verify no new migration log messages appear and the DB state is unchanged.

## Expected Results

- DB version is 9.
- Archived creature is now soft-deleted with cascade-matching edge `softDeletedBy`.
- Control creature is untouched.
- Snapshot row present in `metadata`.
- Second open is a no-op.
- Console output includes `[bestiary-v9-migration] migrated <id>` for the archived row.

## Execution Tool

playwright — manual seeding of IndexedDB at v8 is required before the first app load.

## Pass / Fail Criteria

- **Pass:** All assertions in step 5 hold, and idempotence check in step 7 passes.
- **Fail:** Version didn't advance, snapshot missing, edges cascade missing or use a different txId, control row touched, or second open repeats the migration.
