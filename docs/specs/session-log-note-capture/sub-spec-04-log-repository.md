---
type: phase-spec
sub_spec_id: SS-04
phase: run
depends_on: ['SS-01']
wave: 2
master_spec: "docs/specs/2026-07-27-session-log-note-capture.md"
---

# SS-04 — Log-entry repository methods

## Scope

Add `listLogEntriesBySession`, `createLogEntry` and `updateLogEntry` to `src/storage/repositories/noteRepository.ts`.

## This is mostly reuse

`noteRepository` **already exports** `getNotesBySession`, `createNote`, `updateNote` and `softDelete`. The new methods are thin, well-named wrappers — not new machinery. In particular `updateNote(id, data: Partial<Note>)` already preserves any field not passed, so **preserving `createdAt` on edit is free**: simply do not pass it.

Follow `campaignRepository.ts` as the template — **not** `characterRepository.ts`, which is legacy.

## Interface Contracts

### listLogEntriesBySession
- Direction: SS-04 → SS-08, SS-13
- Owner: SS-04
- Shape: `listLogEntriesBySession(sessionId: string): Promise<Note[]>` — `type === 'log'` only, sorted by `createdAt` ascending, soft-deleted excluded

### createLogEntry
- Direction: SS-04 → SS-08
- Owner: SS-04
- Shape: `createLogEntry(sessionId: string, campaignId: string, text: string): Promise<Note>` — body built with `textToDoc(text)` from SS-01

### updateLogEntry
- Direction: SS-04 → SS-08
- Owner: SS-04
- Shape: `updateLogEntry(id: string, text: string): Promise<Note>` — replaces body, refreshes `updatedAt`, leaves `createdAt` untouched

## Implementation Steps

### Step 1. `listLogEntriesBySession`

Delegate to the existing `getNotesBySession(sessionId)` (which already excludes soft-deleted rows), then filter `n.type === 'log'` and sort by `createdAt` ascending. Wrap in try/catch with `throw new Error(\`noteRepository.listLogEntriesBySession failed: ${e}\`)`.

### Step 2. `createLogEntry`

Delegate to `createNote` with:

```
{ campaignId, sessionId, type: 'log', title: '', body: textToDoc(text),
  status: 'active', pinned: false, typeData: {} }
```

`title: ''` is deliberate and safe — `generateFilename` already falls back to `note-<idSuffix>.md` for empty titles.

### Step 3. `updateLogEntry`

Delegate to `updateNote(id, { body: textToDoc(text), updatedAt: nowISO() })`. **Do not pass `createdAt`** — omitting it is what preserves the entry's timeline position.

### Step 4. Verify

```bash
npm run build
npm test
```

### Step 5. Commit

```bash
git add src/storage/repositories/noteRepository.ts
git commit -m "feat(notes): log-entry repository methods [factory-managed]"
```

## Verification Commands

```bash
npm run build
npm test
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| listLogEntriesBySession exported | [STRUCTURAL] | `grep -q "export async function listLogEntriesBySession" src/storage/repositories/noteRepository.ts \|\| (echo "FAIL: listLogEntriesBySession missing" && exit 1)` |
| createLogEntry exported | [STRUCTURAL] | `grep -q "export async function createLogEntry" src/storage/repositories/noteRepository.ts \|\| (echo "FAIL: createLogEntry missing" && exit 1)` |
| updateLogEntry exported | [STRUCTURAL] | `grep -q "export async function updateLogEntry" src/storage/repositories/noteRepository.ts \|\| (echo "FAIL: updateLogEntry missing" && exit 1)` |
| updateLogEntry does not set createdAt | [MECHANICAL] | `! sed -n '/export async function updateLogEntry/,/^}/p' src/storage/repositories/noteRepository.ts \| grep -q "createdAt" \|\| (echo "FAIL: updateLogEntry touches createdAt" && exit 1)` |
| Build and tests pass | [MECHANICAL] | `npm run build > /dev/null 2>&1 && npm test > /dev/null 2>&1 \|\| (echo "FAIL: build or tests failed" && exit 1)` |
