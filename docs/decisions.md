
## 2026-07-27 — Promoted notes discarded approved wikilink suggestions

- Symptom: Approving a suggested `[[link]]` in `PromoteEntriesSheet` only
  updated the panel's local preview text; the note actually created (or
  appended to) via "Create note" / "Append to note" always used the raw,
  unresolved entry text, so the approval had no effect on saved data.
- Fix: `createNoteAndPromote` and `appendEntriesToExistingNote` now accept
  the resolved body text explicitly; the sheet tracks the running
  approved text via `SuggestedLinksPanel`'s `onApprove` callback and passes
  it through instead of recomputing from the raw entries.
- Surfaces: `src/features/notes/PromoteEntriesSheet.tsx`.
- Watch: `handleBulkApprove` can double-wrap a span if two distinct
  dictionary entries (e.g. a note and its linked creature template) match
  the exact same text — each approval re-scans the running text with a
  plain word-boundary regex that doesn't know a prior wrap already
  happened. Not hit by a single "Approve" click; only a latent risk for
  "Approve all" with duplicate-target suggestions.
  > **Correction and resolution (converge pass 2, 2026-07-27).** Two claims
  > above were wrong. It was **not** latent — it was reproduced live,
  > producing `We met [[[[Elara Ostrand]]]] at the tavern.` And it was **not**
  > exclusive to "Approve all": `handleApprove` shares the same `bodyText`
  > state across calls, so two sequential single-row Approve clicks corrupt
  > the body identically. Only multi-word names can collide (the per-token
  > loop `break`s on the first exact match, so a duplicate single-word name
  > never reaches the list twice) — but a note titled after an NPC plus that
  > NPC's creature template is ordinary campaign authoring, not a contrived
  > case. **Fixed:** `applySuggestionToBody` now skips any match already
  > enclosed in `[[…]]`. Regression test in `SuggestedLinksPanel.test.ts`,
  > verified to fail without the guard.
- Commit: factory(SS-12) — route session FAB Note action to SessionLog,
  verify end to end.

## 2026-07-27 — Link scanner fuzzy thresholds were never length-scaled

- Symptom: `scanForLinks` applied a single fixed edit distance of 2 to every
  dictionary name regardless of its length, with no minimum-length guard.
  Proved by live probe: a 2-character PC name such as "Al" fuzzy-matched
  "we", "saw", "7", "27", "PM", "00" and bare numbers; a 3-char name matched
  at distance 2 where the spec requires <=1. In any campaign with a short
  PC or NPC name the scanner would bury every log entry in garbage
  suggestions — the precise "worse than no scanner" outcome the sub-spec's
  own rationale was written to prevent. The test suite passed throughout
  because it never asserted the thresholds at all.
- Fix: added `fuzzyThresholdFor(name)` — returns null below 3 chars (name
  excluded from matching entirely), 1 for 3-4 chars, 2 for 5+. Applied in
  both the per-token pass and the missing-record pass. Missing-record
  candidates additionally skip tokens under 3 chars and purely numeric
  tokens. Separately, `PromoteEntriesSheet` was feeding the scanner
  timestamp-prefixed text, which is where the "PM"/"Entry" candidates came
  from; scan input is now raw body text while the promoted note keeps its
  timestamps.
- Surfaces: `src/features/notes/linkScanner.ts`,
  `src/features/notes/linkScanner.test.ts`,
  `src/features/notes/PromoteEntriesSheet.tsx`.
- Watch: the earlier `handleBulkApprove` double-wrap risk noted above is
  still latent and is now slightly more reachable, since better-quality
  suggestions mean "Approve all" is more likely to be used. Also: parallel
  fix agents sharing one working tree used `git stash` for recovery, which
  is a whole-tree operation that silently reverted other agents' in-flight
  edits — pathspec discipline does not constrain stash. Isolate agents in
  worktrees or serialise them.
- Commit: converge(pass-1) — close 11 spec gaps found by 4-way audit.
