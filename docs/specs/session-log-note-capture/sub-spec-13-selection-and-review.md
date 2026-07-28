---
type: phase-spec
sub_spec_id: SS-13
phase: run
depends_on: ['SS-07', 'SS-08']
wave: 5
master_spec: "docs/specs/2026-07-27-session-log-note-capture.md"
---

# SS-13 — Entry selection, promote entry point, and the review sweep

## Scope

Layer selection onto `SessionLog`: tap-to-select, an action bar that opens `PromoteEntriesSheet`, promoted-entry badges, and a **Review** action that scans the whole session.

## Why this is separate from SS-08

Split out during red-team. SS-08 combined capture, correction, selection, promotion and review — the largest sub-spec in the run and the highest defer risk. Capture must land cleanly on its own; selection is additive.

## The review sweep is the AAR pass

The design specifies **two** placements for the link scanner: scoped to a selection (SS-07), and swept across the whole log (here). The sweep is what turns a session's raw log into the after-action report, and it is where "*Ostrand* appears in 4 entries and has no NPC note" pays off. It had no acceptance criterion before red-team caught it.

## Interface Contracts

### Consumes PromoteEntriesSheet
- Direction: SS-07 → SS-13 — *implements contract from SS-07*

### Consumes SessionLog entry list
- Direction: SS-08 → SS-13 — the session's log entries and their `promoted_into` links

### Consumes scanForLinks
- Direction: SS-05 → SS-13 — called with **all** session entries, not just the selection

### SessionLogSelection
- Direction: SS-13 → SS-12
- Owner: SS-13
- Shape: `SessionLogSelection(props: { entries: Note[]; campaignId: string; onEditEntry; onPromoted; renderEntry }): JSX.Element`

> **Accepted deviation.** The contract originally declared a `sessionId`
> prop. The shipped component has none and does not need one — `entries` is
> already scoped to the session by the caller, so `sessionId` would be an
> unused parameter inviting a second source of truth.

## Implementation Steps

### Step 1. Selection state

Hold `selectedIds: string[]`. Tapping an entry toggles membership. Selection must not interfere with SS-08's tap-to-edit — enter selection mode explicitly (a Select button or long-press-to-start-selecting), then plain taps toggle.

Resolve the interaction collision deliberately: SS-08 binds tap→edit and long-press→delete. Recommended default: a **Select** button in the header enters selection mode; while in selection mode, tap toggles and edit/delete are suppressed. Exiting selection mode restores SS-08 behaviour.

### Step 2. Action bar

When `selectedIds.length > 0`, render an action bar with **Promote**, **Tag** and **Clear**. Promote opens `PromoteEntriesSheet` with exactly the selected entries.

### Step 3. Promoted badges

For entries with a `promoted_into` link, render a badge referencing the target note and linking to it. Query via `getLinksFrom(entryId, 'promoted_into')`.

### Step 4. Review sweep

A **Review** action in the header runs `scanForLinks` over **every** entry in the session — not the selection — and renders `SuggestedLinksPanel` with the results, including missing-record candidates. Build the dictionary from party members, campaign NPC creature templates and note titles.

### Step 5. Verify

```bash
npm run build && npm run preview
```

Manual: selecting 2+ entries reveals the action bar; opening it shows the sheet with exactly those entries; Review lists suggestions drawn from the whole session, not just the selection.

### Step 6. Commit

```bash
git add src/features/session/sessionLog/SessionLogSelection.tsx
git commit -m "feat(session): log entry selection, promote entry point and review sweep [factory-managed]"
```

## Verification Commands

```bash
npm run build
npm run preview
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Selection surface exported | [STRUCTURAL] | `grep -q "export function SessionLogSelection" src/features/session/sessionLog/SessionLogSelection.tsx \|\| (echo "FAIL: SessionLogSelection not exported" && exit 1)` |
| Opens the promote sheet | [STRUCTURAL] | `grep -q "PromoteEntriesSheet" src/features/session/sessionLog/SessionLogSelection.tsx \|\| (echo "FAIL: action bar does not open PromoteEntriesSheet" && exit 1)` |
| Review scans all entries | [STRUCTURAL] | `grep -q "scanForLinks" src/features/session/sessionLog/SessionLogSelection.tsx \|\| (echo "FAIL: no review sweep" && exit 1)` |
| Promoted badge reads the link | [STRUCTURAL] | `grep -q "promoted_into" src/features/session/sessionLog/SessionLogSelection.tsx \|\| (echo "FAIL: no promoted badge" && exit 1)` |
| Build passes | [MECHANICAL] | `npm run build > /dev/null 2>&1 \|\| (echo "FAIL: npm run build failed" && exit 1)` |
