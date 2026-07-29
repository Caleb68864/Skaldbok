# Pass 3 — standard scan (fresh agent, whole-spec re-score)

- Mode: standard (clean_streak was 1 → scan)
- Reference: `docs/specs/2026-07-29-notes-overhaul-completion.md`
- Commit: `3fefb78`
- Result: **1 gap + 3 correctness issues. `clean_streak` → 0.**

## Scorecard

| Requirement | Score |
|---|---|
| R1 FAB navigates to `/session/log`, hidden on that route | Met |
| R2 Nine quick-action files deleted | Met |
| R3 `openQuickLog` plumbing removed, callers rewired | Met |
| R4 Log lane top-level / hidden by default / revealable / labelled | **Partial → D1** |
| R5 MoreScreen link, first | Met |
| R6 Auto-logging unchanged | Met (`useSessionLog.ts` diff empty) |
| R7 build + tests pass, no weakened tests | Met (25 files / 271 tests; no `*.test.*` in the slice) |

## D1 — a returning track came back visible (real, R4 violation)

Pass 1's `defaultHidden` work held **only on first render**. Pass 2's live
verification missed it because it only ever exercised first render.

`classifiedTrackIdsRef` recorded which tracks had taken their default, but only
ever grew. `hiddenTrackIds` is recomputed from the *current* dataset each pass,
so a track that left the dataset silently dropped out of it while staying in the
ref. On return it read as already-classified and fell through to
"not in `hiddenTrackIds`, therefore visible" — the Log lane came back **expanded**,
which R4 forbids.

Reachable with no reload: `SessionScreen` renders `ActiveSessionContent` and
`SessionTimelinePanel` **without a `key`**, so switching sessions swaps the
dataset without remounting the panel.

**Fix:** prune the ref to the live track set each pass, so a lane that leaves and
returns is classified afresh. The ref is now mutated in the *effect body*, not
inside the state updater — React may invoke an updater more than once, and a ref
write there lets the second invocation observe the first one's bookkeeping and
reach the opposite conclusion.

**Verified by reproducing the exact path in the running app:**

| Step | Result |
|---|---|
| Session A (3 entries) → timeline | Log lane hidden, `4 tracks / 2 events` |
| End session A (confirm dialog) | — |
| FAB → log → Start session (B) | fresh session, zero entries |
| Commit B's first entry → timeline | **Log lane still hidden**, `4 tracks / 1 event` |
| Tracks menu → toggle Log | `Log=On`, `5 tracks / 2 events`, B's entry on its own lane |

Both halves hold: the default survives a dataset swap, and the lane is still
revealable rather than over-corrected into permanent hiding.

## D3 — `defaultHidden` ignored by the shared hook (latent)

`useTimelineState.buildInitialFilterState` seeded `hiddenTrackIds` from
`!track.visible` only. Any **uncontrolled** `TimelineRoot` given a
`defaultHidden` track would render it fully visible — the opposite of what the
flag's own doc comment promises. Latent today (`SessionTimelinePanel` drives
filter state controlled and reimplements the seeding), but `defaultHidden` is
library surface now. Fixed.

## D2 — stale comment (real risk, not cosmetic)

`sessionTimelineAdapter.ts` still claimed the log track starts hidden via
`visible: false` — the exact wrong mechanism the rest of this change went out of
its way to document against. A future reader following it back would reintroduce
the permanently-unreachable-lane bug. Corrected.

## D4 — zero-entry session shows no Log lane (not a gap)

The track is gated behind `noteTrackKinds.has('log')`, so with no entries the
lane is absent from the track filter entirely. Consistent with the existing
`npc` handling, and SS-04 Step 5 explicitly permitted matching `npc`. The
"empty log lane still renders" edge case was also **declined** when the spec's
edge cases were chosen. Recorded, not fixed.

## Process note

The pre-commit hook appends a fresh `<FILL-IN>` decisions template on each
commit and blocks until it is filled. Filled with this pass's decision (the
prune-the-ref rule and the don't-mutate-a-ref-inside-a-state-updater rule).

## Verdict

**1 gap, fixed. 2 correctness issues, fixed. `clean_streak` → 0.**
