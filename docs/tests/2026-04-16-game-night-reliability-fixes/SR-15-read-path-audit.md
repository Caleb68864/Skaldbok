---
scenario_id: "SR-15"
title: "Read-path audit: every db.creatureTemplates caller filters deletedAt"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
  - audit
sequential: false
---

# Scenario SR-15: creatureTemplates Read-Path Audit

## Description

Verifies R15. CLAUDE.md mandates that every read over a domain entity with soft-delete filter out `deletedAt` by default. This scenario greps every `db.creatureTemplates.*` caller outside migration code and asserts each one goes through `excludeDeleted` or explicitly opts in via `{ includeDeleted: true }`, OR is a write/clear operation where filtering doesn't apply.

## Preconditions

- Repo at `main` HEAD (`c34862b` or later — Phase 3 landed).

## Steps

1. Collect all `db.creatureTemplates.` callers outside `src/storage/db/` (the migration file legitimately uses `tx.table('creatureTemplates')` and doesn't match this pattern anyway):
   ```bash
   git grep -n "db.creatureTemplates\." src/ | grep -v "src/storage/db/" > /tmp/skaldbok-cst-callers.txt
   cat /tmp/skaldbok-cst-callers.txt
   ```

2. Classify each caller. Acceptable lines are one of:
   - Uses `excludeDeleted(...)` on the result
   - Passes `{ includeDeleted: true }` as an option
   - Is a write verb: `.add(`, `.put(`, `.update(`, `.delete(`, `.clear(`
   - Is a `.get(id)` call inside `softDelete` / `restore` / `hardDelete` — these intentionally see deleted rows to operate on them
   - Is `.toArray()` inside `getDeleted()` — intentionally surfaces deleted rows

   Flag any caller that reads (`.where(...).toArray`, `.toArray()`, `.get(id)` from outside the repository) and does NOT filter.

3. Run the filter check:
   ```bash
   BAD=$(git grep -n "db.creatureTemplates\." src/ \
     | grep -v "src/storage/db/" \
     | grep -v "\.add(" \
     | grep -v "\.put(" \
     | grep -v "\.update(" \
     | grep -v "\.delete(" \
     | grep -v "\.clear(" \
     | grep -v "excludeDeleted\|includeDeleted" \
     | grep -v "creatureTemplateRepository.ts" || true)
   if [ -n "$BAD" ]; then
     echo "FAIL: bare db.creatureTemplates callers outside the repository:"
     echo "$BAD"
     exit 1
   fi
   echo "SR-15 PASS"
   ```

   Note: the `creatureTemplateRepository.ts` file is excluded because the repository itself owns the `excludeDeleted` decision per function, and the reviewer can see those functions are correct (SR-09 covers them).

4. Confirm the suspicious-line list is acceptable by spot-checking `useSessionLog.ts` and `SettingsScreen.tsx` (the two known non-repo callers — one is a bestiary write, the other is Clear All's blanket `.clear()`):
   ```bash
   git grep -n "db.creatureTemplates\." src/features/session/useSessionLog.ts src/screens/SettingsScreen.tsx
   ```
   Both should show a write operation only.

## Expected Results

- `BAD` is empty; script prints `SR-15 PASS`.
- Spot-check at step 4 shows only `.add(` / `.clear(` — no reads.

## Execution Tool

bash — grep audit against the `src/` tree.

## Pass / Fail Criteria

- **Pass:** Step 3 prints `SR-15 PASS` and step 4 shows only write operations.
- **Fail:** Any bare read-path caller of `db.creatureTemplates.*` outside `creatureTemplateRepository.ts` and `src/storage/db/`.
