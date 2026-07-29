---
sub_spec_id: SS-04
phase: run
depends_on: []
dispatch: factory
---

# Sub-Spec 4 — Log entries on the session timeline, top-level and hidden by default

## Scope

Stop excluding `type: 'log'` from the session timeline and give log entries their
own **top-level** track — a sibling of Encounters and NPCs, not a child of Notes —
that starts **hidden** and is revealed through the existing track filter.

This is the only sub-spec in the spec containing new logic. Both red-team
CRITICAL findings land here, and the reasoning behind each is load-bearing —
implementing the "obvious" version produces something that passes a naive reading
of the criteria while being useless.

## Why top-level, not nested under Notes (red-team C-2)

The `notes` parent ships `collapsed: true`
(the `notes` entry in `defaultTimelineTrackCatalog.ts`), and the session adapter carries
`collapsed` through (`sessionTimelineAdapter`'s `buildTrack`). When a parent is collapsed,
`useTimelineLayout.ts:97-111` redirects **every descendant's items onto the parent
row as an aggregate**:

> "Build child → aggregation-parent map. If a track's parent is collapsed, route
> its items to the parent's id. Grandchildren roll up to the nearest collapsed
> ancestor."

Nesting the log there would turn "Notes: 7 events" into "Notes: 87 events" for a
4-hour session — burying the promoted notes under the raw capture. That is
precisely the failure the original exclusion existed to prevent, documented at
`sessionTimelineAdapter`'s note filter. `npc` is already treated as a first-class
top-level sibling for a similar reason; `log` follows it.

## Why `defaultHidden`, not `collapsed: true` or `visible: false` (red-team C-1, corrected)

`collapsed` only ever hides a track's **children** and rolls their items up
(`useTimelineLayout.ts:100-126`). The log lane is a leaf — it has no children —
so `collapsed: true` on it is a **no-op**.

> **Corrected in converge pass 1. This section previously prescribed
> `visible: false`. Do not restore that.** The reasoning was that
> `SessionTimelinePanel` seeds `hiddenTrackIds` from
> `tracks.filter(track => !track.visible)`. That seeding is real, but
> `visible: false` means "never render" everywhere else in this timeline:
> `useTimelineLayout.ts:116` drops the row outright, and
> `useTimelineState.toggleTrack` recomputes `visibleTrackIds` behind the same
> gate, so un-hiding leaves the track in neither list. Implemented literally,
> the lane appeared in the Tracks menu and was **inert** — confirmed in the
> running app.

The working mechanism is a `defaultHidden?: boolean` on `TimelineTrack`: the
track starts switched off but stays switchable, with `hiddenTrackIds`
authoritative once it has been classified. The catalog entry is
`visible: true, defaultHidden: true`.

Because `defaultHidden` is a new field, this sub-spec **must** also touch
`components/timeline/types.ts` (declare it) and
`components/timeline/hooks/useTimelineState.ts` (honour it when seeding an
uncontrolled `TimelineRoot`). Both are listed under Files below.

## Files

- **Files (modify):**
  - `src/features/session/sessionTimelineAdapter.ts`
  - `src/features/session/sessionTimelineConfig.ts`
  - `src/components/timeline/config/defaultTimelineTrackCatalog.ts`
  - `src/components/timeline/types.ts`
  - `src/components/timeline/hooks/useTimelineState.ts`
  - `src/features/session/SessionTimelinePanel.tsx`

## Decisions

- **Label derivation:** log entries carry `title: ''` and the timeline labels
  items by title, so the adapter must derive each item's label from the entry
  body. Use `docToText` from `src/features/notes/textToDoc.ts` (already imported
  by `SessionLog`), collapse whitespace/newlines to a single line, and
  truncate to **60 characters** followed by `…`.
- **Empty body fallback:** an entry whose body yields empty text after
  `docToText` gets the label `'(empty entry)'`, never a blank chip.
- **Config:** add `log: 'log'` to `DEFAULT_SESSION_TIMELINE_NOTE_TRACKS`. Do
  **not** add `'log'` to `NOTE_CHILD_TRACK_KINDS` — it is top-level.
- **Catalog entry:** add `log` to `DEFAULT_TIMELINE_TRACK_CATALOG` with
  `label: 'Log'`, `kind: 'log'`, `visible: true`, `defaultHidden: true`,
  `collapsible: true`, an `order` between `encounter` (1) and `npc` (2), and
  **no `parentTrackId` key**. Use an existing `colorToken` that is **not**
  already taken by an adjacent top-level lane (`encounter` holds
  `--color-danger`) rather than introducing a new CSS variable.
- **`defaultHidden` plumbing:** declare the field on `TimelineTrack`
  (`types.ts`), carry it through the session adapter's `buildTrack`, seed it
  into `hiddenTrackIds` in `useTimelineState.buildInitialFilterState` for the
  uncontrolled case, and classify each track against it **exactly once** in
  `SessionTimelinePanel` — tracked in a ref that is pruned to the live track
  set each pass, and mutated in the effect body rather than inside the state
  updater.
- **Adapter track emission:** emit the `log` track in the top-level branch
  alongside `npc` (`sessionTimelineAdapter`'s top-level track branch), **not** inside the
  `NOTE_CHILD_TRACK_KINDS` loop.

## Must-not (red-team A-5)

Do **not** change `src/components/timeline/adapters/notesToTimeline.ts`. Its
`buildTrack` deliberately omits `collapsed`, with an explicit comment at lines
53-58 explaining why, and `notesToTimeline.test.ts:28-30` asserts
`ds.tracks.every(t => !t.collapsed)`. Propagating `collapsed` there while chasing
this change breaks that test and tempts a worker into weakening it. Note this
sub-spec's own Files list grew to six once `defaultHidden` was introduced —
`notesToTimeline.ts` is still not one of them.

## Implementation Steps

### Step 1. Read the three files and the layout hook

Read `sessionTimelineAdapter.ts` (focus lines 40-60 for `buildTrack`, 100-115 for
the exclusion, 180-200 for track emission), `sessionTimelineConfig.ts` in full,
`defaultTimelineTrackCatalog.ts` lines 84-175, and
`src/components/timeline/hooks/useTimelineLayout.ts` lines 86-131 so the
aggregation behaviour above is understood first-hand rather than taken on trust.

### Step 2. Add the catalog entry

Add the `log` entry to `DEFAULT_TIMELINE_TRACK_CATALOG` per Decisions. Place it
next to `encounter` and `npc` (the top-level entries), not among the
`parentTrackId: 'track-notes'` block, so the file reads correctly.

### Step 3. Add the config mapping

Add `log: 'log'` to `DEFAULT_SESSION_TIMELINE_NOTE_TRACKS` in
`sessionTimelineConfig.ts`. Leave `NOTE_CHILD_TRACK_KINDS` untouched. Update the
doc comment on `NOTE_CHILD_TRACK_KINDS` to note that `log`, like `npc`, stays
top-level.

### Step 4. Remove the exclusion

In `loadSessionTimelineSourceData` (`sessionTimelineAdapter.ts:110-112`), drop
`&& note.type !== 'log'` so the filter becomes `note.status === 'active'`.
Replace the stale comment block above it (lines 104-109) with one explaining the
new arrangement: log entries are included, get a body-derived label, and live on
a top-level hidden-by-default lane so they never roll up into the Notes
aggregate.

### Step 5. Emit the log track top-level

In `buildSessionTimelineDataset`, add the `log` track alongside the `npc`
emission. Emit it **unconditionally**, unlike `npc`: the track filter lists only
tracks present in the dataset, so gating emission on entries existing would mean
a fresh session gives no hint the lane exists until the first entry — the moment
it stops needing to be discovered.

### Step 6. Derive the label

Where the adapter builds `TimelineItem`s from notes, add a label derivation for
`type: 'log'`: `docToText(note.body)`, whitespace collapsed to a single line,
truncated to 60 chars with `…`, falling back to `'(empty entry)'`. Non-log notes
keep using `note.title` unchanged.

### Step 7. Tests

```bash
npm test
```

Expect exit 0 with no count change. `notesToTimeline.test.ts` in particular must
still pass — if it fails, you changed `notesToTimeline.ts`, which is forbidden.
Revert that change rather than adjusting the test.

### Step 8. Build

```bash
npm run build
```

### Step 9. Commit

```bash
git add src/features/session/sessionTimelineAdapter.ts src/features/session/sessionTimelineConfig.ts src/components/timeline/config/defaultTimelineTrackCatalog.ts src/components/timeline/types.ts src/components/timeline/hooks/useTimelineState.ts src/features/session/SessionTimelinePanel.tsx
git commit -m "feat(timeline): surface log entries on a top-level hidden-by-default lane [factory-managed]"
```

## Interface Contracts

None — this sub-spec has no dependencies and nothing depends on it before SS-06.

## Verification Commands

```bash
npm run build
npm test
grep -c "type !== 'log'" src/features/session/sessionTimelineAdapter.ts
grep -n "log:" src/features/session/sessionTimelineConfig.ts
git diff --name-only -- src/components/timeline/adapters/notesToTimeline.ts
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Log exclusion removed | [MECHANICAL] | `[ $(grep -c "type !== 'log'" src/features/session/sessionTimelineAdapter.ts) -eq 0 ] \|\| (echo "FAIL: log entries are still excluded from the timeline" && exit 1)` |
| Config maps the log kind | [STRUCTURAL] | `grep -q "log: 'log'" src/features/session/sessionTimelineConfig.ts \|\| (echo "FAIL: DEFAULT_SESSION_TIMELINE_NOTE_TRACKS has no log key" && exit 1)` |
| Log is not a Notes child | [STRUCTURAL] | `! grep -A20 "NOTE_CHILD_TRACK_KINDS" src/features/session/sessionTimelineConfig.ts \| grep -q "'log'" \|\| (echo "FAIL: log was added to NOTE_CHILD_TRACK_KINDS" && exit 1)` |
| Catalog log entry is hidden by default | [STRUCTURAL] | `grep -A9 "^  log: {" src/components/timeline/config/defaultTimelineTrackCatalog.ts \| grep -q "defaultHidden: true" \|\| (echo "FAIL: catalog log entry is not defaultHidden:true" && exit 1)` |
| Catalog log entry is renderable (NOT visible:false) | [STRUCTURAL] | `! grep -A9 "^  log: {" src/components/timeline/config/defaultTimelineTrackCatalog.ts \| grep -q "visible: false" \|\| (echo "FAIL: visible:false makes the lane permanently unreachable — see the corrected C-1 rationale" && exit 1)` |
| `defaultHidden` declared on TimelineTrack | [STRUCTURAL] | `grep -q "defaultHidden?: boolean" src/components/timeline/types.ts \|\| (echo "FAIL: defaultHidden not declared" && exit 1)` |
| `defaultHidden` honoured when seeding uncontrolled state | [STRUCTURAL] | `grep -q "track.defaultHidden" src/components/timeline/hooks/useTimelineState.ts \|\| (echo "FAIL: buildInitialFilterState ignores defaultHidden" && exit 1)` |
| Catalog log entry has no parent | [STRUCTURAL] | `! grep -A8 "^  log: {" src/components/timeline/config/defaultTimelineTrackCatalog.ts \| grep -q "parentTrackId" \|\| (echo "FAIL: log entry declares a parentTrackId" && exit 1)` |
| Adapter derives labels from the body | [STRUCTURAL] | `grep -q "docToText" src/features/session/sessionTimelineAdapter.ts \|\| (echo "FAIL: adapter does not derive log labels from the body" && exit 1)` |
| Empty-body fallback present | [STRUCTURAL] | `grep -q "(empty entry)" src/features/session/sessionTimelineAdapter.ts \|\| (echo "FAIL: no empty-body label fallback" && exit 1)` |
| notesToTimeline untouched | [MECHANICAL] | `[ -z "$(git diff --name-only -- src/components/timeline/adapters/notesToTimeline.ts)" ] \|\| (echo "FAIL: notesToTimeline.ts was modified — see must-not" && exit 1)` |
| Tests pass | [MECHANICAL] | `npm test \|\| (echo "FAIL: npm test failed" && exit 1)` |
| Project builds | [MECHANICAL] | `npm run build \|\| (echo "FAIL: npm run build failed" && exit 1)` |

## Behavioral Criteria (manual / reviewer judgment)

- In a session with committed log entries, the Session tab timeline shows **no
  Log row on first render**; the track filter lists "Log", and enabling it
  reveals a top-level Log row whose entries show their text rather than blank
  chips.
- With the Log lane revealed and the Notes parent collapsed, the Notes row's
  aggregate count is unchanged from before this work — log entries never roll up
  into it.
- Notes promoted out of the log still appear in their own type lanes (e.g.
  Rumors, Loot) with unchanged labels and ordering.
