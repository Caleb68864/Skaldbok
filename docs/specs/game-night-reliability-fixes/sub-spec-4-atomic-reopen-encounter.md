---
type: phase-spec
master_spec: "docs/specs/2026-04-16-game-night-reliability-fixes.md"
sub_spec: 4
title: "Atomic reopenEncounter helper"
dependencies: []
phase: 1
---

# Sub-Spec 4: Atomic `reopenEncounter` Helper

## Scope

Move the "close prior open + push new open + set status=active" sequence out of `useSessionEncounter.reopenEncounter` (currently at `src/features/session/useSessionEncounter.ts:171-201`) into a new `encounterRepository.reopenEncounter` function that wraps the whole sequence in a single `db.transaction('rw', [db.encounters], ...)`. Atomic rollback on throw.

## Files

- `src/storage/repositories/encounterRepository.ts` (modified — add `reopenEncounter`)
- `src/features/session/useSessionEncounter.ts` (modified — refactor lines 171-201 to call the new helper)

## Interface Contracts

### `reopenEncounter` (new)
- Direction: Sub-spec 4 → Sub-spec 8 (resume flow)
- Owner: Sub-spec 4
- Shape: `reopenEncounter(sessionId: string, targetEncounterId: string): Promise<void>`

## Implementation Steps

1. **Read the existing hook logic at lines 171-201.** The current implementation already uses a transaction and calls `encounterRepository.getActiveEncounterForSession`, `encounterRepository.endActiveSegment`, `encounterRepository.pushSegment`, and `db.encounters.update`. Preserve the semantics exactly — only the location of the transaction boundary changes.

2. **Add `reopenEncounter` to `encounterRepository.ts`.** Place it near the existing `softDelete` / `restore` exports. Shape:

   ```ts
   /**
    * Atomically close any currently-open encounter on the session and open
    * the target encounter. Rolls back on any throw.
    */
   export async function reopenEncounter(
     sessionId: string,
     targetEncounterId: string,
   ): Promise<void> {
     try {
       await db.transaction('rw', [db.encounters], async () => {
         const existing = await db.encounters.get(targetEncounterId);
         if (!existing) {
           throw new Error(`encounterRepository.reopenEncounter: encounter ${targetEncounterId} not found`);
         }
         if ((existing as Encounter).deletedAt) {
           throw new Error(`encounterRepository.reopenEncounter: encounter ${targetEncounterId} is deleted`);
         }
         const priorActive = await getActiveEncounterForSession(sessionId);
         if (priorActive && priorActive.id !== targetEncounterId) {
           await endActiveSegment(priorActive.id);
         }
         await pushSegment(targetEncounterId, { startedAt: nowISO() });
         await db.encounters.update(targetEncounterId, {
           status: 'active',
           updatedAt: nowISO(),
         });
       });
     } catch (e) {
       throw new Error(`encounterRepository.reopenEncounter failed: ${e}`);
     }
   }
   ```

   Note: `endActiveSegment`, `pushSegment`, `getActiveEncounterForSession` are already declared in the same file — they can be called directly by name.

3. **Refactor `useSessionEncounter.reopenEncounter`** at `src/features/session/useSessionEncounter.ts:171-201`. Replace the entire body with:

   ```ts
   const reopenEncounter = useCallback(
     async (id: string): Promise<void> => {
       await encounterRepository.reopenEncounter(sessionId, id);
       await refresh();
     },
     [sessionId, refresh],
   );
   ```

4. **Build check.** `npm run build` → exit 0.

5. **Manual smoke check.** Open a session in the browser, create two encounters, end one, click reopen on the other. Verify: the DB has one open encounter and one ended encounter (use DevTools → IndexedDB → Skaldbok → encounters). No partial state.

6. **Commit.** Message: `refactor(encounters): move reopen sequence into atomic repository transaction`

## Verification Commands

```bash
npm run build

# Repository function exists
grep -q "export async function reopenEncounter" src/storage/repositories/encounterRepository.ts

# Hook delegates to repository
grep -q "encounterRepository.reopenEncounter(" src/features/session/useSessionEncounter.ts

# Hook body is compact (the transaction no longer lives in the hook)
! grep -q "db.transaction('rw', \[db.encounters\], async ()" src/features/session/useSessionEncounter.ts
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| reopenEncounter export in repository | [STRUCTURAL] | `grep -q "export async function reopenEncounter" src/storage/repositories/encounterRepository.ts \|\| (echo "FAIL: reopenEncounter not exported" && exit 1)` |
| Repository function wraps rw-transaction | [STRUCTURAL] | `grep -A3 "export async function reopenEncounter" src/storage/repositories/encounterRepository.ts \| grep -q "db.transaction" \|\| (echo "FAIL: reopenEncounter missing transaction" && exit 1)` |
| Hook delegates to repository | [STRUCTURAL] | `grep -q "encounterRepository.reopenEncounter(" src/features/session/useSessionEncounter.ts \|\| (echo "FAIL: hook not delegating to repository" && exit 1)` |
| Hook no longer contains inline transaction | [STRUCTURAL] | `! grep -q "await db.transaction('rw', \[db.encounters\]" src/features/session/useSessionEncounter.ts \|\| (echo "FAIL: hook still has inline transaction" && exit 1)` |
| npm run build exits zero | [MECHANICAL] | `npm run build 2>&1 \| tail -3 ; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
