---
scenario_id: "SR-06"
title: "Atomic encounterRepository.reopenEncounter rolls back on throw"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - repo
sequential: false
---

# Scenario SR-06: Atomic reopenEncounter Transaction

## Description

Verifies R6. `encounterRepository.reopenEncounter` runs "close prior open + push new segment on target + set active" inside a single `db.transaction('rw', [db.encounters], ...)`. If any step throws, the whole transaction rolls back and the DB never ends up with the prior encounter closed but the target not reopened.

## Preconditions

- Preview server up.
- Active session with two encounters: one currently open (`status: 'active'` with an open segment) and one previously ended (`status: 'ended'` with a closed segment).

## Steps

1. Seed the DB state:
   ```js
   await page.evaluate(async () => {
     // Insert two encounters in the active session:
     //   enc A: status='active', segments=[{startedAt: now-1h}]
     //   enc B: status='ended',  segments=[{startedAt: now-2h, endedAt: now-1.5h}]
     // (Use direct Dexie writes against skaldbok-db.)
   });
   ```

2. **Happy path:** via the app UI (or directly via the repository), reopen enc B:
   ```js
   await page.evaluate(async () => {
     const mod = await import('/src/storage/repositories/encounterRepository.ts');
     await mod.reopenEncounter('sessionId', 'encB');
   });
   ```

3. Inspect DB state:
   ```js
   // enc A: status='ended', last segment has endedAt
   // enc B: status='active', a new open segment at the tail
   // Exactly one encounter in the session is active.
   ```

4. **Rollback path:** seed a malformed state where enc B's last segment has no `endedAt` (so `pushSegment` will throw "last segment still open"). Then call `reopenEncounter` on enc B:
   ```js
   await page.evaluate(async () => {
     const mod = await import('/src/storage/repositories/encounterRepository.ts');
     try {
       await mod.reopenEncounter('sessionId', 'encB');
       return { threw: false };
     } catch (e) { return { threw: true, message: String(e) }; }
   });
   ```

5. Inspect DB state after the rollback:
   ```js
   // enc A: still active (its segment was NOT closed)
   // enc B: still 'ended' (its status was NOT flipped)
   // No partial state.
   ```

## Expected Results

- Happy path: step 3 observations all hold. Exactly one active encounter on the session post-reopen.
- Rollback path: the call throws (caught in step 4). DB state is byte-for-byte unchanged from before the attempt.

## Execution Tool

playwright — direct Dexie reads and module imports via `evaluate`.

## Pass / Fail Criteria

- **Pass:** Both happy and rollback observations hold. No partial state under any path.
- **Fail:** Rollback path leaves enc A closed OR enc B active (the non-atomic failure the refactor was designed to prevent).
