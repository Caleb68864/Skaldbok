---
scenario_id: "SR-01"
title: "autosaveFlush registry: registerFlush + flushAll semantics"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
  - unit
sequential: false
---

# Scenario SR-01: autosaveFlush Registry — registerFlush + flushAll Semantics

## Description

Verifies R1. The `autosaveFlush` registry is the cross-cutting primitive for Phase 1. This scenario exercises its core contract: `registerFlush` returns `{ id, unregister }`, `flushAll()` runs registered callbacks via `Promise.allSettled` (so one rejection doesn't stop the others), and the registry is snapshotted at entry so late unregisters don't affect the in-flight batch.

## Preconditions

- Repo cloned, `npm install` completed.
- File exists: `src/features/persistence/autosaveFlush.ts`.

## Steps

1. From the repo root, run an inline Node script that imports the registry and asserts four contract points. Use `npx tsx` since the module is `.ts`:
   ```bash
   npx --yes tsx -e "
   const { registerFlush, flushAll } = require('./src/features/persistence/autosaveFlush.ts');
   (async () => {
     // 1. Happy path: two flushes register, both run.
     let ranA = false, ranB = false;
     const a = registerFlush(async () => { ranA = true; });
     const b = registerFlush(async () => { ranB = true; });
     const results = await flushAll();
     if (!ranA || !ranB) throw new Error('FAIL: both flushes should run');
     if (results.length !== 2) throw new Error('FAIL: expected 2 results, got ' + results.length);

     // 2. unregister works — after unregister, flush is not called.
     a.unregister();
     b.unregister();
     ranA = false; ranB = false;
     const emptyResults = await flushAll();
     if (ranA || ranB) throw new Error('FAIL: unregistered flushes should not run');
     if (emptyResults.length !== 0) throw new Error('FAIL: empty registry should produce 0 results');

     // 3. Rejection isolation: a throwing flush does not prevent sibling from running.
     let siblingRan = false;
     const bad = registerFlush(async () => { throw new Error('intentional'); });
     const good = registerFlush(async () => { siblingRan = true; });
     const mixed = await flushAll();
     if (!siblingRan) throw new Error('FAIL: sibling should run even if earlier flush throws');
     const rejected = mixed.filter(r => r.status === 'rejected');
     if (rejected.length !== 1) throw new Error('FAIL: expected 1 rejection, got ' + rejected.length);
     bad.unregister(); good.unregister();

     // 4. Snapshot-at-entry: late unregister during flush does not affect this batch.
     let latexCalled = false;
     const late = registerFlush(async () => { latexCalled = true; });
     const fast = registerFlush(async () => { late.unregister(); });
     await flushAll();
     if (!latexCalled) throw new Error('FAIL: late-unregistered flush should still run this batch (snapshot contract)');

     console.log('SR-01 PASS');
   })().catch(e => { console.error(e); process.exit(1); });
   "
   ```

## Expected Results

- Script exits with code 0.
- Final line printed: `SR-01 PASS`.
- No `FAIL:` lines in output.

## Execution Tool

bash — inline Node/tsx script run from repo root.

## Pass / Fail Criteria

- **Pass:** Script exits 0 and prints `SR-01 PASS`.
- **Fail:** Any assertion throws, or the script exits non-zero, or the output contains `FAIL:`.
