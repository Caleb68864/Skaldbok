---
type: phase-spec
sub_spec: 2
title: "Dexie v8 Schema Migration"
master_spec: "docs/specs/2026-04-10-encounter-notes-folder-unification.md"
dependencies: [1]
wave: 2
---

# Sub-Spec 2 — Dexie v8 Schema Migration

## Scope

Declare Dexie version 8 in `src/storage/db/client.ts`. Write a pre-migration JSON backup before any destructive schema change. Migrate existing `Encounter` rows from scalar `startedAt`/`endedAt` to a `segments` array. Remove `linkedCreatureId` / `linkedCharacterId` from existing participant rows and convert them to `represents` entity links. Add index declarations for the new `deletedAt` columns where useful.

## Context

- The current Dexie client is at `src/storage/db/client.ts`. Current max version is **7**.
- The existing version declarations use the pattern `this.version(N).stores({...}).upgrade(async (tx) => {...})`.
- `.gitignore` should exclude `tmp-backup/` — verify and add if missing.
- User has confirmed that old `type: 'combat'` notes can be deleted — no data preservation required for them. (The backup still captures them for safety.)
- Sub-Spec 1 already added `deletedAt` / `softDeletedBy` to every Zod schema; this sub-spec is where the Dexie schema catches up.

## Implementation Steps

### Step 1 — Audit current `client.ts` structure

Read `src/storage/db/client.ts` fully. Note:
- The current version 7 declaration.
- All table names and their current index strings.
- The existing upgrade function pattern.

The new version 8 declaration must include every existing table plus any new index additions.

### Step 2 — Add `tmp-backup/` to `.gitignore`

Check `.gitignore`:

```bash
grep -q "tmp-backup" .gitignore || echo "tmp-backup/" >> .gitignore
```

Or use the Edit tool to add the line if missing.

### Step 3 — Create the backup helper

**File:** `src/storage/db/migrations/pre-encounter-rework-backup.ts` (new)

```ts
import type { Transaction } from 'dexie';

/**
 * Write a full JSON dump of all domain tables to tmp-backup/
 * before the v8 destructive migration runs.
 *
 * Throws if the write fails, which will abort the containing
 * Dexie upgrade transaction and leave the database at v7.
 */
export async function writePreEncounterReworkBackup(tx: Transaction): Promise<void> {
  const tables = [
    'encounters',
    'notes',
    'entityLinks',
    'creatureTemplates',
    'characters',
    'sessions',
    'campaigns',
    'parties',
    'partyMembers',
  ] as const;

  const backup: Record<string, unknown[]> = {};
  for (const name of tables) {
    try {
      backup[name] = await tx.table(name).toArray();
    } catch (e) {
      // Table may not exist in older schemas; skip silently but log
      console.warn(`writePreEncounterReworkBackup: table ${name} not found, skipping`, e);
      backup[name] = [];
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = `pre-encounter-rework-${date}.json`;

  // Browser environment — IndexedDB migrations run in the browser, not Node.
  // Write to a File System Access API handle OR fall back to a Blob download trigger.
  // For Skaldbok (a local single-user Dexie app), the simplest reliable path is:
  //   - Serialize to JSON string
  //   - Write to localStorage under a known key so the user/dev can extract it
  //   - OR trigger a browser download via a Blob + anchor click
  //
  // Decision: use localStorage under key `forge:backup:${filename}`.
  // The dev can extract it via DevTools. A future restore UI can offer it as a download.

  const json = JSON.stringify(backup, null, 2);
  const storageKey = `forge:backup:${filename}`;

  try {
    localStorage.setItem(storageKey, json);
  } catch (e) {
    throw new Error(
      `Pre-migration backup failed to write to localStorage (${storageKey}). ` +
        `Aborting migration to preserve v7 data. Error: ${e}`,
    );
  }

  console.info(`Pre-migration backup written to localStorage key: ${storageKey}`);
}
```

> **Note on the backup target:** The master spec says "tmp-backup/pre-encounter-rework-{date}.json". Since Skaldbok runs entirely in the browser (Vite + IndexedDB), there's no filesystem write available from a Dexie upgrade callback. Using `localStorage` under a prefixed key is the reliable in-browser equivalent. The storage key pattern `forge:backup:pre-encounter-rework-{YYYY-MM-DD}.json` preserves the naming from the spec while respecting the runtime constraint. If the user wants file-based backup later, they can surface a download UI that reads the localStorage key and offers a Blob download. **This is a justified deviation from the spec's wording — log it in the commit message.**

Verify: `npm run build` exits zero.

### Step 4 — Declare Dexie version 8

In `src/storage/db/client.ts`, after the existing `this.version(7).stores(...)` block, add:

```ts
import { writePreEncounterReworkBackup } from './migrations/pre-encounter-rework-backup';

// ... inside the SkaldbokDatabase constructor ...

// --- Version 8: Encounter notes-folder unification + soft deletes ---
this.version(8)
  .stores({
    // keep every existing table from v7, adding deletedAt index where useful
    sessions: '++id, campaignId, status, deletedAt',
    encounters: '++id, sessionId, campaignId, status, deletedAt',
    notes: '++id, sessionId, campaignId, type, status, deletedAt',
    entityLinks:
      '++id, [fromEntityId+relationshipType], [toEntityId+relationshipType], fromEntityId, toEntityId, deletedAt',
    creatureTemplates: '++id, campaignId, category, status, deletedAt',
    characters: '++id, campaignId, deletedAt',
    campaigns: '++id, deletedAt',
    parties: '++id, campaignId, deletedAt',
    partyMembers: '++id, partyId, characterId, deletedAt',
    // ...include every other v7 table here unchanged, just appending `, deletedAt` if useful
  })
  .upgrade(async (tx) => {
    // 1. Backup first. Throws on failure, which aborts the transaction.
    await writePreEncounterReworkBackup(tx);

    // 2. Migrate Encounter rows: scalar startedAt/endedAt -> segments array
    const encountersTable = tx.table('encounters');
    const allEncounters = await encountersTable.toArray();
    for (const enc of allEncounters) {
      const segments: Array<{ startedAt: string; endedAt?: string }> = [];
      if (enc.startedAt) {
        const segment: { startedAt: string; endedAt?: string } = {
          startedAt: enc.startedAt,
        };
        if (enc.endedAt) segment.endedAt = enc.endedAt;
        segments.push(segment);
      }
      await encountersTable.update(enc.id, {
        segments,
        // initialize new narrative fields to undefined explicitly
        description: undefined,
        body: undefined,
        summary: undefined,
        tags: enc.tags ?? [],
        location: enc.location,
        // clean up the old scalar fields
        startedAt: undefined,
        endedAt: undefined,
      });
    }

    // 3. Migrate EncounterParticipant: convert linkedCreatureId / linkedCharacterId to represents edges
    const entityLinksTable = tx.table('entityLinks');
    const migratedEncounters = await encountersTable.toArray();
    for (const enc of migratedEncounters) {
      if (!enc.participants || !Array.isArray(enc.participants)) continue;
      for (const participant of enc.participants) {
        if (participant.linkedCreatureId) {
          await entityLinksTable.add({
            id: crypto.randomUUID(),
            fromEntityId: participant.id,
            fromEntityType: 'encounterParticipant',
            toEntityId: participant.linkedCreatureId,
            toEntityType: 'creature',
            relationshipType: 'represents',
            schemaVersion: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          delete participant.linkedCreatureId;
        }
        if (participant.linkedCharacterId) {
          await entityLinksTable.add({
            id: crypto.randomUUID(),
            fromEntityId: participant.id,
            fromEntityType: 'encounterParticipant',
            toEntityId: participant.linkedCharacterId,
            toEntityType: 'character',
            relationshipType: 'represents',
            schemaVersion: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          delete participant.linkedCharacterId;
        }
      }
      await encountersTable.update(enc.id, { participants: enc.participants });
    }

    // 4. Delete old type: 'combat' notes (user explicit decision, documented in design doc)
    const notesTable = tx.table('notes');
    await notesTable.where('type').equals('combat').delete();

    // 5. deletedAt and softDeletedBy are added automatically by the stores()
    //    declaration above as new indexable fields. Existing rows will have them
    //    as undefined, which is the desired default.
  });
```

**Caveat — use `crypto.randomUUID()` only if available.** If it's not in the runtime (older browsers), import `generateId` from `src/utils/ids` instead. The pattern: `await import('../../utils/ids').then(m => m.generateId())` inside the upgrade function (upgrade callbacks are inside Dexie's own IIFE, so top-level imports should work fine — verify the existing pattern in the file).

Verify: `npm run build` exits zero.

### Step 5 — Size check: if the upgrade function exceeds ~80 lines, split

The combined upgrade function above is roughly 60-70 lines. If after adjustments it grows beyond 80, split into:

- **Version 8:** add `deletedAt` / `softDeletedBy` columns and indexes only. No data migration.
- **Version 9:** backup + encounter restructure + participant migration + note deletion.

Both versions can land in the same commit. The decision is a readability tradeoff, not a correctness one.

### Step 6 — Test the migration against a seeded dev database

This is the most fragile step and requires manual verification because there's no test framework.

1. Start the dev app: `npm run dev`
2. Open browser DevTools → Application → IndexedDB
3. Note the current DB version (should be 7 before the code change lands, 8 after)
4. If possible, seed a few encounters with the old `startedAt` / `endedAt` fields using DevTools or an existing seed script
5. Reload the app with the new code
6. Verify in DevTools:
   - The DB version is now 8
   - Every existing encounter has a `segments` array
   - Every participant's `linkedCreatureId` / `linkedCharacterId` is gone
   - `entityLinks` table has new `represents` edges
   - `localStorage` has the `forge:backup:pre-encounter-rework-YYYY-MM-DD.json` key
   - Every table has `deletedAt` as an index

If any of these fail, do NOT proceed to Sub-Spec 3. Fix the migration first.

### Step 7 — Run build and lint

```bash
npm run build
npm run lint
```

Both must exit zero.

### Step 8 — Commit

```
feat(storage): Dexie v8 migration for encounter rework + soft deletes

- Add version 8 declaration in client.ts
- Migrate Encounter.startedAt/endedAt scalars to segments[] array
- Convert EncounterParticipant.linkedCreatureId/linkedCharacterId to
  represents entity links
- Delete old type:'combat' notes (per design decision, data pre-confirmed)
- Pre-migration backup via localStorage (in-browser equivalent to
  the spec's tmp-backup/ path; browser Dexie upgrades run in-process
  with no filesystem access). Backup aborts migration on write failure.
- Add deletedAt index on every domain table

Foundation for sub-specs 3-9.
```

## Interface Contracts

### Dexie schema version 8
- Direction: Sub-Spec 2 → Sub-Spec 3 (and all later)
- Owner: Sub-Spec 2
- Shape: `this.version(8).stores({...}).upgrade(async (tx) => {...})` in `src/storage/db/client.ts`
- Consumers read from tables assuming v8 shape: `Encounter.segments[]`, no `linkedCreatureId`/`linkedCharacterId` on participants, `deletedAt` indexable on every table.

### Pre-migration backup behavior
- Direction: Sub-Spec 2 → N/A (safety rail only)
- Owner: Sub-Spec 2
- Shape: `writePreEncounterReworkBackup(tx: Transaction): Promise<void>`
- Side effect: writes JSON to `localStorage[forge:backup:pre-encounter-rework-{date}.json]`. Throws on failure, aborting the containing upgrade transaction.

## Verification Commands

### Build and lint
```bash
npm run build
npm run lint
```

### Mechanical checks
```bash
# Version 8 is declared
grep -n "version(8)" src/storage/db/client.ts || (echo "FAIL: version(8) not declared" && exit 1)

# Backup helper exists
test -f src/storage/db/migrations/pre-encounter-rework-backup.ts || (echo "FAIL: backup helper not found" && exit 1)

# Backup helper is imported
grep -q "writePreEncounterReworkBackup" src/storage/db/client.ts || (echo "FAIL: backup helper not imported into client" && exit 1)

# .gitignore excludes tmp-backup
grep -q "tmp-backup" .gitignore || (echo "FAIL: .gitignore missing tmp-backup entry" && exit 1)

# segments field referenced in upgrade
grep -q "segments" src/storage/db/client.ts || (echo "FAIL: segments not referenced in client.ts" && exit 1)

# represents edge type referenced in upgrade
grep -q "'represents'" src/storage/db/client.ts || (echo "FAIL: represents edge type not in upgrade" && exit 1)
```

### Behavioral checks (manual, in dev app)

See Step 6. The key checks:
- `indexedDB.open('skaldbok').result.version === 8` (via DevTools console)
- Every encounter has `segments` array
- No participant has `linkedCreatureId`
- `localStorage.getItem('forge:backup:pre-encounter-rework-YYYY-MM-DD.json')` returns non-null JSON
- App loads without console errors

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| `version(8)` declared in client.ts | [MECHANICAL] | `grep -n "version(8)" src/storage/db/client.ts \|\| (echo "FAIL: version 8 not declared" && exit 1)` |
| Upgrade handler is present | [STRUCTURAL] | `grep -A 2 "version(8)" src/storage/db/client.ts \| grep -q "upgrade" \|\| (echo "FAIL: version 8 upgrade handler missing" && exit 1)` |
| Backup helper file exists | [STRUCTURAL] | `test -f src/storage/db/migrations/pre-encounter-rework-backup.ts \|\| (echo "FAIL: backup helper not found" && exit 1)` |
| Backup helper imported | [STRUCTURAL] | `grep -q "writePreEncounterReworkBackup" src/storage/db/client.ts \|\| (echo "FAIL: backup helper not imported" && exit 1)` |
| tmp-backup in .gitignore | [MECHANICAL] | `grep -q "tmp-backup" .gitignore \|\| (echo "FAIL: .gitignore missing tmp-backup" && exit 1)` |
| segments field handled in upgrade | [STRUCTURAL] | `grep -q "segments" src/storage/db/client.ts \|\| (echo "FAIL: segments not in client" && exit 1)` |
| `'represents'` relationship referenced in upgrade | [STRUCTURAL] | `grep -q "'represents'" src/storage/db/client.ts \|\| (echo "FAIL: represents not in upgrade" && exit 1)` |
| Build succeeds | [MECHANICAL] | `npm run build 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
| Lint succeeds | [MECHANICAL] | `npm run lint 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: lint failed" && exit 1)` |
