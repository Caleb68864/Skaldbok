---
type: phase-spec
sub_spec_id: SS-08
phase: run
depends_on: ['SS-03', 'SS-04']
wave: 3
master_spec: "docs/specs/2026-07-27-session-log-note-capture.md"
---

# SS-08 — `SessionLog` screen and route (capture only)

## Scope

The in-session capture screen: chronological entry list, docked `WritePad`, commit / edit / delete, and the no-active-session guard.

**Selection, promotion and the review sweep are SS-13.** This sub-spec is capture and correction only — the split was made during red-team because the combined sub-spec was the highest defer risk in the run.

## The success metric this screen owns

Capturing a thought must take **at most 2 taps** from the session screen (open log → commit), versus today's minimum of 5. Any design choice that adds a tap is a regression.

## Interface Contracts

### Consumes WritePad
- Direction: SS-03 → SS-08 — *implements contract from SS-03*

### Consumes log repository
- Direction: SS-04 → SS-08 — `listLogEntriesBySession`, `createLogEntry`, `updateLogEntry`, plus existing `softDelete`

### SessionLog
- Direction: SS-08 → SS-12, SS-13
- Owner: SS-08
- Shape: `SessionLog(): JSX.Element` — route-level component reading the active session from context

## Implementation Steps

### Step 1. No-session guard first

Read the active session from `CampaignContext` / session context. If absent, render a "Start a session to begin logging" prompt with a button that starts one, and **no writing surface**. Build this branch first — it is the state a worker is most likely to skip.

### Step 2. Load and render entries

`listLogEntriesBySession(sessionId)` on mount. Render chronologically with `HH:mm` timestamps, body via `docToText`. Auto-scroll to newest.

### Step 3. Dock `WritePad` and commit

Render `WritePad` docked below the list. `onCommit` calls `createLogEntry(sessionId, campaignId, text)`, prepends the result to local state, and clears the draft.

**Wrap the commit in try/catch.** On failure, retain the draft text and toast — an entry must never be silently dropped (IndexedDB quota is the realistic trigger). `WritePad` already keeps the text when `onCommit` rejects, so simply let the rejection propagate rather than swallowing it.

### Step 4. Tap to edit

Tapping an entry reopens `WritePad` seeded with `docToText(entry.body)`. Committing calls `updateLogEntry(id, text)`, which preserves `createdAt` and therefore the entry's position.

### Step 5. Long-press to delete

Long-press calls the existing `noteRepository.softDelete(id)`. **Never `hardDelete`** — it is irreversible and banned from UI paths by project convention. The row disappears; Trash can restore it.

### Step 6. Register the route

`src/routes/index.tsx` is a static `RouteObject[]` with eager imports under `ShellLayout`. Add the import and a route entry alongside the other session routes.

### Step 7. Verify

```bash
npm run build && npm test && npm run preview
```

Manual: commit clears the field and leaves the caret in place; tap-to-edit and long-press-to-delete work by touch; the no-session prompt renders.

### Step 8. Commit

```bash
git add src/features/session/sessionLog/SessionLog.tsx src/routes/index.tsx
git commit -m "feat(session): SessionLog capture screen and route [factory-managed]"
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
| SessionLog exported | [STRUCTURAL] | `grep -q "export function SessionLog" src/features/session/sessionLog/SessionLog.tsx \|\| (echo "FAIL: SessionLog not exported" && exit 1)` |
| Route registered | [STRUCTURAL] | `grep -q "SessionLog" src/routes/index.tsx \|\| (echo "FAIL: SessionLog route not registered" && exit 1)` |
| No-session guard present | [STRUCTURAL] | `grep -qi "start a session" src/features/session/sessionLog/SessionLog.tsx \|\| (echo "FAIL: no-active-session guard missing" && exit 1)` |
| Uses softDelete, never hardDelete | [MECHANICAL] | `[ $(grep -c "hardDelete" src/features/session/sessionLog/SessionLog.tsx) -eq 0 ] \|\| (echo "FAIL: SessionLog calls hardDelete" && exit 1)` |
| Commit path is failure-safe | [STRUCTURAL] | `grep -q "catch" src/features/session/sessionLog/SessionLog.tsx \|\| (echo "FAIL: commit path has no try/catch" && exit 1)` |
| Build and tests pass | [MECHANICAL] | `npm run build > /dev/null 2>&1 && npm test > /dev/null 2>&1 \|\| (echo "FAIL: build or tests failed" && exit 1)` |
