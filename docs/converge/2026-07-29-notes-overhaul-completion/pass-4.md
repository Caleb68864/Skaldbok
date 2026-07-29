# Pass 4 — standard scan (fresh agent, focused on the pass-3 fix)

- Mode: standard (clean_streak was 0 → scan)
- Reference: `docs/specs/2026-07-29-notes-overhaul-completion.md`
- Commit under test: `3fefb78`
- Result: **CLEAN. `clean_streak` → 1.** No code changed.

## Scorecard

All seven requirements Met. `npm run build` exit 0; `npm test` exit 0
(25 files / 271 tests). `notesToTimeline.ts` and `useSessionLog.ts` diffs both
empty.

## What this pass specifically confirmed

The pass-3 fix was the thing most likely to be subtly wrong, so it was audited
directly rather than taken on trust:

- **The partition is total.** `visible && !defaultHidden` (visible list) versus
  `!visible || defaultHidden` (hidden list) covers every track exactly once, so
  the `useState` initializer and the reconciling effect cannot disagree about a
  track.
- **The ref write is safe under a double-invoked updater.** It happens in the
  effect body at `SessionTimelinePanel.tsx:202`, before the updater runs — so a
  second invocation cannot observe the first one's bookkeeping.
- **Rapid session switching behaves as intended.** The ref is pruned to the live
  tracks, so a lane that leaves and returns is re-defaulted hidden, while a lane
  present in both sessions keeps the user's toggle.
- **No permanent-visible or permanent-hidden path exists.** `toggleTrack` can
  always move a `defaultHidden` track because its `visible` stays `true`.
- **The uncontrolled case works too.** `useTimelineState.ts:249-251` filters on
  `track.visible`, which is `true` for a `defaultHidden` track, so the D3 fix
  didn't create a track the hook's own toggle can't reveal.
- **The hook and the panel don't fight.** The hook's reconciling effect reads
  only `hiddenTrackIds`, so it agrees with the panel's controlled state at
  fixpoint — no oscillation.
- **`searchText` is not stale** in the initializer; the sync effect reconciles a
  later prop change.
- **`types.ts`'s `defaultHidden` doc matches reality** — both claims it makes
  about `visible: false` were verified against `useTimelineLayout.ts:116` and
  `useTimelineState.ts:250`.

## Recorded nits — deliberately not fixed

Editing a clean tree mid-streak would invalidate the pass, and none of these
violates a requirement. Left for a follow-up decision:

| # | Where | What |
|---|---|---|
| N1 | `GlobalFAB.tsx:42-44` | `cn()` now wraps a single static string — the `drawerOpen && 'rotate-45'` branch it existed for was deleted in SS-01, and `transition-transform` is inert since nothing rotates. Genuine residue of this change. |
| N2 | `SessionTimelinePanel.tsx:150-152` | The `useRef` initializer allocates a `Set` on every render; only the first is used. Marginal garbage, no behavioural effect. |
| N3 | `notesToTimeline.ts:41-63` | Its `buildTrack` silently drops `defaultHidden`. **No production consumer** — the only `TimelineRoot` mounts are `SessionTimelinePanel` (controlled, correct) and a mock example. The spec forbids touching this file, so leaving it is correct; worth a note if that adapter is ever wired to a screen. |

N1 is the only one I'd argue for fixing, since it is dead weight left by this
work rather than a pre-existing condition.

## Verdict

**CLEAN — 0 gaps. `clean_streak` → 1.**
