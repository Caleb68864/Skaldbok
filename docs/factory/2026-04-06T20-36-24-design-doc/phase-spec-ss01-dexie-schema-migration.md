# Phase Spec — SS-01: Dexie v6 Schema Migration

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 0.1 — Shared Infrastructure: Dexie v6 Schema Migration
**Depends on:** SS-02 (Zod type schemas) must be completed first (types needed for migration data shapes)

---

## Objective

Bump Dexie to version 6 with a single schema migration that introduces all new tables and indexes, runs data migrations idempotently, and preserves existing data. Combat notes must be migrated to encounter entities; NPC notes must be migrated to creature template entities.

---

## File to Modify

- `src/storage/db/client.ts`

---

## Implementation Steps

1. **Locate the current Dexie schema version** in `src/storage/db/client.ts`. Identify the highest existing `db.version(N)` call.

2. **Add `db.version(6).stores(...)` block** with all three updated/new table definitions:
   ```typescript
   db.version(6).stores({
     // All existing tables (copy from previous version — do not omit)
     // New/modified:
     creatureTemplates: 'id, campaignId, category, status, name',
     encounters: 'id, sessionId, campaignId, type, status',
     notes: 'id, campaignId, sessionId, type, status, pinned, visibility',
   });
   ```
   - The `notes` index gains `visibility` — include all prior index fields to avoid breaking existing queries.
   - Copy every prior table definition verbatim to avoid Dexie dropping tables.

3. **Add an `.upgrade(async tx => { ... })` handler** on the version(6) block containing two migration steps, each guarded by an idempotency flag:

   **Migration A — Combat notes → Encounters:**
   ```typescript
   // NOTE: The metadata table uses schema 'id, &key' with MetadataRecord {id, key, value}
   // Look up by the 'key' field, not by primary key 'id'
   const combatDone = await tx.table('metadata').where('key').equals('migration_v6_combat').first();
   if (!combatDone) {
     const combatNotes = await tx.table('notes').where('type').equals('combat').toArray();
     for (const note of combatNotes) {
       const encounter = {
         id: generateId(),
         sessionId: note.sessionId ?? '',
         campaignId: note.campaignId ?? '',
         title: note.title ?? 'Combat',
         type: 'combat',
         status: 'ended',
         startedAt: note.createdAt,
         endedAt: note.updatedAt,
         participants: note.typeData?.participants ?? [],
         combatData: {
           currentRound: note.typeData?.currentRound ?? 0,
           events: note.typeData?.events ?? [],
         },
         createdAt: note.createdAt,
         updatedAt: note.updatedAt,
         schemaVersion: 1,
       };
       await tx.table('encounters').add(encounter);
       // Archive the source note
       await tx.table('notes').update(note.id, { status: 'archived' });
     }
     await tx.table('metadata').put({ id: 'migration_v6_combat', key: 'migration_v6_combat', value: 'true' });
   }
   ```

   **Migration B — NPC notes → Creature Templates:**
   ```typescript
   const npcDone = await tx.table('metadata').where('key').equals('migration_v6_npc').first();
   if (!npcDone) {
     const npcNotes = await tx.table('notes').where('type').equals('npc').toArray();
     for (const note of npcNotes) {
       const template = {
         id: generateId(),
         campaignId: note.campaignId ?? '',
         name: note.title ?? 'Unnamed NPC',
         description: note.content,
         category: 'npc',
         role: note.typeData?.role,
         affiliation: note.typeData?.affiliation,
         // NOTE: NPC notes only have role/affiliation in typeData — no stats fields exist.
         // Stats default to 0; user will fill them in via the bestiary UI later.
         stats: { hp: 0, armor: 0, movement: 0 },
         attacks: [],
         abilities: [],
         skills: [],
         tags: [],
         imageUrl: undefined,
         status: 'active',
         createdAt: note.createdAt,
         updatedAt: note.updatedAt,
         schemaVersion: 1,
       };
       await tx.table('creatureTemplates').add(template);
       // Archive the source note
       await tx.table('notes').update(note.id, { status: 'archived' });
     }
     await tx.table('metadata').put({ id: 'migration_v6_npc', key: 'migration_v6_npc', value: 'true' });
   }
   ```

4. **The `metadata` table already exists** in the schema from a prior version — do NOT re-declare it in version 6 stores unless you are copying all existing table definitions verbatim. The table uses schema `'id, &key'`.

5. **Do not modify or delete** any prior `db.version(N)` blocks. Only add the new version 6 block.

---

## Verification Commands

```bash
# TypeScript compile check — must pass with no errors
npx tsc --noEmit

# Build check
npm run build
```

**Manual verification:**
- Open the app in a browser with existing Dexie v5 data containing combat notes and NPC notes.
- Open DevTools → Application → IndexedDB — verify `creatureTemplates` and `encounters` tables exist.
- Verify previously-combat notes now have `status: 'archived'` in the `notes` table.
- Verify corresponding records exist in `encounters` table.
- Verify previously-NPC notes now have `status: 'archived'` in `notes` table.
- Verify corresponding records exist in `creatureTemplates` table.
- Reload app a second time — verify migrations do NOT re-run (flags are set).

---

## Acceptance Criteria

- [ ] `db.version(6).stores(...)` contains `creatureTemplates: 'id, campaignId, category, status, name'`
- [ ] `db.version(6).stores(...)` contains `encounters: 'id, sessionId, campaignId, type, status'`
- [ ] `db.version(6).stores(...)` contains updated `notes` index including `visibility`
- [ ] Upgrade handler runs combat migration if `migration_v6_combat` flag not set
- [ ] Upgrade handler runs NPC migration if `migration_v6_npc` flag not set
- [ ] Migration failure leaves app on v5 with data intact (Dexie upgrade transaction semantics — do not catch errors that would swallow the transaction rollback)
- [ ] Both migration flags set after successful run; re-run on next app open is a no-op
- [ ] Existing notes, characters, sessions, and all other tables remain intact after migration
- [ ] `npx tsc --noEmit` passes with no errors after changes

---

## Constraints

- No new npm dependencies
- Do not modify any `db.version(N)` blocks for N < 6
- Archive combat/NPC notes — never delete them
- Migration must be idempotent (guarded by flags)
- All schema work in this file only (`client.ts`)
