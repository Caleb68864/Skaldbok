---
sub_spec_id: SS-03
phase: run
depends_on: ['SS-01', 'SS-02']
dispatch: factory
---

# Sub-Spec 3 — Remove the openQuickLog plumbing and rewire its callers

## Scope

Delete the quick-log request members from `SessionRefreshContext` and rewire the
two remaining callers to navigate to `/session/log`.

## Files

- **Files (modify):**
  - `src/features/session/SessionRefreshContext.tsx`
  - `src/screens/SessionScreen.tsx`
  - `src/features/kb/VaultBrowser.tsx`

## Decisions

- **Remove exactly four members**, and nothing else: `openQuickLog`,
  `clearQuickLogRequest`, `requestedQuickLogAction`, `requestedQuickLogNonce`.
  Each appears in **four** places in `SessionRefreshContext.tsx` — the interface
  type (lines ~30-44), the `useState` declarations (lines 68-69), the
  `useCallback` definitions (lines 77-83), and **both** the `useMemo` value
  object *and* its dependency array (lines 92-106). Missing the deps array is
  the easy error; `tsc -b` will catch it.
- **Do not touch** `timelineRefreshToken`, `sessionNotesRefreshToken`,
  `bumpTimeline`, `bumpSessionNotes` or `bumpAll`. They are unrelated and
  load-bearing.
- **`VaultBrowser` button:** keep its position and styling; change only the
  label and handler. Suggested label: `Open Session Log`. It already imports
  `useNavigate` (used by the adjacent Knowledge Base button at line ~360), so
  reuse that.
- **`VaultBrowser` copy:** the empty state currently reads "Use Quick Log for
  fast captures during play, encounter logs for scene-specific details, and
  session notes for recap, clues, and cleanup." That describes a surface that no
  longer exists. Replace it with copy describing the log-then-promote flow — for
  example: "Write into the session log during play, then promote the entries
  that matter into notes." The string `Quick Log` must not survive anywhere in
  this file.
- **`SessionScreen`:** `onAddToTimeline` (line ~584) currently calls
  `openQuickLog('note')`. It becomes a navigation to `/session/log`. Remove
  `openQuickLog` from the `useSessionRefresh()` destructuring at line ~323.

## Implementation Steps

### Step 1. Confirm the only callers

```bash
grep -rn "openQuickLog\|requestedQuickLog\|clearQuickLogRequest" src/
```

Expect matches in exactly three files: `SessionRefreshContext.tsx`,
`SessionScreen.tsx`, `VaultBrowser.tsx`. If `GlobalFAB.tsx` still appears, SS-01
has not landed — stop and report.

### Step 2. Rewire SessionScreen

Remove `openQuickLog` from the `useSessionRefresh()` destructuring. Add
`useNavigate` if not already imported. Change `onAddToTimeline` to
`() => navigate('/session/log')`.

### Step 3. Rewire VaultBrowser

Change the button's `onClick` to `() => navigate('/session/log')` and its label
to `Open Session Log`. Rewrite the surrounding empty-state copy per Decisions.
Remove the now-unused `sessionRefresh` reference if nothing else in the file
uses it — check first; other call sites may exist.

### Step 4. Strip the context

Remove the four members from all four locations in `SessionRefreshContext.tsx`,
including the `useMemo` dependency array. Also delete the JSDoc blocks
documenting `openQuickLog` and `clearQuickLogRequest` (lines ~30-42) — they
describe the deleted FAB drawer contract.

### Step 5. Build

```bash
npm run build
```

Expect exit 0. A stale member left in the deps array or the value object fails
here.

### Step 6. Confirm

```bash
grep -rn "openQuickLog\|requestedQuickLog\|clearQuickLogRequest" src/
grep -c "Quick Log" src/features/kb/VaultBrowser.tsx
```

Both expect zero results.

### Step 7. Commit

```bash
git add src/features/session/SessionRefreshContext.tsx src/screens/SessionScreen.tsx src/features/kb/VaultBrowser.tsx
git commit -m "refactor(session): drop the quick-log request plumbing [factory-managed]"
```

## Interface Contracts

### SessionRefreshContext quick-log members

- Direction: Sub-spec 1, Sub-spec 2 → Sub-spec 3
- Owner: Sub-spec 3
- Shape: SS-03 may delete `openQuickLog`, `clearQuickLogRequest`,
  `requestedQuickLogAction` and `requestedQuickLogNonce` only once no consumer
  outside this sub-spec's three files references them. Verified by Step 1.

### SessionRefreshContext retained members

- Direction: Sub-spec 3 → all other consumers
- Owner: Sub-spec 3
- Shape: `{ timelineRefreshToken: number, sessionNotesRefreshToken: number,
  bumpTimeline: () => void, bumpSessionNotes: () => void, bumpAll: () => void }`
  must remain exported and behaviourally unchanged.

## Verification Commands

```bash
npm run build
grep -rn "openQuickLog\|requestedQuickLog\|clearQuickLogRequest" src/
grep -c "Quick Log" src/features/kb/VaultBrowser.tsx
grep -c "bumpAll" src/features/session/SessionRefreshContext.tsx
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| No quick-log request members remain | [MECHANICAL] | `! grep -rqn "openQuickLog\|requestedQuickLog\|clearQuickLogRequest" src/ \|\| (echo "FAIL: quick-log request plumbing remains" && exit 1)` |
| Refresh tokens retained | [STRUCTURAL] | `grep -q "bumpAll" src/features/session/SessionRefreshContext.tsx && grep -q "timelineRefreshToken" src/features/session/SessionRefreshContext.tsx \|\| (echo "FAIL: refresh members were removed" && exit 1)` |
| SessionScreen navigates to the log | [STRUCTURAL] | `grep -q "/session/log" src/screens/SessionScreen.tsx \|\| (echo "FAIL: SessionScreen does not navigate to /session/log" && exit 1)` |
| VaultBrowser navigates to the log | [STRUCTURAL] | `grep -q "/session/log" src/features/kb/VaultBrowser.tsx \|\| (echo "FAIL: VaultBrowser does not navigate to /session/log" && exit 1)` |
| VaultBrowser copy no longer says Quick Log | [MECHANICAL] | `[ $(grep -c "Quick Log" src/features/kb/VaultBrowser.tsx) -eq 0 ] \|\| (echo "FAIL: VaultBrowser still mentions Quick Log" && exit 1)` |
| Project builds | [MECHANICAL] | `npm run build \|\| (echo "FAIL: npm run build failed" && exit 1)` |

## Behavioral Criteria (manual / reviewer judgment)

- On the Session tab, the timeline's "Add to Timeline" button navigates to
  `/session/log`.
- The Session Notes panel's empty state offers a button that reaches the log,
  and its copy describes the log-then-promote flow.
