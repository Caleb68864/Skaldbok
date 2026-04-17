# Skaldbok playtest - 2026-04-16

## Scenario

I used the app as if I were running and tracking a real session rather than reading tests or code paths first.

Play sequence:

- Created campaign: `Ashes of Rime`
- Started `Session 1 - 2026-04-16`
- Created two characters: `Brynja Frostvein` and `Rurik Emberhand`
- Switched active character and edited character sheet values
- Added party membership through `Manage Party`
- Started a combat encounter: `Bridge Ambush`
- Added combat participants through quick-add
- Logged combat progress, damage/state, and round advancement
- Started a nested social encounter: `Questioning the Courier`
- Logged loot and confirmed it appeared in session notes and the knowledge base
- Ended the social encounter and then ended the session

## What worked

- Campaign creation worked cleanly from the first-run state.
- Starting a session from the session page worked immediately and updated the header correctly.
- Character creation worked reliably and the library updated right away.
- Switching the active character worked, and the sheet changed over to the new character.
- The character sheet mode toggle worked: after switching out of play mode, fields became editable and attributes/resources exposed editing controls.
- Editing identity fields on the character page worked.
- Encounter creation worked for both combat and social encounter types.
- Nested encounters worked in practice. The social encounter correctly showed `Started during: Bridge Ambush`.
- The session timeline updated as encounters and notes were created.
- Quick Log note creation worked well once opened.
- A loot note created from Quick Log showed up in:
  - the session timeline
  - the session notes list
  - the knowledge base note detail page
  - the active encounter's attached log
- Opening a session note into the KB detail page worked.
- Ending the session worked and moved the session into the past sessions area.

## What did not work well

- Encounter participant management is not party-aware in the way I expected.
  - `Add participant` searched the bestiary only.
  - I could not add existing player characters directly as encounter participants from the normal participant picker.
  - To keep going, I had to use `Quick Add Participant` and manually recreate a PC as a `monster`.
- The quick-add participant dialog fields are not self-explanatory.
  - They resolved to `HP`, `Armor`, and `Movement` placeholders in automation, but the UI structure is easy to misread at first glance.
  - For a real player at the table, this feels like guesswork.
- The combat section showed inconsistent participant counts.
  - The main section header still read `Participants (0)` while the combat panel below correctly showed `Participants (2)`.
  - That makes the screen feel out of sync even when the data exists.
- Ending combat/encounters is a little uneven.
  - Combat used a browser confirm prompt.
  - Social encounter end used an in-app modal with summary text.
  - Both flows worked, but the inconsistency is jarring.
- After ending the session, the `Last Session` / `Past Sessions` date display showed `4/15/2026` even though the session title and creation flow were clearly for `2026-04-16`.
  - That looks like a timezone or display bug.

## What was painful

- Discoverability around character editing is rough.
  - The `PLAY MODE` control in the menu did not clearly communicate that it is effectively the mode switch that unlocks editing.
  - Until I toggled it, major parts of the character page looked inert.
- The character library flow feels split from the actual character sheet flow.
  - Creating characters is easy, but moving from "I made a character" to "I am now managing that character in play" is less direct than it should be.
- Party management exists, but it does not feel connected to encounter play.
  - I could add a character to the party through `Manage Party`, but that did not help when trying to run combat.
  - In practice, the party system and the encounter system felt like separate islands.
- Quick Log is powerful, but opening `Quick Log` and then `New Timeline Entry` produces a stacked-modal experience that feels heavier than a true quick action.
- The social encounter inherited the loot note into its attached log because it was the active encounter when the note was created.
  - That may be technically correct, but during play it can be surprising if the loot was actually discovered in the prior combat scene.
- Session notes are useful after creation, but the empty-state path gives very little guidance about what kinds of notes are best created there versus in encounters versus in quick log.

## Overall impression

The app is absolutely usable for a real session skeleton: I was able to create a campaign, run a session, create characters, start encounters, log loot, and end the session without hard blockers.

The biggest friction is in the connection points between systems:

- party -> encounters
- character prep -> character play
- quick log -> encounter ownership

If those seams were tightened, the app would feel much more natural at the table.

## Retest After UX Fixes

I re-tested the documented pain points against the current app on `https://localhost:4173/` after the first round of fixes.

Retest sequence:

- Created campaign: `Playtest Fix Validation`
- Created characters: `Brynja Retest` and `Rurik Retest`
- Verified library -> sheet flow and play/edit discoverability
- Started `Session 1 — 2026-04-17`
- Added both characters to the party through `Manage Party`
- Started combat encounter: `Bridge Retest`
- Tested `Add participant` using party characters
- Tested `Quick Add Participant`
- Opened `Quick Log` -> `Loot`
- Ended the encounter
- Ended the session and checked `Last Session` / `Past Sessions`

## What improved

- Character creation flow is noticeably better.
  - Creating the first character now drops directly into the character sheet instead of leaving me stranded in the library.
  - Secondary character cards now offer `Set Active & Open`, which is much closer to the "I want to play this character now" mental model.
- Character sheet discoverability is better.
  - The page now includes a clear `Play Mode is on` banner.
  - The menu copy explains that switching to Edit Mode unlocks identity and attribute editing.
  - This makes the sheet feel much less inert on first contact.
- Encounter participant picker is now party-aware at the UI level.
  - `Add participant` opened a picker with a `Party Characters` section.
  - Both `Rurik Retest` and `Brynja Retest` appeared there, which is a major usability improvement over the previous bestiary-only flow.
- Quick-add participant is clearer.
  - The form now includes visible labels for `Name`, `HP`, `Armor`, and `Movement`.
  - The helper copy also makes it clear that this path is for one-off monsters/NPCs.
- Encounter ending is more consistent.
  - Combat now uses the same in-app modal style instead of a browser `confirm()` prompt.
- Session history date display no longer drifts backward by one day after ending the session.
  - `Last Session` and `Past Sessions` both showed `4/17/2026`, matching the session title.

## What still did not work well

- Party-character participant selection appears partially broken.
  - The new picker correctly shows party characters.
  - Clicking them did not immediately update the visible combat participant list.
  - After I later used `Quick Add Participant`, the encounter suddenly showed multiple duplicated PC entries:
    - `Rurik Retest` appeared 3 times
    - `Brynja Retest` appeared 2 times
  - This makes it look like the add actions were accepted internally but the UI did not refresh at the right time, then replayed or surfaced all at once.
- Combat participant feedback is still unreliable during live use.
  - The outer stale `Participants (0)` header problem is gone, which is good.
  - But the actual participant area still failed to visibly reflect add actions until a later unrelated action triggered a refresh.
  - That is less confusing than before, but still dangerous in play because it can lead to duplicate taps and duplicated participants.
- Loot still defaults to the active encounter.
  - In `Quick Log` -> `Loot`, the `Attach to` control still defaulted to `Active: Bridge Retest`.
  - I expected this to default to `Session only (no encounter)` based on the intended change.
  - So the surprise ownership problem is still present.

## New or clarified findings

- Session naming/date generation may still be using the wrong date source.
  - The session started at local time `4/16/2026, 8:27:13 PM`.
  - The generated title was `Session 1 — 2026-04-17`.
  - The history display matched that title, so the previous display bug appears fixed.
  - However, the session's canonical date still looks one day ahead of the local play date, which suggests the title/date creation path is still using UTC rather than local calendar date.
- There are still SSL/service-worker errors in local HTTPS dev.
  - The app remained usable for playtesting, but the browser console reported service-worker registration failures due to certificate errors.

## Updated overall impression

This pass materially improved the character and encounter setup experience:

- character creation -> sheet flow is better
- play/edit mode is more understandable
- encounter picker now points at the right entities
- quick-add is easier to understand
- end-encounter UX is more consistent

The biggest remaining playability risk is now more specific:

- adding party characters to combat is visually unreliable and can create duplicates
- loot ownership still defaults in the surprising direction
- session titles still appear to use a next-day date relative to local play time

So the app feels closer to table-ready than the first pass, but encounter participant state and session-date generation still need another round before this feels dependable in live play.

## Follow-up Verification

I fixed the three remaining blockers and re-tested them in the live app.

Verified fixes:

- Session date/title generation now uses the local calendar day.
  - Browser local date was `2026-04-16`.
  - Starting a new session created `Session 2 — 2026-04-16`.
  - This matches the actual local play date and no longer jumps ahead to the next day.
- Combat participant adds now reflect immediately in the combat view.
  - Adding `Rurik Retest` from the `Party Characters` picker updated the visible combat list right away.
  - Re-adding the same PC did not create duplicates.
- Loot now defaults to session-level ownership in Quick Log.
  - In `Quick Log` -> `Loot`, the `Attach to` select opened with `Session only (no encounter)` selected.

Implementation summary:

- local-date helper for session creation instead of slicing a UTC ISO timestamp
- combat view syncs to parent encounter updates after participant picker changes
- PC encounter adds guard against duplicate character entries
- loot attach defaults corrected in the quick-log path that is actually used during play

## Status of Original Findings

Fixed from the original list:

- Encounter participant management is now party-aware.
- The quick-add participant dialog is clearer and labeled.
- Combat no longer shows conflicting participant counts.
- Combat/social encounter end flows are now consistent.
- Session history date display no longer drifts backward by timezone.
- Character editing is more discoverable from play mode.
- Character library flow connects to the sheet much better.
- Party management now connects to encounter play in the core participant flow.
- Loot no longer defaults to the active encounter in Quick Log.

Still worth improving:

- Quick Log note entry still feels heavier than it should because it stacks another surface inside the quick-log drawer.
- Session Notes empty state still needs clearer guidance about when to use quick log vs encounter logs vs session-level notes.
- Combat setup could still be faster with a one-tap "add the whole party" action.

## Verification After High-Value UX Follow-Ups

I implemented and tested the next three highest-value follow-ups from the remaining pain points.

Verified improvements:

- Quick Log note entry no longer stacks an extra drawer on top of Quick Log.
  - Using `Quick Log Note` now opens the full note composer inside the existing quick-log drawer.
  - I saved `Retest Session Note` through this flow and it appeared immediately in Session Notes.
- Session Notes empty state now gives clearer guidance.
  - The empty state explains the difference between Quick Log, encounter logs, and session-level notes.
  - It also offers direct actions:
    - `Quick Log Note`
    - `Open Knowledge Base`
- Combat now has a one-tap `Add Entire Party` action.
  - In a combat encounter with only `Rurik Retest` present, pressing `Add Entire Party` added `Brynja Retest` immediately.
  - Pressing it again did not duplicate participants and showed the correct "already in this encounter" feedback.

Updated status:

- The stacked-modal Quick Log note issue is fixed.
- The Session Notes empty-state guidance issue is fixed.
- The "party system and encounter system feel like separate islands" problem is improved again with a direct full-party import during combat setup.

## Verification After Next 3 Follow-Ups

I implemented and tested the next three highest-impact improvements after that pass.

Verified improvements:

- Start Encounter can now preload the active party.
  - I started `Social Party Autofill Retest` with `Include active party` left on.
  - The social encounter opened with both `Rurik Retest` and `Brynja Retest` already present as participants.
- Non-combat encounters now support `Add Entire Party` too.
  - I started `Exploration Manual Party Retest` with `Include active party` turned off.
  - It opened with `Participants (0)`.
  - Pressing `Add Entire Party` added both party characters immediately.
- Newly created characters now land in edit mode when promoted into use.
  - I created `Edit Mode Retest`, used `Set Active & Edit`, and landed on the character sheet with editable fields exposed instead of the play-mode lock state.

Implementation summary:

- extracted shared `addPartyCharactersToEncounter` helper so combat, non-combat, and encounter-start seeding all use the same duplicate-safe logic
- added `Include active party` to the Start Encounter flow
- added `Add Entire Party` to non-combat encounter screens
- updated newly-created-character activation flow to switch into edit mode before opening the sheet
