---
type: phase-spec
master_spec: "docs/specs/2026-04-16-game-night-reliability-fixes.md"
sub_spec: 10
title: "Bestiary soft-delete + archive() removal + UI rename"
dependencies: [5, 9]
phase: 3
---

# Sub-Spec 10: Bestiary Soft-Delete + `archive()` Removal + UI Rename

## Scope

Replace the `archive` concept in the bestiary with full soft-delete. Delete `creatureTemplateRepository.archive`, wire `softDelete` to cascade through `softDeleteLinksForCreature` (SS-5), remove `useBestiary.archive` + `showArchived` filter (dead after migration), rename UI action to "Delete", and add a "View Trash" link pointing to `/bestiary/trash`.

## Files

- `src/storage/repositories/creatureTemplateRepository.ts` (modified)
- `src/features/bestiary/useBestiary.ts` (modified)
- `src/features/bestiary/BestiaryScreen.tsx` (modified)

## Interface Contracts

### Consumes `softDeleteLinksForCreature` (from Sub-spec 5)
- Implements contract from Sub-spec 5
- Call site: `creatureTemplateRepository.softDelete` (the refactored cascade-aware version)

### Consumes migrated data (from Sub-spec 9)
- Pre-existing `status='archived'` rows are now `deletedAt`-set rows. `useBestiary` must not reference `status === 'archived'` anywhere.

### Provides `getDeleted` (new)
- Direction: Sub-spec 10 → Sub-spec 11 (TrashScreen)
- Owner: Sub-spec 10
- Shape: `getDeleted(): Promise<CreatureTemplate[]>` — returns rows where `deletedAt != null`, sorted by `deletedAt desc`.

## Implementation Steps

1. **Verify no external `archive()` callers.** `git grep -n "\.archive(" src/ | grep -v "creatureTemplateRepository.archive"`. If this returns anything outside the bestiary feature folder, halt and escalate — the spec says to escalate before removing.

2. **Refactor `creatureTemplateRepository.softDelete`** at `src/storage/repositories/creatureTemplateRepository.ts:108-123` to cascade. Current version doesn't cascade:

   ```ts
   export async function softDelete(id: string, txId?: string): Promise<void> {
     try {
       const finalTxId = txId ?? generateSoftDeleteTxId();
       const now = nowISO();
       await db.transaction('rw', [db.creatureTemplates, db.entityLinks], async () => {
         const row = await db.creatureTemplates.get(id);
         if (!row) return;
         if ((row as CreatureTemplate).deletedAt) return;
         await db.creatureTemplates.update(id, {
           deletedAt: now,
           softDeletedBy: finalTxId,
           updatedAt: now,
         });
         await entityLinkRepository.softDeleteLinksForCreature(id, finalTxId, now);
       });
     } catch (e) {
       throw new Error(`creatureTemplateRepository.softDelete failed: ${e}`);
     }
   }
   ```
   Add `import * as entityLinkRepository from './entityLinkRepository';` at the top if not present.

3. **Refactor `creatureTemplateRepository.restore`** to cascade-restore edges that share the `softDeletedBy` txId (current `restore` only restores the creature row):
   ```ts
   export async function restore(id: string): Promise<void> {
     try {
       const row = await db.creatureTemplates.get(id);
       if (!row) return;
       if (!(row as CreatureTemplate).deletedAt) return;
       const txId = (row as CreatureTemplate).softDeletedBy;
       const now = nowISO();
       await db.transaction('rw', [db.creatureTemplates, db.entityLinks], async () => {
         await db.creatureTemplates.update(id, {
           deletedAt: undefined,
           softDeletedBy: undefined,
           updatedAt: now,
         });
         if (txId) {
           await entityLinkRepository.restoreLinksForTxId(txId);
         }
       });
     } catch (e) {
       throw new Error(`creatureTemplateRepository.restore failed: ${e}`);
     }
   }
   ```
   Verify `restoreLinksForTxId` exists in `entityLinkRepository` (grep first — it was referenced in the `softDeleteLinksForEncounter` docstring). If it doesn't exist as a named export, replicate the pattern used by `encounterRepository.restore` (which handles the same cascade).

4. **Remove `creatureTemplateRepository.archive`** (lines 100-106).

5. **Add `creatureTemplateRepository.getDeleted`**:
   ```ts
   export async function getDeleted(): Promise<CreatureTemplate[]> {
     try {
       const rows = await db.creatureTemplates.toArray();
       return rows
         .filter((r) => (r as CreatureTemplate).deletedAt)
         .sort((a, b) => {
           const aTs = (a as CreatureTemplate).deletedAt ?? '';
           const bTs = (b as CreatureTemplate).deletedAt ?? '';
           return bTs.localeCompare(aTs);
         }) as CreatureTemplate[];
     } catch (e) {
       throw new Error(`creatureTemplateRepository.getDeleted failed: ${e}`);
     }
   }
   ```

6. **Refactor `useBestiary.ts`:**
   - Remove `archive` callback (lines ~58-64).
   - Add `softDelete` callback:
     ```ts
     const softDelete = useCallback(async (id: string) => {
       await creatureTemplateRepository.softDelete(id);
       await refresh();
     }, [refresh]);
     ```
   - Remove the `showArchived` filter logic (lines ~29-30 — the two lines filtering on `t.status === 'archived'`).
   - Remove `showArchived` from the return object (line 77 area).
   - Return `softDelete` instead of `archive`.

7. **Refactor `BestiaryScreen.tsx`:**
   - Line 46: Replace `archive,` with `softDelete,` in the destructuring.
   - Line 67: Replace `await archive(id);` with `await softDelete(id);`.
   - Update the action button label from "Archive" to "Delete".
   - Line 134: Remove the "No archived creatures." empty-state branch entirely. The bestiary's main list never shows archived/deleted rows now.
   - Line 288: Remove the `{viewingTemplate.status !== 'archived' && (...)}` conditional wrapper. The condition is dead — deleted templates never reach the viewing drawer.
   - Add a "View Trash" navigation element (a small text link or icon button in the screen header/toolbar) that navigates to `/bestiary/trash`. Use `useNavigate` from `react-router-dom` or a `<Link>` depending on what the screen already uses elsewhere.

8. **Build check.** `npm run build` → exit 0. TypeScript will catch any remaining `.archive(` callers inside the bestiary feature.

9. **Manual smoke.** Open `/bestiary`. Click Delete on a creature. Verify in DevTools → IndexedDB: the creature has `deletedAt` + `softDeletedBy` set AND any `represents` edges it had now share the same `softDeletedBy`. The creature no longer shows in the main bestiary list.

10. **Commit.** Message: `refactor(bestiary): replace archive with soft-delete cascade + trash link`

## Verification Commands

```bash
npm run build

# archive export removed
! grep -q "export async function archive" src/storage/repositories/creatureTemplateRepository.ts

# softDelete cascades via entityLinkRepository
grep -A15 "export async function softDelete" src/storage/repositories/creatureTemplateRepository.ts | grep -q "softDeleteLinksForCreature"

# getDeleted exists
grep -q "export async function getDeleted" src/storage/repositories/creatureTemplateRepository.ts

# useBestiary no longer exports archive / showArchived
! grep -q "archive," src/features/bestiary/useBestiary.ts
! grep -q "showArchived" src/features/bestiary/useBestiary.ts

# BestiaryScreen uses softDelete
grep -q "softDelete," src/features/bestiary/BestiaryScreen.tsx
! grep -q "archive," src/features/bestiary/BestiaryScreen.tsx

# No more 'status !== archived' dead-code check
! grep -q "status !== 'archived'" src/features/bestiary/BestiaryScreen.tsx

# View Trash link present
grep -q "/bestiary/trash" src/features/bestiary/BestiaryScreen.tsx
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| archive removed from repository | [STRUCTURAL] | `! grep -q "export async function archive" src/storage/repositories/creatureTemplateRepository.ts \|\| (echo "FAIL: archive() still present" && exit 1)` |
| softDelete cascades | [STRUCTURAL] | `grep -A15 "export async function softDelete" src/storage/repositories/creatureTemplateRepository.ts \| grep -q "softDeleteLinksForCreature" \|\| (echo "FAIL: softDelete not cascading" && exit 1)` |
| getDeleted exported | [STRUCTURAL] | `grep -q "export async function getDeleted" src/storage/repositories/creatureTemplateRepository.ts \|\| (echo "FAIL: getDeleted missing" && exit 1)` |
| useBestiary.archive removed | [STRUCTURAL] | `! grep -q "^    archive\|  archive: " src/features/bestiary/useBestiary.ts \|\| (echo "FAIL: useBestiary still exports archive" && exit 1)` |
| showArchived filter removed | [STRUCTURAL] | `! grep -q "showArchived" src/features/bestiary/useBestiary.ts \|\| (echo "FAIL: showArchived filter still present" && exit 1)` |
| BestiaryScreen uses softDelete | [STRUCTURAL] | `grep -q "softDelete" src/features/bestiary/BestiaryScreen.tsx \|\| (echo "FAIL: BestiaryScreen still on archive" && exit 1)` |
| BestiaryScreen dead-code 'status === archived' removed | [STRUCTURAL] | `! grep -q "'archived'" src/features/bestiary/BestiaryScreen.tsx \|\| (echo "FAIL: 'archived' literal still in screen" && exit 1)` |
| View Trash link added | [STRUCTURAL] | `grep -q "/bestiary/trash" src/features/bestiary/BestiaryScreen.tsx \|\| (echo "FAIL: View Trash link missing" && exit 1)` |
| No external archive() callers | [MECHANICAL] | `! git grep -n "\.archive(" -- src/ \|\| (echo "FAIL: external archive() callers still exist" && exit 1)` |
| npm run build exits zero | [MECHANICAL] | `npm run build 2>&1 \| tail -3 ; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
