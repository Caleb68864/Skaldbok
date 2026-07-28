---
type: phase-spec
sub_spec_id: SS-06
phase: run
depends_on: ['SS-05']
wave: 3
master_spec: "docs/specs/2026-07-27-session-log-note-capture.md"
---

# SS-06 — Suggested-links panel

## Scope

UI over `scanForLinks` output. Per-row Approve / Dismiss plus bulk approve. Approving replaces the matched span with a `wikiLink` node. Missing-record candidates offer "create NPC note". Dismissals persist.

## Interface Contracts

### Consumes scanForLinks
- Direction: SS-05 → SS-06
- Owner: SS-05
- Shape: *implements contract from SS-05*

### SuggestedLinksPanel
- Direction: SS-06 → SS-07, SS-13
- Owner: SS-06
- Shape: `SuggestedLinksPanel(props: { suggestions; missingRecords; onApprove: (key: string) => void; onDismiss: (key: string) => void; onApproveAll: () => void; onCreateRecord: (name: string) => void }): JSX.Element`

### applySuggestionToBody
- Direction: SS-06 → SS-07, SS-13
- Owner: SS-06
- Shape: `applySuggestionToBody(bodyText: string, suggestion: LinkScanSuggestion): ProseMirrorNode` — pure; returns a doc with the matched span replaced by a `wikiLink` node

> **Accepted deviation.** This contract originally specified
> `applySuggestionToDoc(doc, suggestion) → doc`. The build produced a
> text-in/node-out shape instead, which fits the promote pipeline (text-based
> until the final `textToDoc`) and is the form verified working end to end by
> the SS-12 Playwright run. Renaming to the doc-shaped contract would have
> risked regressing the only path proven in a browser, so the contract was
> aligned to the code rather than the reverse. Recorded, not silently changed.

## Implementation Steps

### Step 1. Extract the pure transform first

Put `applySuggestionToBody` in the same module but keep it **pure and separately testable** — this is the only part of SS-06 that can be verified without a DOM, so it carries the real assertions. It walks the doc, finds the text node containing `matchedText`, and splits it into `text` / `wikiLink` / `text`.

### Step 2. Test the transform

Add tests asserting the returned doc contains a `wikiLink` node with the target label and that surrounding text is preserved. Assert on the **object**, not rendered DOM.

### Step 3. Build the panel

Render one row per suggestion: matched text, proposed target, and a confidence indicator that makes fuzzy visibly distinct from exact (fuzzy suggestions come from handwriting errors and deserve more scrutiny). Add Approve / Dismiss per row and a bulk Approve all.

Render `missingRecords` as a separate group with a "create NPC note" action.

### Step 4. Persist dismissals

Store dismissed `key`s in app settings, scoped per campaign, following the existing `settings.customTags` pattern in `QuickNoteDrawer`. The persisted value is what the `[BEHAVIORAL]` check asserts against — not the DOM.

### Step 5. Verify

```bash
npm test && npm run build && npm run preview
```

### Step 6. Commit

```bash
git add src/features/notes/SuggestedLinksPanel.tsx
git commit -m "feat(notes): suggested-links panel with approve/dismiss [factory-managed]"
```

## Verification Commands

```bash
npm test
npm run build
npm run preview   # manual: fuzzy vs exact styling, bulk approve
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Panel exported | [STRUCTURAL] | `grep -q "export function SuggestedLinksPanel" src/features/notes/SuggestedLinksPanel.tsx \|\| (echo "FAIL: SuggestedLinksPanel not exported" && exit 1)` |
| Pure transform exported | [STRUCTURAL] | `grep -q "export function applySuggestionToBody" src/features/notes/SuggestedLinksPanel.tsx \|\| (echo "FAIL: applySuggestionToBody not exported" && exit 1)` |
| Produces wikiLink nodes | [STRUCTURAL] | `grep -q "wikiLink" src/features/notes/SuggestedLinksPanel.tsx \|\| (echo "FAIL: approve does not emit wikiLink nodes" && exit 1)` |
| Dismissals persisted to settings | [STRUCTURAL] | `grep -qi "updateSettings\|settings\." src/features/notes/SuggestedLinksPanel.tsx \|\| (echo "FAIL: dismissals not persisted" && exit 1)` |
| Build and tests pass | [MECHANICAL] | `npm run build > /dev/null 2>&1 && npm test > /dev/null 2>&1 \|\| (echo "FAIL: build or tests failed" && exit 1)` |
