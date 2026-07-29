---
title: Notes overhaul completion — delete Quick Log, make the raw log the only capture surface
date: 2026-07-29
status: approved
scope: deletes SessionQuickActions and its chip/drawer surface; makes /session/log the full-screen capture destination; turns the Session tab into a review surface whose timeline covers log entries and promoted notes
predecessor: 2026-07-27-session-log-note-capture-design.md
target_device: Samsung Galaxy Tab S9 + S Pen (Chrome PWA)
---

# Notes overhaul completion

## 0. Problem

The 2026-07-27 design shipped its data model and its surfaces: `SessionLog`,
`WritePad`, `PromoteEntriesSheet`, `SessionLogSelection`, the link scanner, the
`promoted_into` edge, and the `HIDDEN_NOTE_TYPES` exclusion all exist and work.

What did not happen is the retirement it depended on. `GlobalFAB` still opens
`SessionQuickActions`, which renders:

- a primary chip row — Quick Log, Note, Encounter, Damage, Quote, NPC
- a **More** dropdown — Condition, Death Roll, Rest, Camp, Travel, Rumor,
  Shopping, Loot
- a structured drawer per action, each with `AttachToControl` and a 10-chip
  `TagPicker`

The raw log is reachable only as the *second* chip in that row. The screen that
was built to remove every decision from the moment of writing is buried behind
fourteen of them.

Two supporting findings:

- `src/features/session/actions/{Loot,Quote,Rumor,Shopping,SkillCheck}Drawer.tsx`
  are already unreferenced. Only `SkillCheckEditDrawer` still has callers.
- `SessionQuickActions.tsx:1156-1158` `void`s `renderSkillPicker`,
  `renderSpellPicker` and `renderAbilityPicker` to silence unused warnings —
  dead code kept alive by a compiler workaround.

## 1. Shape of the solution

```
CAPTURE   FAB → /session/log, full screen. Entries + WritePad. Nothing else.
REVIEW    Session tab. Status, encounters, and a timeline covering the raw
          log and the notes promoted out of it.
```

Capture and review become different places. Today they are the same place, and
the review furniture is what makes capture slow.

## 2. Capture — one full-screen surface

`/session/log` already exists as a route but nothing links to it. It becomes the
capture destination:

- `GlobalFAB` **navigates** to `/session/log` instead of opening a `Drawer`.
- The FAB **hides itself** while on that route, so it cannot overlap the pad or
  the entry list.
- Pressing the FAB with no active session navigates to the log rather than
  firing the "Start a session first" toast. `SessionLog` already renders an
  empty state with a **Start session** button; routing there replaces a dead
  end with the action the user wanted.

The full-screen requirement is not cosmetic. Samsung's S Pen handwriting pad
occupies a large fixed portion of the viewport, so any chrome sharing the screen
with `WritePad` is chrome the user cannot see while writing.

### Deleted

| File / symbol | Reason |
|---|---|
| `SessionQuickActions.tsx` (whole file) | The chip row, the More dropdown, all 13 `render*Picker` functions, `TAG_OPTIONS`, `REST_TYPES` |
| `quickLog/QuickLogPCTray.tsx` | PC → skill → outcome flow; outcomes are now written |
| `quickActions/QuickNpcAction.tsx` | NPC capture lives on the Bestiary screen |
| `quickActions/AttachToControl.tsx` | Per-entry attach target is a decision at write time |
| `actions/LootDrawer.tsx`, `QuoteDrawer.tsx`, `RumorDrawer.tsx`, `ShoppingDrawer.tsx`, `SkillCheckDrawer.tsx` | Already unreferenced |
| `SessionRefreshContext` — `openQuickLog`, `requestedQuickLogAction`, `requestedQuickLogNonce`, `clearQuickLogRequest` | Only consumer was the FAB drawer |

### Kept

- **`SkillCheckEditDrawer`** — `NotesGrid.tsx:297` and `SessionScreen.tsx:779`
  both open it to *edit* existing skill-check notes, which auto-logging keeps
  producing. Deleting it would strip the only edit path for those notes.
- **`useSessionLog` and every auto-logging caller** — `SheetScreen`
  (`logHPChange`, `logDeathRoll`, `logRest`), `GearScreen` (`logCoinChange`),
  `PlayDashboard` modules, `CombatEncounterView`. These keep writing typed
  notes exactly as they do today. They are not chips; they are derived records
  that cost the user nothing at the table.
- **`formatSkillCheckTitle.ts`** and its test — still used by auto-logging.

## 3. What replaces the deleted actions

Nothing is built. Every deleted action already has a home:

| Deleted | Where it lives now |
|---|---|
| Damage, Heal | Character sheet, Play Dashboard — both already auto-log |
| NPC / Monster | Bestiary screen |
| Encounter | Session screen → Start Encounter |
| Rest, Death Roll, Condition | Character sheet |
| Quote, Rumor, Loot, Shopping, Camp, Travel | **Written into the log**, promoted afterward if they matter |

That last row is the premise of the overhaul: the log is the general bucket, and
structure is extracted afterward. The deletion is the feature, not a regression
to compensate for.

## 4. Review — the Session tab

The Session tab keeps session status, encounter management, and the timeline,
and loses its capture role.

- **`sessionTimelineAdapter.ts:111` currently excludes log entries**
  (`note.type !== 'log'`). That filter is replaced: log entries render in their
  own lane. **Superseded during implementation — see the note at the end of this
  section:** the lane is *top-level*, not nested under Notes, and starts
  *hidden* rather than collapsed. So promoted
  notes stay the headline and the raw stream is one tap away.
- **`onAddToTimeline`** stops calling `openQuickLog('note')` and navigates to
  `/session/log`.
- The **"Session Notes" `VaultBrowser` panel is unchanged.** It is the
  search-and-reopen surface, it already excludes log entries through
  `NotesGrid`'s `HIDDEN_NOTE_TYPES`, and it is how a promoted note is found
  after the fact.

## 5. Promotion — unchanged

`PromoteEntriesSheet` (new note / add to existing / tag only),
`SessionLogSelection` (selection bar, delete-with-undo, Review link sweep), the
`promoted_into` edge and `PromotedBadge` are all untouched. This is the
destination the work has been building toward and it functions.

## 6. Migration and risk

**No data migration.** Every deleted surface wrote ordinary `Note` rows;
existing notes of type `loot`, `quote`, `rumor`, `skill-check`, `spell-cast` and
`ability-use` remain valid, readable, editable, searchable, and rendered on the
timeline. `NOTE_TYPES` is not changed.

| Risk | Mitigation |
|---|---|
| A deleted action turns out to be load-bearing at the table | Every one has a documented home (§3). The log accepts anything in the meantime. |
| Timeline floods with log entries | Lane is top-level and hidden by default (`defaultHidden`). Originally specified as nested-under-Notes and collapsed; both were wrong — see the implementation note. |
| FAB hidden on the log route strands the user | Bottom nav is still present on `/session/log`; it is a shell route, not shell-less. |
| Removing `openQuickLog` breaks an unseen caller | `npm run build` is a full `tsc -b`; an orphaned reference fails the build. |

## 7. Deliberately out of scope

- Collapsing `NOTE_TYPES` into a general bucket plus tags.
- Moving `TagPicker` presets into config (existing backlog item #5).
- `NoteEditorScreen`'s type pills. That is note *editing*, not capture.
- Any *behavioural* change to the character sheet, the Play Dashboard, or the
  system engine. (Originally "any change". Relaxed after the fact: a separately
  authorised dead-code sweep made comment-only edits to `engine/index.ts`,
  `engine/types.ts` and `types/character.ts`.)

## Commander's Intent

**Desired End State:** Pressing the FAB anywhere in the app lands on a
full-screen writing surface with the session's entries above and `WritePad`
below, and no chips, drawers, tag pickers or attach controls anywhere on it.
The Session tab is where the user goes afterward to read the timeline of what
was logged and what was promoted out of it.

**Purpose:** The capture screen was built and then buried behind the fourteen
decisions it existed to remove. Judge every change by "does this remove a
decision from the moment of writing?"

**Constraints:**
- MUST NOT change `NOTE_TYPES` or run a data migration.
- MUST NOT alter auto-logging behaviour (`useSessionLog` and its callers).
- MUST keep `SkillCheckEditDrawer` reachable from `NotesGrid` and `SessionScreen`.
- MUST leave `PromoteEntriesSheet` and `SessionLogSelection` behaviour unchanged.
- MUST keep the log lane switched off by default on the timeline (implemented as
  `defaultHidden`; the original wording said "collapsed", which is a no-op on a
  leaf track).
- MUST NOT touch the character sheet or the system engine.
- MUST keep `npm test` green — no existing test may be weakened to pass.

**Freedoms — the agent MAY decide without asking:**
- Whether the FAB hides via route check or a context flag.
- File deletion order and how dead imports are unwound.
- Exact timeline track id / label / order for the log lane.
- Whether `/session/log` gets its own header or reuses `SessionBar`.

## Execution Guidance

**Observe:**
- `npm run build` — the only type-check (`tsc -b` + vite). A missed reference to
  a deleted symbol fails here, which is the primary safety net for this work.
- `npm test` — existing tests must stay green.

**Orient — repo conventions:**
- Reads filter soft-deleted rows via `excludeDeleted` (`src/utils/softDelete.ts`).
- User-facing groupings belong in config, not component literals.
- Screens stay thin; logic lives in feature hooks.
- No `systemId ===` branches outside `baseEngineFor`.

**Escalate when:**
- Deleting a file would orphan a symbol that auto-logging depends on.
- A Dexie `version()` bump appears necessary (it should not — nothing is additive here).
- The timeline change would alter ordering or grouping for non-log notes.

## Decision Authority

**Agent decides autonomously:** deletion order, import unwinding, FAB
hide mechanism, timeline track metadata for the log lane, file layout.

**Agent recommends, human approves:** deleting any file listed under §2 *Kept*;
any change to `useSessionLog`; any change to `NOTE_TYPES`.

**Human decides:** re-adding any deleted quick action; changing the AAR export
format; collapsing `NOTE_TYPES`.

## Verification

Build and tests, then a real pass in the running app (Traveller only, per
standing project note — Dragonbane is not re-tested unless its code is touched):

1. Start a session; press the FAB → lands full-screen on `/session/log`, no
   chips, no FAB overlapping.
2. Commit several entries; tap one to edit; confirm the original timestamp holds.
3. Select entries → Promote → New note; confirm the `Promoted` badge appears and
   the raw entries remain.
4. Session tab → timeline shows the promoted note, and the log lane is present
   and **hidden**; enabling it in the track filter reveals the raw entries.
5. Change HP on the sheet → confirm auto-logging still writes its typed note.

## Implementation note (2026-07-29, converge passes 1 and 3)

Two decisions in this document did not survive contact with the code, and the
shipped behaviour differs. Recorded here so the design doc is not read as
current guidance:

1. **The lane is top-level, not nested under Notes.** A collapsed parent
   aggregates every descendant's items onto its own row
   (`useTimelineLayout.ts`), so nesting the log under Notes would have buried
   the promoted notes under the raw capture — the exact failure the original
   exclusion existed to prevent. Red-team C-2 caught this before implementation.
2. **The lane starts hidden via `defaultHidden`, not collapsed, and not
   `visible: false`.** `collapsed` only hides a track's *children*, so it is a
   no-op on a leaf. The first correction, `visible: false`, was worse: it means
   "never render" throughout this timeline, so the lane became permanently
   unreachable — it appeared in the Tracks menu and was inert. Converge pass 1
   replaced both with a `defaultHidden` flag: start switched off, stay
   switchable.

Current, authoritative description: `docs/specs/2026-07-29-notes-overhaul-completion.md`
(SS-04) and `docs/specs/notes-overhaul-completion/sub-spec-4-timeline-log-lane.md`.
