---
scenario_id: "SR-09"
title: "creatureTemplateRepository.softDelete cascades, archive() removed"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
  - repo
sequential: false
---

# Scenario SR-09: Creature Template softDelete Cascade + archive() Removal

## Description

Verifies R9. After Phase 3, user-facing creature deletion must cascade through `represents` edges under a shared `softDeletedBy` txId, and the legacy `archive()` method must be gone. This scenario asserts both via grep.

## Preconditions

- File exists: `src/storage/repositories/creatureTemplateRepository.ts`.

## Steps

1. Confirm `archive` export is gone from the repository:
   ```bash
   grep -q "export async function archive" src/storage/repositories/creatureTemplateRepository.ts \
     && { echo "FAIL: archive() is still exported"; exit 1; }
   true
   ```

2. Confirm no other file in `src/` still calls `.archive(`:
   ```bash
   git grep -n "\.archive(" src/ \
     && { echo "FAIL: external .archive( callers still exist"; exit 1; }
   true
   ```

3. Confirm `softDelete` wraps a transaction over both tables:
   ```bash
   grep -A15 "export async function softDelete" src/storage/repositories/creatureTemplateRepository.ts \
     | grep -q "db.transaction('rw', \[db.creatureTemplates, db.entityLinks\]" \
     || { echo "FAIL: softDelete does not wrap rw-tx over creatureTemplates + entityLinks"; exit 1; }
   ```

4. Confirm `softDelete` invokes the cascade helper:
   ```bash
   grep -A20 "export async function softDelete" src/storage/repositories/creatureTemplateRepository.ts \
     | grep -q "softDeleteLinksForCreature" \
     || { echo "FAIL: softDelete does not cascade via softDeleteLinksForCreature"; exit 1; }
   ```

5. Confirm `getDeleted()` helper exists for the TrashScreen:
   ```bash
   grep -q "export async function getDeleted" src/storage/repositories/creatureTemplateRepository.ts \
     || { echo "FAIL: getDeleted() helper missing"; exit 1; }
   ```

6. Confirm `restore()` cascade-restores edges sharing the txId:
   ```bash
   grep -A20 "export async function restore" src/storage/repositories/creatureTemplateRepository.ts \
     | grep -q "restoreLinksForTxId" \
     || { echo "FAIL: restore() does not cascade via restoreLinksForTxId"; exit 1; }
   ```

## Expected Results

- All six greps succeed.
- No `FAIL:` lines in output.

## Execution Tool

bash — grep checks against the repository file and the wider src tree.

## Pass / Fail Criteria

- **Pass:** All six checks succeed.
- **Fail:** Any `FAIL:` line.
