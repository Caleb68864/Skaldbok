# Quick Log Tray — Design

_Date:_ 2026-04-19
_Status:_ Approved, ready for implementation

## Problem

The current "Quick Note" drawer is quick in name only: title field + type
chips + **Tiptap rich-text editor** + tag picker + two mention chip rows +
attach-to control. Logging a one-line observation requires tapping through
eight controls, at least one of which (Tiptap) is ergonomically hostile
during live play. Separately, the Skill Check drawer works well and is
distinct, but spells and heroic abilities have no structured log path —
they either go through Quick Note (slow) or are never captured.

Ambient session-log friction is the last remaining issue from the
2026-04-18 play session. Voice capture (option D in brainstorming) and the
persistent stamp bar (option C) were both rejected. The direction chosen
is: a tray of PCs, tap a PC to see their abilities, tap an ability/spell/
skill-check to log an outcome.

## Goal

One drawer, opened from the FAB, that covers:

- Skill checks, spells, and heroic abilities in a single unified flow
  rooted on "who did what."
- A plain "Text note" escape hatch for anything that doesn't fit, with a
  one-tap promote-to-rich-editor button.
- Post-hoc editing for everything logged — same pattern as the
  `SkillCheckEditDrawer` already shipped.

## Non-goals

- Custom-stamp authoring UI. The data model will carry a `customStamps`
  field, but the editor ships in a follow-up.
- Voice or audio capture. Backlogged.
- Replacing the bestiary / NPC note flow (tap-PC is for PCs, not monsters).
- Removing the Tiptap editor anywhere it exists today. It stays on
  `/note/:id/edit` as the prose surface.

## Flow

### Root — what the FAB opens

- Drawer titled "Quick Log".
- **Character tray** at top: every PC in the party (resolved via
  `activeParty.members` + linked `CharacterRecord`), one chip each. An
  **"Other"** chip at the end for ambient / non-PC entries.
- **Text note** button below the tray — opens the stripped-down text-note
  form in the same drawer (replaces the current Quick Note drawer entirely).
- **X** in the top-right dismisses the drawer.

### PC palette — tap a PC in the tray

Same drawer, step 2:

- **Skill check** row at the top, large target, opens the existing skill
  list for that PC (the flow today's `SkillCheckDrawer` uses for its step 1,
  lifted into this drawer).
- **Heroic Abilities** — every ability on that PC's sheet, one chip each.
- **Spells — prepared** — every spell with `prepared: true`, plus any spell
  with `pinnedAsStamp: true` regardless of prepared state.
- **Pinned custom stamps** (future — empty in v1).
- **Back arrow** returns to the root tray; **X** still closes the drawer.

### Outcome — tap any palette item

Same drawer, step 3:

- Header shows `{PC name} · {item name}`.
- **Modifier chips** row (Boon / Bane / Pushed) pre-populated from session
  defaults where applicable (skill checks inherit from `sessionState`; for
  spells/abilities they default to off).
- **Four outcome buttons**: Success, Failure, Dragon, Demon — the same
  component and styles the skill-check flow uses today.
- Tap an outcome → write the note, close the drawer, show a toast locating
  the log (session vs. encounter).

### Text note — tap the root "Text note" button

- Title field + type chips (Note / Location / Loot / Rumor / Quote / Recap)
  + optional "More…" expander (tags, PC/NPC chips, attach-to — all the
  existing bits, hidden by default).
- **No Tiptap** in this drawer.
- **"Open in rich editor"** primary button → creates the note and navigates
  to `/note/:id/edit`. **Save** secondary button saves without navigating.
- Cancel / X close without saving.

## Data model

### Note types

- Skill checks continue using `type: 'skill-check'`, unchanged from today.
- Spells: new type `'spell-cast'`. `typeData = { spellId, spellName, castedBy, result, mods }`.
- Heroic abilities: new type `'ability-use'`. `typeData = { abilityId, abilityName, usedBy, result, mods }`.

`result` is one of `'success' | 'failure' | 'dragon' | 'demon'` across all
three. `mods = { boon, bane, pushed }`. This matches the shape
`SkillCheckEditDrawer` already edits, so the editor generalises with a
label swap.

Add the two new values to `NOTE_TYPES` in `src/types/note.ts`. Add matching
icon entries in `sessionTimelineIcons.tsx` and track config entries in
`sessionTimelineConfig.ts` and `defaultTimelineTrackCatalog.ts`.

### Pinning

Add `pinnedAsStamp?: boolean` to `Spell` and `HeroicAbility` in
`src/types/character.ts`. No schema migration is needed — the field is
optional and defaults to `false` at read time. A small toggle renders on
the spell card and ability card (Combat / Magic screens) in edit mode.

### Custom stamps (data-only in v1)

Add `customStamps?: CustomStamp[]` to `AppSettings`, keyed per campaign —
`customStamps?: Record<string, CustomStamp[]>` — where `CustomStamp`
is `{ id, label, template, typeData? }`. The v1 palette reads this array
and renders stamps when present; the editor ships later.

## UI — where it lives

- New file: `src/features/session/quickLog/QuickLogDrawer.tsx` hosts all
  three steps (tray → palette → outcome).
- New file: `src/features/session/quickLog/PCPalette.tsx` renders step 2.
- New file: `src/features/session/quickLog/OutcomeStep.tsx` renders step 3
  and calls `noteRepository.createNote` on tap.
- `QuickNoteAction.tsx` gets trimmed to the stripped-down text-note form
  and moves to `src/features/session/quickLog/TextNoteForm.tsx`. The
  "Open in rich editor" button saves the note, reads back the id, and
  navigates to `/note/:id/edit`.
- The FAB's drawer content changes from `SessionQuickActions` to
  `QuickLogDrawer`. The old `SessionQuickActions` grid is retired — the
  tray is now the front door. Its sub-drawers (SkillCheckDrawer, etc.)
  remain as called-into components, not entry points.

### Editor generalisation

- `SkillCheckEditDrawer` becomes `OutcomeNoteEditDrawer` — same UI, but the
  skill/character labels adapt to `'spell-cast'` and `'ability-use'` when
  the note is one of those. Reuses the same `typeData.result` + `mods`
  shape, so only the top label swaps.
- `useNoteOpenDispatcher` adds `'spell-cast'` and `'ability-use'` to the
  list of types that open the drawer in place rather than navigating to
  Tiptap.

## Why this shape

- **One drawer, one mental model.** The user's own framing is "pick who,
  pick what they did, pick how it went." Each step fits one thumb-scroll
  and never more than ~6 buttons at once.
- **Reuses existing plumbing.** Skill check flow, outcome buttons, edit
  drawer, note repository — all already shipped. Net-new surface is the
  tray and the palette.
- **Data model is homogenous.** Three note types share `result + mods +
  {subject, actor}`, so the post-hoc editor and the timeline icons all
  stay simple.
- **Defers the risky bits.** Custom stamps are load-bearing long term but
  the authoring UI is big; deferring it without cutting the data field
  means the ambitious version ships later with zero migration.

## Success criteria

- From a tap on the FAB to a fully-logged skill check, spell cast, or
  ability use: **three taps maximum** (PC → item → outcome). Today's
  skill-check path is 4 taps at best and other actions are 8+.
- Every row logged from the drawer is editable in place via the
  generalised outcome editor — no one ever lands in Tiptap by accident
  while fixing a mistake.
- Plain text notes still take four taps (FAB → Text note → type in title →
  Save), and the "Open in rich editor" path is one extra tap, never more.

## Risks / open questions

- Timeline iconography for `spell-cast` / `ability-use` needs icons
  chosen. Easiest: reuse the existing magic/ability icons already in
  `GameIcon`. Low risk, addressed during implementation.
- Some PCs have lots of heroic abilities; palette length bounds are worth
  watching in play. If it becomes noisy, add a "Pinned only" toggle — but
  do not block v1 on it.
- The outcome buttons' Dragon/Demon semantics don't map cleanly onto
  heroic-ability use. Decision: keep the four buttons uniformly — a
  heroic Dragon is a great story beat, and not forcing a mapping keeps
  the editor simple. Users can ignore Dragon/Demon for abilities in
  practice; the note still reads fine with just Success/Failure.
