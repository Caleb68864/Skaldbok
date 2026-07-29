---
sub_spec_id: SS-06
phase: verify
depends_on: ['SS-01', 'SS-02', 'SS-03', 'SS-04', 'SS-05']
dispatch: factory
---

# Sub-Spec 6 — End-to-end verification and evidence

## Scope

Run the full verification pass across the assembled change and record the result.
**No source files are modified in this sub-spec.** If a defect is found, report
it rather than patching it here — a failure absorbed into an unrelated sub-spec
is a failure that never gets seen.

Traveller only. Per standing project convention Dragonbane is not re-tested
unless its code was touched, and none of this work touches the system engine or
the character sheet.

This sub-spec serves as the spec's integration sub-spec; no additional one is
auto-generated.

## Files

- **Files (new):**
  - `docs/specs/ss06-notes-overhaul-integration-evidence.md`

## Decisions

- **The evidence file is not committed by default (red-team A-4, corrected).**
  `docs/` is listed in `.gitignore`, so a new file under it is skipped by
  `git add -A` and the closer must **not** report a failure when git ignores it.
  The original wording went further and claimed such files are "never tracked by
  git" — that is false: 28 files under `docs/` are tracked via force-add
  (`git ls-files docs/`), including `docs/decisions.md`, which this branch
  commits on every pass because a pre-commit hook requires it. Force-add the
  evidence file only if you deliberately want it in history.
- **Anti-hollow-success guard:** because the normal docs-only guard (a final
  `git commit` step) would be a no-op here, it is replaced by a content check —
  the evidence file must exist on disk and contain the verbatim stdout of both
  `npm run build` and `npm test`, including the test count. A worker that writes
  a summary without pasted command output has not run the commands.
- **Baseline:** capture `npm test`'s pass count **before** any of this work
  landed by running it against the merge-base, so the "no count regression"
  claim is grounded in a number rather than an assertion.

## Implementation Steps

### Step 1. Capture the baseline test count

```bash
git stash list  # note state
npm test 2>&1 | tail -5
```

Record the pass/fail counts. If a pre-change baseline is unavailable, state that
explicitly in the evidence file rather than inventing one.

### Step 2. Build

```bash
npm run build
```

Capture stdout verbatim. Expect exit 0.

### Step 3. Test

```bash
npm test
```

Capture stdout verbatim. Expect exit 0 and no count regression versus Step 1.

### Step 4. Confirm the deletions

```bash
grep -rn "SessionQuickActions\|QuickLogPCTray\|QuickNpcAction\|AttachToControl\|openQuickLog" src/
```

Expect no output. Capture the command and its (empty) result.

### Step 5. Run the app and execute the integration flows

Start the app (`npm run dev`, or `build-and-run.bat` for LAN tablet testing) and
execute each `[INTEGRATION]` and `[BEHAVIORAL]` criterion below against a
Traveller campaign. Record pass/fail per flow with a one-line note.

### Step 6. Write the evidence file

Write `docs/specs/ss06-notes-overhaul-integration-evidence.md` containing:

- The verbatim stdout of `npm run build` and `npm test`.
- Baseline vs. post-change test counts.
- The grep command and its empty result.
- A pass/fail line per integration and behavioral flow.
- Any defect found, stated plainly, with the sub-spec it belongs to.

Do **not** run `git add` or `git commit` on this file — `docs/` is gitignored and
the command would be a no-op that reads as success.

## Interface Contracts

### All sub-specs → SS-06

- Direction: Sub-specs 1-5 → Sub-spec 6
- Owner: Sub-spec 6
- Shape: SS-06 requires all five prior sub-specs merged. It verifies their
  combined behaviour and produces no code.

## Verification Commands

```bash
npm run build
npm test
grep -rn "SessionQuickActions\|QuickLogPCTray\|QuickNpcAction\|AttachToControl\|openQuickLog" src/
test -f docs/specs/ss06-notes-overhaul-integration-evidence.md
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Project builds | [MECHANICAL] | `npm run build \|\| (echo "FAIL: npm run build failed" && exit 1)` |
| Tests pass | [MECHANICAL] | `npm test \|\| (echo "FAIL: npm test failed" && exit 1)` |
| No deleted symbols remain | [MECHANICAL] | `! grep -rqn "SessionQuickActions\|QuickLogPCTray\|QuickNpcAction\|AttachToControl\|openQuickLog" src/ \|\| (echo "FAIL: references to deleted symbols remain" && exit 1)` |
| Evidence file written | [STRUCTURAL] | `test -f docs/specs/ss06-notes-overhaul-integration-evidence.md \|\| (echo "FAIL: evidence file not written" && exit 1)` |
| Evidence contains real build output | [STRUCTURAL] | `grep -q "vite build\|tsc -b\|built in" docs/specs/ss06-notes-overhaul-integration-evidence.md \|\| (echo "FAIL: evidence file has no verbatim build output" && exit 1)` |
| Evidence contains real test output | [STRUCTURAL] | `grep -qi "test files\|passed\|vitest" docs/specs/ss06-notes-overhaul-integration-evidence.md \|\| (echo "FAIL: evidence file has no verbatim test output" && exit 1)` |
| Commit-failure code path intact | [STRUCTURAL] | `grep -q "throw" src/features/session/sessionLog/SessionLog.tsx \|\| (echo "FAIL: SessionLog.handleCommit no longer re-throws" && exit 1)` |

## Integration & Behavioral Criteria (manual)

- `[INTEGRATION]` Full flow: start a session → press the FAB → land full-screen
  on `/session/log` with no chips and no FAB overlap → commit three entries →
  tap one and edit it, confirming its original timestamp survives → select two
  entries and promote them to a new note → confirm the `Promoted` badge appears
  and the raw entries remain in the log → open the Session tab → confirm the
  promoted note appears in its type lane, the Log lane is **hidden** on first
  render, and enabling it in the track filter reveals the three entries showing
  their text.
- `[INTEGRATION]` Auto-logging intact: change HP on the character sheet and
  confirm a typed note is still written to the session and appears on the
  timeline.
- `[BEHAVIORAL]` Draft survival: type text into `WritePad` without committing,
  navigate to the Session tab, navigate back to `/session/log`, and confirm the
  draft text and any edit target are still present.
- `[HUMAN REVIEW]` Commit failure, manual: temporarily make
  `noteRepository.createLogEntry` throw in a dev run, commit an entry, and
  confirm the typed text is **retained** in the pad with an error toast rather
  than cleared. Revert the temporary change afterward.
- `[HUMAN REVIEW]` On the Tab S9 with the S Pen, the handwriting pad plus the
  entry list fit without the pad hiding content the user needs while writing.
