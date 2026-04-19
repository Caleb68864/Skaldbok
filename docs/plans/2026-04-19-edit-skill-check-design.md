# Edit Logged Skill Checks — Design

_Date:_ 2026-04-19
_Status:_ Plan (ready for implementation)

## Problem

Skill checks are logged as notes with `type: 'skill-check'` and a structured
`typeData = { skill, result, character }` payload (see
`src/features/session/actions/SkillCheckDrawer.tsx:176`). When the GM taps a
skill-check entry in the session timeline or Notes grid, both call sites
(`src/features/notes/NotesGrid.tsx:237` and
`src/screens/SessionScreen.tsx:549`) navigate to `/note/:id/edit`, which
opens the Tiptap rich-text editor — useless for fixing "I pressed Dragon by
mistake, it was a regular success."

## Goal

When the user taps a logged skill-check entry anywhere in the app (timeline,
Notes grid, anywhere a note is opened), show a compact editor that lets them
fix the structured fields — skill name, result (success/failure/dragon/
demon), modifiers (boon/bane/pushed), character/party attribution — and
persist the corrected row without touching Tiptap.

## Non-goals

- Retroactive stat adjustments. Flipping a Dragon off a skill does not
  un-dragon-mark the character's skill on the sheet. The log is a record
  of what happened in play; skill-mark state is managed separately.
- Full audit history of edits. A single edit overwrites the row, same as
  today's Tiptap edits.
- New skill-check fields. Scope is exactly the fields captured at log time.

## Approach

Route the existing note-open gesture through a type-aware dispatcher:

1. Add a `SkillCheckEditDrawer` component. It mirrors the result-entry step
   of the existing `SkillCheckDrawer` (skill label, modifier chips, four
   outcome buttons) plus a "Delete entry" action. It is bound to an existing
   note record, not a fresh log.
2. Add a lightweight **"open note"** dispatcher — a shared function (e.g.
   `openNoteForEdit(note, navigate, openSkillCheckEdit)`) — that inspects
   `note.type` and either:
   - for `'skill-check'`, opens the skill-check drawer in place, or
   - for every other type, falls through to `navigate('/note/:id/edit')`.
3. Plumb the dispatcher (and drawer state) through the two tap call sites:
   `NotesGrid` and `SessionScreen`'s timeline. Both screens already own
   modal state, so each can mount its own `<SkillCheckEditDrawer>` and pass
   the dispatch function into the row/timeline components. (No new global
   context — keeping state local avoids churn in CampaignContext.)
4. On save, the drawer rebuilds the note's `title` from the current fields
   (using the same formatter `SkillCheckDrawer` already has internally —
   refactor it into a shared `formatSkillCheckTitle(typeData)` helper) and
   writes the updated `typeData` + `title` through
   `noteRepository.update`.

## Why this shape

- **Reusing the drawer primitive** keeps this feature's UI consistent with
  the quick-log flow; the GM is already fluent with that surface.
- **Type-dispatch on tap** gives us a natural extension point. If we later
  want an inline editor for `npc` or `loot` notes, we add another case to
  the dispatcher. No route changes are needed.
- **Skipping Tiptap entirely** for system-generated notes matches the
  comment at `NoteEditorScreen.tsx:36`: these notes were never meant to be
  edited as prose.

## File-level changes

New:

- `src/features/session/actions/SkillCheckEditDrawer.tsx` — opens for an
  existing skill-check note; submit calls `noteRepository.update`.
- `src/features/session/actions/formatSkillCheckTitle.ts` — shared title
  formatter extracted from `SkillCheckDrawer`.
- `src/features/notes/openNoteForEdit.ts` — tiny dispatcher hook/function.

Edited:

- `src/features/session/actions/SkillCheckDrawer.tsx` — use the shared
  formatter instead of the inline one (no behavior change).
- `src/features/notes/NotesGrid.tsx` — replace the direct `navigate` call
  with the dispatcher; mount the edit drawer at the grid level.
- `src/screens/SessionScreen.tsx` — same swap for the timeline's
  `onOpenNote`. Keep the `/note/:id/edit` navigation as the fallback.
- `src/storage/repositories/noteRepository.ts` — confirm an `update` path
  exists for editing `typeData` + `title`; add one if missing.

## Data contract

The edited row's `typeData` stays the same shape:

```ts
{ skill: string; result: 'success' | 'failure' | 'dragon' | 'demon'; character: string }
```

Modifier state is re-derived from the title (today's contract already puts
`(Boon, Bane, Pushed)` into the title). To avoid parsing strings on edit,
introduce `typeData.mods: { boon, bane, pushed }` going forward — and the
drawer falls back to parsing the title if the field is missing (for rows
logged before this change). The title is always rewritten from the final
state on save.

## Soft delete and cascade

"Delete entry" on the drawer calls `noteRepository.softDelete(noteId)` — the
same path the Notes grid uses today. No new cascade is needed.

## Success criteria

- Tapping a skill-check row in the timeline or Notes grid opens the new
  drawer, never Tiptap.
- Changing the result from Dragon → Success rewrites both the title and
  `typeData.result`, and the timeline row updates without a reload.
- Tapping a non-skill-check note still opens the Tiptap editor exactly as
  it does today.
- "Delete entry" soft-deletes the note and hides it from the default views.

## Estimated effort

Half a day. The drawer is a trim of the existing `SkillCheckDrawer`; the
dispatch is a ~10-line helper; the two call-site swaps are mechanical.

## Follow-ups (not in this plan)

- Apply the same "type-dispatch on tap" to `npc` notes so tapping an NPC
  entry opens the creature template, not the prose editor.
- Optional: flip the related skill's `dragonMarked` / `demonMarked` flag
  on the PC when the logged result is corrected. Only worth doing once we
  have a clear story for "did this session already count this skill?".
