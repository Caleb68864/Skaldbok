---
type: phase-spec
sub_spec_id: SS-12
phase: run
depends_on: ['SS-13', 'SS-14']
wave: 6
master_spec: "docs/specs/2026-07-27-session-log-note-capture.md"
---

# SS-12 — Route in-session capture to the log, and verify end to end

## Scope

The integration sub-spec. Point the session FAB's Note quick action at `SessionLog` instead of the `QuickNoteAction` type-chip form, then exercise the whole pipeline and record the evidence.

## Do not delete the old components

`QuickNoteAction` and `QuickNoteDrawer` **remain reachable outside the session flow**. Deleting either is explicitly a human decision, not an agent one. This sub-spec removes them from the session flow only.

## Interface Contracts

Consumes every prior sub-spec. Produces no new contract — it closes the loop.

## Implementation Steps

### Step 1. Repoint the FAB

In `src/features/session/SessionQuickActions.tsx`, change the Note quick action to open `SessionLog` (navigate to its route, or open it as the quick-action surface consistent with the existing pattern). Remove `QuickNoteAction` from the session quick-action set.

Leave the component file in place and reachable from outside the session flow.

### Step 2. Full build and test

```bash
npm run build
npm test
```

Expect 219+ tests passing.

### Step 3. Run the end-to-end flow

Start the app (`npm run preview`, or `forge-project.json`'s `smoke_command`) and exercise:

1. Start a session
2. Open the log from the FAB
3. Commit 3 entries
4. Edit one entry — confirm it keeps its position
5. Delete one entry — confirm it disappears and is restorable from Trash
6. Select the remaining 2 → promote to a new NPC note
7. Approve a suggested wikilink
8. Export the session

Confirm the export contains the inline `## Session Log` section **and** a separate file for the promoted note, and that the promoted note contains the approved `[[link]]`.

### Step 4. Write the evidence file

Record the run in `docs/specs/session-log-note-capture/ss12-integration-evidence.md`: each step, what was observed, and the actual export file list. Paste real output — do not summarise from expectation.

### Step 5. Commit

> **`docs/` is gitignored in this repo.** A plain `git add` on the evidence file
> silently no-ops, the artifact never lands in the commit, and the
> commit-advance gate reads the sub-spec as hollow success and defers it.
> Use `-f`.

```bash
git add src/features/session/SessionQuickActions.tsx
git add -f docs/specs/session-log-note-capture/ss12-integration-evidence.md
git commit -m "feat(session): route in-session capture to the session log [factory-managed]"
git ls-files --error-unmatch docs/specs/session-log-note-capture/ss12-integration-evidence.md
```

## Verification Commands

```bash
npm run build
npm test
npm run preview
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| FAB opens SessionLog | [STRUCTURAL] | `grep -q "SessionLog" src/features/session/SessionQuickActions.tsx \|\| (echo "FAIL: FAB does not open SessionLog" && exit 1)` |
| QuickNoteAction removed from session flow | [MECHANICAL] | `[ $(grep -c "QuickNoteAction" src/features/session/SessionQuickActions.tsx) -eq 0 ] \|\| (echo "FAIL: QuickNoteAction still in the session quick actions" && exit 1)` |
| QuickNoteDrawer still exists in the codebase | [MECHANICAL] | `[ $(grep -rc "QuickNoteDrawer" src/ \| grep -v ":0" \| wc -l) -ge 1 ] \|\| (echo "FAIL: QuickNoteDrawer was deleted — that is a human decision" && exit 1)` |
| Evidence file written | [STRUCTURAL] | `test -f docs/specs/session-log-note-capture/ss12-integration-evidence.md \|\| (echo "FAIL: integration evidence file missing" && exit 1)` |
| Build and tests pass | [MECHANICAL] | `npm run build > /dev/null 2>&1 && npm test > /dev/null 2>&1 \|\| (echo "FAIL: build or tests failed" && exit 1)` |
