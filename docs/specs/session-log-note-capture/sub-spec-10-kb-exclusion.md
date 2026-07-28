---
type: phase-spec
sub_spec_id: SS-10
phase: run
depends_on: ['SS-01']
wave: 2
master_spec: "docs/specs/2026-07-27-session-log-note-capture.md"
---

# SS-10 — Exclude log entries from the KB graph

## Scope

`syncNote` returns early for `type === 'log'`.

## Rationale (committed decision — do not escalate)

Log entries are raw capture, not knowledge nodes. Syncing ~80 nodes per session would swamp the graph, and `promoted_into` already records lineage in `entityLinks`. This was decided during evaluation; it is not an open question.

## Interface Contracts

None — this is a guard inside an existing function.

## Implementation Steps

### Step 1. Add the early return

In `src/features/kb/linkSyncEngine.ts`, inside `syncNote(noteId)`, after the note is loaded and before any `kb_nodes` / `kb_edges` work:

```ts
// Log entries are raw capture, not knowledge nodes. ~80 per session would
// swamp the graph; promoted_into on entityLinks already records lineage.
if (note.type === 'log') return;
```

Place it after the note-exists check so a missing note still behaves as before.

### Step 2. Leave `noteTypeToKBNodeType` untouched

`noteTypeToKBNodeType` (line ~34) maps note types to KB node types. Because `syncNote` now returns before reaching it, **no mapping for `'log'` is needed**. Do not add one — an unused branch invites a future contributor to "fix" the exclusion.

### Step 3. Verify no regression for other types

Confirm the early return is type-scoped and every other note type still syncs exactly as before.

```bash
npm run build && npm test
```

### Step 4. Commit

```bash
git add src/features/kb/linkSyncEngine.ts
git commit -m "feat(kb): exclude log entries from the knowledge graph [factory-managed]"
```

## Verification Commands

```bash
npm run build
npm test
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Early return for log type | [STRUCTURAL] | `grep -q "type === 'log'" src/features/kb/linkSyncEngine.ts \|\| (echo "FAIL: no log-type guard in linkSyncEngine" && exit 1)` |
| No noteTypeToKBNodeType branch for log | [MECHANICAL] | `! sed -n '/function noteTypeToKBNodeType/,/^}/p' src/features/kb/linkSyncEngine.ts \| grep -q "'log'" \|\| (echo "FAIL: unnecessary log branch added to noteTypeToKBNodeType" && exit 1)` |
| Build and tests pass | [MECHANICAL] | `npm run build > /dev/null 2>&1 && npm test > /dev/null 2>&1 \|\| (echo "FAIL: build or tests failed" && exit 1)` |
