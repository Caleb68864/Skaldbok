# Pass 1 — standard scan

- Mode: standard (clean_streak 0 → scan)
- Reference: `docs/specs/2026-07-29-notes-overhaul-completion.md`
- Change slice: `e8d966d..HEAD` (`master` exists but is stale at `3a2a2ba`; the
  fork point is the real base)
- Commit: `3eb0471`

## Scan

Three `Explore` subagents, batched by topic area, each required to *execute*
`[MECHANICAL]` criteria rather than read them.

| Area | Verdict |
|---|---|
| SS-01 / SS-05 — FAB nav, log route layout, More link | 1 gap |
| SS-02 / SS-03 — deletions, context plumbing, caller rewiring | CLEAN |
| SS-04 / R6 — timeline lane, auto-logging untouched | 1 gap |

Plus every `[BEHAVIORAL]` / `[INTEGRATION]` criterion scored
**Partial (unverified)** — per the skill these count as gaps, since a behavior
asserted by reading is not verified.

## Gaps found and fixed

### G1 — Log lane could never be revealed (CRITICAL, SS-04's central criterion)

The scan scored this Met on structure. Running the app disproved it.

`visible: false` does not mean "off by default" anywhere in this timeline:

- `useTimelineLayout.ts:116` drops `!track.visible` rows outright.
- `useTimelineState.toggleTrack:244` removes the id from `hiddenTrackIds` but
  recomputes `visibleTrackIds` with the same `track.visible &&` gate, so the
  track lands in neither list.
- `SessionTimelinePanel`'s reconciling effect re-derived from `track.visible`
  on every dataset change, reverting any toggle.

The lane was listed in the Tracks menu as **Off** and was inert. My original
red-team fix (C-1) picked the wrong lever: it correctly hid the lane and
correctly listed it, but permanently.

**Fix:** new `defaultHidden?: boolean` on `TimelineTrack` — start switched off,
stay switchable, `hiddenTrackIds` authoritative once classified. Catalog `log`
becomes `visible: true, defaultHidden: true`. Classification happens exactly
once per track, tracked in a `useRef` set: tracks arrive asynchronously and the
shared hook prunes `hiddenTrackIds` against the live track list, so deriving
"already classified" from filter state raced (the lane came up expanded).

**Verified live**, not by reading: Log absent on first render → Tracks menu
lists it Off → one tap reveals it → visible events go 1 → 4 → all three entries
render body-derived labels, the long one truncated at 60 chars with `…`.

### G2 — `/session/log` wasted ~140px of writing area

`SessionLog`'s root used `h-[calc(100%-140px)]` with an in-code comment claiming
`<main>`'s `pb-[140px]` is "tacked on after" a `h-full` child. That premise is
wrong: under `box-sizing: border-box` the padding is inside main's height, so
main's content box is already `H − 140` and `h-full` fits exactly. The calc
subtracted it twice — on the one screen where vertical space is the product.

**Fix:** `h-full`, comment corrected. **Measured after:**
`main.scrollHeight === main.clientHeight === 2464` at 1600×2560, entry list the
only in-flow scroller, commit button visible without page scroll.

### G3 — stale doc comment (minor)

`NOTE_CHILD_TRACK_KINDS`'s comment still claimed everything but `npc` nests
under Notes. Corrected to name `log` and say why.

## Behavioral criteria verified this pass (live)

| Criterion | Result |
|---|---|
| FAB navigates `/character/sheet` → `/session/log` | ✅ (label now "Open session log") |
| No FAB rendered while on `/session/log` | ✅ absent from DOM |
| No active session → log's "Start a session" empty state | ✅ started a session from it |
| Commit appends a timestamped entry, clears the pad | ✅ ×3 |
| Pad **retains focus** after commit (S-Pen requirement) | ✅ `document.activeElement === textarea` |
| Uncommitted draft survives navigation away and back | ✅ text preserved |
| Log lane hidden on first render / revealable / labelled | ✅ (after G1 fix) |
| Log entries never roll into the Notes aggregate | ✅ log is top-level, no `parentTrackId` |

## Still unverified — these keep `clean_streak` at 0

- **Promote flow** (select entries → New note / Add to existing → `Promoted`
  badge, raw entries retained). Selection is a long-press gesture; not driven
  successfully via Playwright this pass.
- **Notes aggregate unchanged with real promoted notes present** — verified
  structurally (log is top-level so it cannot roll up) but not with an actual
  promoted note in the lane.
- **Commit failure retains the typed text** — needs `createLogEntry` forced to
  throw; no DOM test setup in this repo.
- **Tab S9 + S Pen** — requires the physical device.

## Observation (not a gap)

Every note-ish track row renders the subtitle "Session log entries"
(`SessionTimelinePanel.tsx:64`), so "Locations | Session log entries" and
"Notes | Session log entries" both appear. Verified **pre-existing** — identical
at `e8d966d`, and this branch's diff to that file is removal-only. Out of the
spec's scope, but it reads oddly now that a real Log lane exists.

## Process note

`docs/decisions.md` was found staged with two `<FILL-IN>` template blocks
(literal, unexpanded `$(date +%Y-%m-%d)` — written by a broken hook). Per the
converge guard, unrelated WIP was not swept into the pass commit; instead both
blocks were filled with this pass's two real decisions, which is what the
pre-commit hook was asking for.

## Met%

Structural/mechanical criteria: 100% after fixes. Behavioral: 8 of 12 verified.
**Verdict: 3 gaps found, 3 fixed. `clean_streak` reset to 0. Not converged.**
