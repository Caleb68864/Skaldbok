---
type: phase-spec
sub_spec_id: SS-09
phase: run
depends_on: ['SS-01']
wave: 2
master_spec: "docs/specs/2026-07-27-session-log-note-capture.md"
---

# SS-09 — Hide log entries from the notes grid, keep them searchable

## Scope

Add an explicit `HIDDEN_NOTE_TYPES = ['log']` exclusion in `NotesGrid`, applied to **both** the pill-chip row and the "All" filter, plus an opt-in "Show log entries" toggle. Confirm log entries remain indexed by `useNoteSearch`, and give them a title fallback.

## Why this is explicit work, not a default

`NotesGrid` renders a filter pill chip **per `NoteType`** plus an "All" catch-all. Adding `'log'` to `NOTE_TYPES` in SS-01 therefore **automatically creates a "Log" chip and sweeps every entry into "All"** unless actively prevented. A 4-hour session is roughly 60–100 rows.

## Interface Contracts

### HIDDEN_NOTE_TYPES
- Direction: SS-09 (internal)
- Owner: SS-09
- Shape: `const HIDDEN_NOTE_TYPES: NoteType[] = ['log']`

## Implementation Steps

### Step 1. Define the exclusion

In `src/features/notes/NotesGrid.tsx`, add `HIDDEN_NOTE_TYPES` near the existing filter-option constant. Derive the pill-chip list from `NOTE_TYPES` **minus** `HIDDEN_NOTE_TYPES`.

### Step 2. Apply to the "All" filter

In the `filteredNotes` memo, drop notes whose `type` is in `HIDDEN_NOTE_TYPES` **unless** the show-log toggle is on. This must apply to the "All" branch, not only to the per-type branches — "All" is the default view and the one that would drown.

### Step 3. Add the toggle

A single checkbox or pill, "Show log entries", defaulting to off. When on, log entries appear and the "Log" chip becomes available.

### Step 4. Title fallback

Log entries always carry `title: ''`. Where the grid renders a note title, fall back to the first ~40 characters of the body's plain text (use `docToText` from SS-01, truncated) so rows are not blank.

### Step 5. Confirm search still indexes log entries

`useNoteSearch` indexes `title`, `bodyText`, `tags`, `descriptors`. Log entries must **remain** indexed — searching the raw log is a primary reason for keeping it. Verify no exclusion was introduced; add a comment recording the deliberate decision and the lazy-index fallback if load regresses.

### Step 6. Verify and commit

```bash
npm run build && npm test
git add src/features/notes/NotesGrid.tsx src/features/notes/useNoteSearch.ts
git commit -m "feat(notes): hide log entries from the grid, keep them searchable [factory-managed]"
```

## Verification Commands

```bash
npm run build
npm test
npm run preview   # manual: toggle off/on with log entries present
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| HIDDEN_NOTE_TYPES defined | [STRUCTURAL] | `grep -q "HIDDEN_NOTE_TYPES" src/features/notes/NotesGrid.tsx \|\| (echo "FAIL: HIDDEN_NOTE_TYPES not defined" && exit 1)` |
| Exclusion referenced more than once (chips + All) | [MECHANICAL] | `[ $(grep -c "HIDDEN_NOTE_TYPES" src/features/notes/NotesGrid.tsx) -ge 2 ] \|\| (echo "FAIL: exclusion applied in only one place" && exit 1)` |
| Title fallback present | [STRUCTURAL] | `grep -qi "docToText\|fallback" src/features/notes/NotesGrid.tsx \|\| (echo "FAIL: no title fallback for empty-title log entries" && exit 1)` |
| Search still indexes log entries | [MECHANICAL] | `! grep -qE "type *[=!]== *'log'\|filter.*'log'" src/features/notes/useNoteSearch.ts \|\| (echo "FAIL: useNoteSearch appears to exclude log entries" && exit 1)` |

> **Check-design note.** The original form of the check above was
> `! grep -q "'log'" …`, which reports FAIL against correct code: the file's
> own doc-comment explains the deliberate non-exclusion and contains the
> literal string `'log'`. A bare substring grep cannot distinguish a comment
> from a filter. The pattern now looks for an actual comparison or filter.
| Build and tests pass | [MECHANICAL] | `npm run build > /dev/null 2>&1 && npm test > /dev/null 2>&1 \|\| (echo "FAIL: build or tests failed" && exit 1)` |
