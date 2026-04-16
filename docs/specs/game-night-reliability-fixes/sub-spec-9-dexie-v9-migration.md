---
type: phase-spec
master_spec: "docs/specs/2026-04-16-game-night-reliability-fixes.md"
sub_spec: 9
title: "Dexie v9 migration with pre-migration snapshot"
dependencies: []
phase: 3
---

# Sub-Spec 9: Dexie v9 Migration With Pre-Migration Snapshot

## Scope

Bump Dexie schema to version 9. Convert every `creatureTemplate` where `status === 'archived'` into a soft-deleted row (`deletedAt` + `softDeletedBy`), and cascade-soft-delete matching `represents` edges. Before any transformation, snapshot the pre-migration state of affected rows + edges to `metadata` under key `bestiary-pre-v9-snapshot`. All writes use `tx.table(...)` — repository helpers are forbidden inside upgrades.

## Files

- `src/storage/db/client.ts` (modified — append `.version(9)...upgrade(...)` block after existing version 8)

## Interface Contracts

None — migration is a one-time startup side effect. Consumers (SS-10, SS-11) read the migrated shape.

## Implementation Steps

1. **Verify current version.** Open `src/storage/db/client.ts`. Confirm line 245 still reads `this.version(8)`. If the file has advanced beyond 8 since this spec was written, halt and surface — the version number in this spec is concrete, not "next + 1". Escalate for guidance.

2. **Read the v8 upgrade pattern** at lines 245-320ish to mirror the shape (how `tx.table(...)` is used, how loops iterate, how writes are issued).

3. **Append the v9 block after v8's `.upgrade(...)` closing paren.** Template:

   ```ts
   // --- Version 9: Bestiary soft-delete migration ---
   // Converts status='archived' creatureTemplates into soft-deleted rows
   // (deletedAt + softDeletedBy). Cascades to `represents` edges under the
   // same migration txId. Writes a pre-migration snapshot to `metadata`
   // for recovery.
   this.version(9)
     .stores({
       // Shape unchanged from v8 — only data is transformed.
     })
     .upgrade(async (tx) => {
       const migrationTxId = `bestiary-v9-migration-${new Date().toISOString()}`;
       const migrationTs = new Date().toISOString();

       const creaturesTable = tx.table('creatureTemplates');
       const entityLinksTable = tx.table('entityLinks');
       const metadataTable = tx.table('metadata');

       // 1. Snapshot (wrapped in try/catch so migration proceeds even if snapshot fails)
       try {
         const allCreatures = await creaturesTable.toArray();
         const creatureIds = new Set(allCreatures.map((c: any) => c.id));
         const allLinks = await entityLinksTable.toArray();
         const relatedLinks = allLinks.filter((l: any) =>
           creatureIds.has(l.fromEntityId) || creatureIds.has(l.toEntityId)
         );
         const snapshot = { creatureTemplates: allCreatures, entityLinks: relatedLinks };
         await metadataTable.put({
           id: generateId(),
           key: 'bestiary-pre-v9-snapshot',
           value: JSON.stringify(snapshot),
         });
       } catch (e) {
         console.error('[bestiary-v9-migration] snapshot failed', e);
         // proceed without snapshot — worse than ideal, better than blocking
       }

       // 2. Transform archived rows
       // NOTE: CreatureTemplate.status is a Zod enum of exactly ['active', 'archived'].
       // The soft-delete state is carried by deletedAt, not status. Migrated rows
       // set status: 'active' so reads that safeParse the row succeed. 'archived'
       // is left as a legacy enum value for now; a future cleanup can drop it.
       const creatures = await creaturesTable.toArray();
       for (const row of creatures) {
         if (row.status === 'archived') {
           await creaturesTable.update(row.id, {
             deletedAt: migrationTs,
             softDeletedBy: migrationTxId,
             status: 'active',  // migrate off 'archived'; soft-delete carries the tombstone
             updatedAt: migrationTs,
           });
           // Cascade represents edges touching this creature
           const from = await entityLinksTable.where('fromEntityId').equals(row.id).toArray();
           const to = await entityLinksTable.where('toEntityId').equals(row.id).toArray();
           const seen = new Set<string>();
           for (const link of [...from, ...to]) {
             if (seen.has(link.id)) continue;
             seen.add(link.id);
             if (!link.deletedAt) {
               await entityLinksTable.update(link.id, {
                 deletedAt: migrationTs,
                 softDeletedBy: migrationTxId,
                 updatedAt: migrationTs,
               });
             }
           }
           console.info('[bestiary-v9-migration] migrated', row.id);
         } else if (row.status && row.status !== 'active' && row.status !== 'archived') {
           console.warn('[bestiary-v9-migration] unexpected row, skipping', row.id);
         }
       }
     });
   ```

4. **Ensure `generateId` is already imported** at the top of `client.ts` (v8 upgrade uses it). If not, add the import.

5. **Verify `metadata` table is declared in the `.stores({...})` for v9.** The v9 stores block should inherit v8's shape — explicitly list `metadata: 'id, key'` (or whatever the existing v8 stores declaration for metadata is). If the stores clause is truly unchanged, Dexie still requires all tables to be re-declared. Copy from v8 verbatim.

6. **Build check.** `npm run build` → exit 0.

7. **Smoke test the migration.** Seed a DB at v8 with one `status='archived'` creature + two `represents` edges. Reload the app (with service worker blocked so you hit fresh JS). Verify:
   - `db.verno` is now 9 (DevTools console: `indexedDB.open('Skaldbok').then(r => console.log(r.result.version))`).
   - The creature row has `deletedAt` and `softDeletedBy` set.
   - Both edges share the same `softDeletedBy` as the creature.
   - `metadata` table has a `bestiary-pre-v9-snapshot` row whose parsed value contains the creature and both edges.

8. **Idempotence check.** Reload a second time. No additional rows should change. Console should be silent (no more "migrated X" messages).

9. **Throw-recovery smoke.** Temporarily force the upgrade body to throw (e.g., `throw new Error('test')` at the top). Reload. DB should remain at v8 (`db.verno === 8`), no rows changed. Revert the throw.

10. **Commit.** Message: `feat(db): add v9 migration for bestiary soft-delete with snapshot`

## Verification Commands

```bash
npm run build

# v9 block present
grep -q "this.version(9)" src/storage/db/client.ts

# Uses tx.table only (no repository imports inside the upgrade)
grep -A80 "this.version(9)" src/storage/db/client.ts | grep -q "tx.table"
grep -A80 "this.version(9)" src/storage/db/client.ts | ! grep -q "metadataRepository\|entityLinkRepository\|creatureTemplateRepository"

# Snapshot write present
grep -A80 "this.version(9)" src/storage/db/client.ts | grep -q "bestiary-pre-v9-snapshot"

# Try/catch around snapshot
grep -A80 "this.version(9)" src/storage/db/client.ts | grep -q "snapshot failed"
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| v9 block exists | [STRUCTURAL] | `grep -q "this.version(9)" src/storage/db/client.ts \|\| (echo "FAIL: v9 not added" && exit 1)` |
| Uses tx.table (not repository helpers) | [STRUCTURAL] | `grep -A80 "this.version(9)" src/storage/db/client.ts \| grep -q "tx.table" \|\| (echo "FAIL: not using tx.table" && exit 1)` |
| No repository helpers inside v9 upgrade | [STRUCTURAL] | `grep -A80 "this.version(9)" src/storage/db/client.ts \| grep -E "metadataRepository\.\|entityLinkRepository\.\|creatureTemplateRepository\." && (echo "FAIL: repository helpers forbidden in upgrade" && exit 1) ; true` |
| Snapshot key written | [STRUCTURAL] | `grep -q "bestiary-pre-v9-snapshot" src/storage/db/client.ts \|\| (echo "FAIL: snapshot key missing" && exit 1)` |
| Snapshot wrapped in try/catch | [STRUCTURAL] | `grep -A80 "this.version(9)" src/storage/db/client.ts \| grep -q "snapshot failed" \|\| (echo "FAIL: snapshot not try/catch'd" && exit 1)` |
| Migration logs per-row id | [STRUCTURAL] | `grep -A80 "this.version(9)" src/storage/db/client.ts \| grep -q "bestiary-v9-migration.*migrated" \|\| (echo "FAIL: per-row logging missing" && exit 1)` |
| Unexpected-row warning | [STRUCTURAL] | `grep -A80 "this.version(9)" src/storage/db/client.ts \| grep -q "unexpected row, skipping" \|\| (echo "FAIL: malformed-row warning missing" && exit 1)` |
| npm run build exits zero | [MECHANICAL] | `npm run build 2>&1 \| tail -3 ; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
