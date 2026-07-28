---
pass: 1
mode: standard
date: 2026-07-27
base: 5ad7566
head_after: d90482a
---

# Pass 1 — standard scan

Four parallel read-only scanners, one per topic area, each required to
**execute** `[MECHANICAL]` checks rather than read them.

## Result

**13 gaps found. 11 closed, 2 escalated to human decision.**
`clean_streak` reset to 0.

## Gaps and disposition

| # | Sub-spec | Gap | Severity | Disposition |
|---|----------|-----|----------|-------------|
| 1 | SS-05 | Fuzzy thresholds not length-scaled; one fixed edit distance of 2 for every name, no minimum length | **Severe** | Fixed |
| 2 | SS-05 | Tests passed but never asserted the thresholds the spec requires | High | Fixed — 6 tests added |
| 3 | SS-05/07 | Scanner fed timestamp-prefixed text, producing "PM"/"Entry" candidates | High | Fixed |
| 4 | SS-06 | Dismissals stored as a flat global array — cross-campaign bleed | Medium | Fixed, per-campaign |
| 5 | SS-06 | `campaignId` not passed by either call site, making the fix inert | Medium | Fixed |
| 6 | SS-08 | `WritePad` unconditionally fullscreen, burying the entry list | Medium | Fixed — docked variant |
| 7 | SS-08 | No auto-scroll to newest entry | Medium | Fixed |
| 8 | SS-09 | Title fallback used `extractText`, dropping wikilink labels | Medium | Fixed — `docToText` |
| 9 | SS-04 | `updateLogEntry` bypassed `updateNote`, skipping validation | Medium | Fixed — delegates |
| 10 | SS-14 | Ship notes silently discarded on Close | Medium | Fixed — persists |
| 11 | SS-01 | Two phase-spec-required tests never written | Low | Fixed |
| 12 | SS-06 | `applySuggestionToDoc` built as `applySuggestionToBody` (name + shape) | Low | Contract aligned, rationale recorded |
| 13 | SS-12 | `QuickNoteAction`/`QuickNoteDrawer` orphaned; evidence file makes a false claim | Medium | **Escalated — human decision** |

## The finding that mattered most

Gap 1 was proved by **execution, not reading**. A 2-character dictionary
name ("Al") fuzzy-matched "we", "saw", "7", "27", "PM", "00" and bare
numbers, because edit distance ≤2 against a 2-character string is nearly
unconstrained. A 3-char name matched at distance 2 where the spec requires
≤1.

This is exactly the *"a scanner that floods you with garbage is worse than
no scanner"* failure the sub-spec's own rationale was written to prevent —
and the full test suite was green the entire time, because no test asserted
a threshold. Code-reading alone would have scored this Met.

## Escalated to human decision

**Orphaned quick-note components.** Both `QuickNoteAction` and
`QuickNoteDrawer` have zero importers. The spec requires they stay
"reachable outside the session flow" and makes deletion a human-only call,
so no artificial entry point was invented and nothing was deleted.

Important correction to the spec's premise: **`QuickNoteDrawer` had zero
importers before the factory run too** (verified at 5ad7566). It was
already dead code when the requirement was written. Only `QuickNoteAction`
was orphaned *by* this work, when SS-12 removed it from the session flow.

**The SS-12 evidence file contains a false claim** — it asserts
`QuickNoteAction` is still used by `PromoteEntriesSheet`. The only match
there is a doc-comment naming a constant, not an import.

## Accepted contract deviations

Three contracts were aligned to what was built rather than forcing a
rewrite. Each carries a `deviation_accepted` rationale in `contracts.json`:

- `createLogEntry` / `updateLogEntry` — data-object form matching the
  existing `createNote(data)` convention; the spec's positional form was
  less idiomatic for this repository.
- `applySuggestionToBody` — text-in rather than doc-in. This is the shape
  the SS-12 Playwright run actually proved working end to end; renaming
  risked regressing the one path verified in a browser.

## Process failure worth recording

Three fix agents ran in parallel against **one shared working tree**. Two
of them used `git stash` to recover from perceived interference. `git stash`
is a whole-tree operation — pathspec discipline constrains what an agent
*edits*, not what a stash *sweeps*. Five of the coordinator's eight edits
were silently reverted, and the surviving two referenced a prop that no
longer existed, breaking the build.

Recovered by restoring only the affected files from `stash@{0}` with
`git checkout stash@{0} -- <paths>`, leaving the agents' final work intact.
All eight edits verified present afterwards; build and tests green.

**Rule for future passes: fixes are serialised, or each agent gets its own
worktree.** Scanners are read-only and remain safe to parallelise.

## Verification after fixes

- `npm run build` — exit 0
- `npm test` — 244 passed (219 pre-factory, 236 post-factory)
- Commit: `d90482a`
