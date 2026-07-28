---
type: phase-spec
sub_spec_id: SS-11
phase: run
depends_on: ['SS-01']
wave: 2
master_spec: "docs/specs/2026-07-27-session-log-note-capture.md"
---

# SS-11 — AAR export: log entries as one chronological section

## Scope

`renderSessionBundle` renders log entries as a **single chronological section inside the session index file**, not one `.md` per entry. Promoted notes keep their own files.

## The regression risk

`renderSessionBundle` currently emits one file per linked note. With 80 log entries that becomes 80 files, which destroys the export. Equally important in the other direction: **output for sessions with no log entries must be byte-identical to today** — this function produces the after-action report the user sends to their group, and silent format drift would be discovered only after sending.

## Interface Contracts

None outward. Consumes `docToText` from SS-01 to render entry bodies.

## Implementation Steps

### Step 1. Partition the notes

In `renderSessionBundle(session, linkedNotes, entityLinks)`, split `linkedNotes` into `logEntries` (`type === 'log'`) and `otherNotes` (everything else) before the existing per-note file loop.

### Step 2. Restrict the per-note loop

The existing loop that calls `generateFilename` and `renderNoteToMarkdown` must iterate **`otherNotes` only**. Log entries must never reach it.

### Step 3. Render the log section into the session index

Sort `logEntries` by `createdAt` ascending. Render into the session index file, after the existing session content:

```markdown
## Session Log

**19:42** — Harbourmaster is called Ostrand. Takes bribes on Tuesdays.

**19:51** — Second ship in the berth; nobody will say whose.
```

Use `docToText` (SS-01) for the body so `[[wikilinks]]` survive as `[[label]]`. Format the timestamp as local `HH:mm` from `createdAt`.

### Step 4. Guard the empty case

If `logEntries.length === 0`, **emit no `## Session Log` heading at all**. An empty section would change existing output and break byte-identity.

### Step 5. Verify byte-identity for the no-log case

```bash
npm test
npm run build
```

Add a test asserting that a session with only non-log notes produces exactly the same file map as before the change.

### Step 6. Commit

```bash
git add src/utils/export/renderSession.ts
git commit -m "feat(export): render session log as one chronological section [factory-managed]"
```

## Verification Commands

```bash
npm test
npm run build
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Log entries partitioned out of the per-note loop | [STRUCTURAL] | `grep -q "'log'" src/utils/export/renderSession.ts \|\| (echo "FAIL: renderSession does not partition log entries" && exit 1)` |
| Session Log heading emitted | [STRUCTURAL] | `grep -q "Session Log" src/utils/export/renderSession.ts \|\| (echo "FAIL: no Session Log section" && exit 1)` |
| docToText used so wikilinks survive | [STRUCTURAL] | `grep -q "docToText" src/utils/export/renderSession.ts \|\| (echo "FAIL: log bodies not rendered via docToText" && exit 1)` |
| Tests pass (incl. byte-identity guard) | [MECHANICAL] | `npm test 2>&1 \| tail -3 ; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: export tests failed" && exit 1)` |
| Build passes | [MECHANICAL] | `npm run build > /dev/null 2>&1 \|\| (echo "FAIL: npm run build failed" && exit 1)` |
