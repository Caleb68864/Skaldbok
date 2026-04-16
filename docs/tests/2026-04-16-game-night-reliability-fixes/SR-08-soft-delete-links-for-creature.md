---
scenario_id: "SR-08"
title: "entityLinkRepository.softDeleteLinksForCreature cascades edges"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
  - repo
sequential: false
---

# Scenario SR-08: softDeleteLinksForCreature Cascade Helper

## Description

Verifies R8. The new cascade helper mirrors `softDeleteLinksForEncounter` exactly. This scenario confirms via static analysis (because Dexie requires a browser environment to actually execute) that the helper exists with the right signature, uses the same dedupe-via-Map pattern, and propagates the shared `softDeletedBy` txId.

## Preconditions

- File exists: `src/storage/repositories/entityLinkRepository.ts`.

## Steps

1. Confirm the function is exported with the expected signature:
   ```bash
   grep -q "export async function softDeleteLinksForCreature" src/storage/repositories/entityLinkRepository.ts \
     || { echo "FAIL: softDeleteLinksForCreature not exported"; exit 1; }
   ```

2. Confirm the signature takes `(creatureId, txId, now)`:
   ```bash
   grep -A3 "export async function softDeleteLinksForCreature" src/storage/repositories/entityLinkRepository.ts \
     | grep -q "creatureId: string" \
     || { echo "FAIL: unexpected signature"; exit 1; }
   ```

3. Confirm it uses the Map-dedup pattern (since a link could match both fromEntityId and toEntityId queries):
   ```bash
   grep -A20 "export async function softDeleteLinksForCreature" src/storage/repositories/entityLinkRepository.ts \
     | grep -q "byId" \
     || { echo "FAIL: missing dedup Map pattern (expected 'byId' like softDeleteLinksForEncounter)"; exit 1; }
   ```

4. Confirm it writes the shared `softDeletedBy: txId`:
   ```bash
   grep -A25 "export async function softDeleteLinksForCreature" src/storage/repositories/entityLinkRepository.ts \
     | grep -q "softDeletedBy: txId" \
     || { echo "FAIL: txId not propagated to soft-deleted edges"; exit 1; }
   ```

5. Confirm it skips already-deleted edges (to avoid double-cascade on repeat calls):
   ```bash
   grep -A15 "export async function softDeleteLinksForCreature" src/storage/repositories/entityLinkRepository.ts \
     | grep -q "deletedAt" \
     || { echo "FAIL: does not guard against already-deleted edges"; exit 1; }
   ```

## Expected Results

- All five greps exit 0.
- No `FAIL:` lines in output.

## Execution Tool

bash — grep checks against the repository file.

## Pass / Fail Criteria

- **Pass:** All five checks succeed.
- **Fail:** Any `FAIL:` line, or any grep exits non-zero.
