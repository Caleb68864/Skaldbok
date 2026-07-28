---
type: phase-spec
sub_spec_id: SS-07
phase: run
depends_on: ['SS-02', 'SS-04', 'SS-06']
wave: 4
master_spec: "docs/specs/2026-07-27-session-log-note-capture.md"
---

# SS-07 — Promote-entries sheet

## Scope

Given a selection of log entries: promote to a **new note**, **append to an existing note**, or **tag** without promoting. Source entries are never deleted; each gains a `promoted_into` link. Embeds `SuggestedLinksPanel` scoped to the selection.

## Transactional requirement

The whole promote must be **one `db.transaction('rw', …)`** spanning the notes and entityLinks tables. A partial promote — note created, links missing — silently loses lineage with no error surfaced. The project already wraps multi-table cascades in a transaction (see the soft-delete convention in `CLAUDE.md`).

## Interface Contracts

### Consumes promoted_into
- Direction: SS-02 → SS-07 — *implements contract from SS-02*

### Consumes log repository
- Direction: SS-04 → SS-07 — reads entries, creates the target note

### Consumes SuggestedLinksPanel
- Direction: SS-06 → SS-07 — *implements contract from SS-06*

### PromoteEntriesSheet
- Direction: SS-07 → SS-13
- Owner: SS-07
- Shape: `PromoteEntriesSheet(props: { entries: Note[]; open: boolean; onClose: () => void; onPromoted: (targetNoteId: string) => void }): JSX.Element | null`

## Implementation Steps

### Step 1. Build the concatenation helper (pure, testable)

Given selected entries, sort by `createdAt` ascending and build the target body: each entry as its own paragraph prefixed with its `HH:mm` timestamp. This is pure and must be unit-tested — it is the part of SS-07 verifiable without a DOM.

Title prefill: first ~60 characters of the earliest entry's text, trimmed at a word boundary.

### Step 2. New-note path

Render the existing 6 selectable types (`generic`, `location`, `loot`, `rumor`, `quote`, `recap`) as chips, matching `SELECTABLE_NOTE_TYPES` in `QuickNoteAction.tsx`. Do **not** offer `log` as a target type.

Inside one `db.transaction('rw', [db.notes, db.entityLinks], …)`:
1. Create the target note.
2. Create one `promoted_into` link per source entry.

### Step 3. Append-to-existing path

Searchable picker backed by `useNoteSearch` (MiniSearch over title/bodyText/tags/descriptors). On confirm, in one transaction: append the concatenated entries to the target's body under a `---` divider, and create the `promoted_into` links. **Leave the target's title unchanged.**

### Step 4. Tag path

Apply tags to the selected entries without creating a target note and without creating links.

### Step 5. Never delete sources

No path deletes or archives source entries. After any promote, all sources still exist with `deletedAt` unset. This is the property that keeps the raw log intact.

### Step 6. Embed the suggestions panel

Run `scanForLinks` over the selected entries and render `SuggestedLinksPanel`. Approvals apply via `applySuggestionToBody` to the **target** note body before it is written.

Scan input must be **raw body text only** — do not feed the timestamp-prefixed
concatenation to the scanner, or `[HH:mm]` fragments such as "PM" surface as
"create this NPC?" candidates. The promoted note body still keeps its
timestamps; only the scan input differs.

### Step 7. Verify and commit

```bash
npm test && npm run build && npm run preview
git add src/features/notes/PromoteEntriesSheet.tsx
git commit -m "feat(notes): promote log entries into notes [factory-managed]"
```

## Verification Commands

```bash
npm test
npm run build
npm run preview
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Sheet exported | [STRUCTURAL] | `grep -q "export function PromoteEntriesSheet" src/features/notes/PromoteEntriesSheet.tsx \|\| (echo "FAIL: PromoteEntriesSheet not exported" && exit 1)` |
| Promote is transactional | [STRUCTURAL] | `grep -q "db.transaction" src/features/notes/PromoteEntriesSheet.tsx \|\| (echo "FAIL: promote is not wrapped in a transaction" && exit 1)` |
| Creates promoted_into links | [STRUCTURAL] | `grep -q "promoted_into" src/features/notes/PromoteEntriesSheet.tsx \|\| (echo "FAIL: no promoted_into links created" && exit 1)` |
| Never deletes source entries | [MECHANICAL] | `[ $(grep -cE "softDelete\|hardDelete\|deleteNote" src/features/notes/PromoteEntriesSheet.tsx) -eq 0 ] \|\| (echo "FAIL: promote path deletes source entries" && exit 1)` |
| Uses existing search for the picker | [STRUCTURAL] | `grep -q "useNoteSearch" src/features/notes/PromoteEntriesSheet.tsx \|\| (echo "FAIL: append-to-existing does not use useNoteSearch" && exit 1)` |
| Build and tests pass | [MECHANICAL] | `npm run build > /dev/null 2>&1 && npm test > /dev/null 2>&1 \|\| (echo "FAIL: build or tests failed" && exit 1)` |
