---
type: phase-spec
master_spec: "docs/specs/2026-04-16-game-night-reliability-fixes.md"
sub_spec: 5
title: "softDeleteLinksForCreature cascade helper"
dependencies: []
phase: 1
---

# Sub-Spec 5: `softDeleteLinksForCreature` Cascade Helper

## Scope

Mirror the existing `softDeleteLinksForEncounter` helper at `src/storage/repositories/entityLinkRepository.ts:148-172` for creature templates. Phase 3's `creatureTemplateRepository.softDelete` will call this to cascade `represents` edges.

## Files

- `src/storage/repositories/entityLinkRepository.ts` (modified — add new helper + update top-of-file relationship-types comment)

## Interface Contracts

### `softDeleteLinksForCreature` (new)
- Direction: Sub-spec 5 → Sub-spec 10 (`creatureTemplateRepository.softDelete`)
- Owner: Sub-spec 5
- Shape: `softDeleteLinksForCreature(creatureId: string, txId: string, now: string): Promise<void>`

## Implementation Steps

1. **Read the mirror pattern.** `entityLinkRepository.ts:148-172` shows the canonical cascade shape. Mirror structure exactly — same dedup-via-Map approach, same update fields, same error wrap.

2. **Add the helper** immediately after `softDeleteLinksForEncounter`:

   ```ts
   /**
    * Soft-delete every edge where the given creature is source or target.
    *
    * @remarks
    * All matched edges share the provided `txId` so they can be restored
    * together via {@link restoreLinksForTxId}. Already-deleted edges are
    * left alone. Mirrors {@link softDeleteLinksForEncounter} exactly.
    */
   export async function softDeleteLinksForCreature(
     creatureId: string,
     txId: string,
     now: string,
   ): Promise<void> {
     try {
       const fromLinks = await db.entityLinks.where('fromEntityId').equals(creatureId).toArray();
       const toLinks = await db.entityLinks.where('toEntityId').equals(creatureId).toArray();
       const byId = new Map<string, EntityLink>();
       for (const l of [...fromLinks, ...toLinks]) {
         if (!(l as EntityLink).deletedAt) {
           byId.set(l.id, l as EntityLink);
         }
       }
       for (const id of byId.keys()) {
         await db.entityLinks.update(id, {
           deletedAt: now,
           softDeletedBy: txId,
           updatedAt: now,
         });
       }
     } catch (e) {
       throw new Error(`entityLinkRepository.softDeleteLinksForCreature failed: ${e}`);
     }
   }
   ```

3. **Update the top-of-file relationship-types comment** (the one documenting which entity types use which relationship names). Add a note that creatures participate in `represents` edges as `toEntityType === 'creature'` — if the comment already covers this, leave it alone. Do NOT invent new relationship types.

4. **Build check.** `npm run build` → exit 0.

5. **Commit.** Message: `feat(entity-links): add softDeleteLinksForCreature cascade helper`

## Verification Commands

```bash
npm run build

# Export exists
grep -q "export async function softDeleteLinksForCreature" src/storage/repositories/entityLinkRepository.ts

# Mirrors the shape (same from/to query + Map dedup)
grep -A20 "export async function softDeleteLinksForCreature" src/storage/repositories/entityLinkRepository.ts | grep -q "byId"
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| softDeleteLinksForCreature exported | [STRUCTURAL] | `grep -q "export async function softDeleteLinksForCreature" src/storage/repositories/entityLinkRepository.ts \|\| (echo "FAIL: cascade helper missing" && exit 1)` |
| Mirrors Map-dedup pattern of encounter helper | [STRUCTURAL] | `grep -A20 "export async function softDeleteLinksForCreature" src/storage/repositories/entityLinkRepository.ts \| grep -q "byId" \|\| (echo "FAIL: missing dedup Map pattern" && exit 1)` |
| Uses shared txId across rows | [STRUCTURAL] | `grep -A15 "export async function softDeleteLinksForCreature" src/storage/repositories/entityLinkRepository.ts \| grep -q "softDeletedBy: txId" \|\| (echo "FAIL: txId not propagated" && exit 1)` |
| npm run build exits zero | [MECHANICAL] | `npm run build 2>&1 \| tail -3 ; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
