# Hardening catalogue — verified 2026-07-29

Consolidated, **status-verified** backlog. Supersedes the running count I quoted
in conversation ("52 remaining findings"), which was never written to a file and
was inflated — this is what actually exists, checked against the code on
`2026/07/28-1026-caleb-fix-traveller-modifiers` at commit `f185ca2`.

Sources merged: the 2026-07-26 three-wave multi-agent sweep, the 2026-07-28
Traveller/engine wave (`docs/plans/2026-07-28-traveller-hardening-findings.md`),
the notes-overhaul converge run (`docs/converge/2026-07-29-notes-overhaul-completion/`),
and `docs/decisions.md`.

Status values: **OPEN** (verified still present) · **DONE** · **BLOCKED**
(needs hardware or a product decision) · **UNVERIFIED** (carried over, not
re-checked today).

---

## Fixed since the notes overhaul shipped

| # | Item | Commit |
|---|---|---|
| F1 | Temp modifiers inert app-wide — call sites passed bare ids to `getEffectiveValue` | branch HEAD; `SheetScreen` now passes `attrKey(...)` |
| F2 | E2E suite drove the deleted quick-action UI and reported 100% while crashing | `543b42f` |
| F3 | End Encounter dialog had no `aria-describedby` | `eba7483` |
| F4 | Approving a 2nd wikilink suggestion unresolved the 1st (`docToText` round-trip nulls ids) | `754547a` |
| F5 | `[[Sir [[Aldric]]]]` double-wrap — retired structurally by doc-based application | `754547a` |
| F6 | `onCreateNote` never supplied → "Create NPC note" a permanent no-op | `4b09d11` |
| F7 | Review sweep offered Approve and silently discarded it | `4b09d11` |
| F8 | Timeline Tracks/Filters menus unbounded → rows past the fold unreachable | `4b09d11` |
| F9 | `ParticipantDrawer` hardcoded HP/Armor/Mv (was E1) | `a1ce0a8` |
| F10 | `MagicScreen`/`MagicSpellCard` bypassed `engine.magic` — non-`wp` systems could never cast (was E2) | `f185ca2` |
| F11 | `toSpells` projected `cost.wp` literally, so a `{ psi: 3 }` spell read as free | `f185ca2` |

---

## OPEN — engine-rule violations

### E1. `PLAY_MODE_EDITABLE_PREFIXES` is ~75% dead and Dragonbane-hardcoded
`src/utils/modeGuards.ts`. Only `armor.equipped` / `helmet.equipped` are ever
queried; `resources.hp.current`, `resources.wp.current`, `deathRolls.*`,
`conditions.`, `weapons.` have no call site. It also hardcodes Dragonbane
resource ids, and `SheetScreen` guards every system's maxima with the literal
path `resources.hp.max` — Traveller's str/dex/end damage tracks are unrepresented.
Behaviour is currently correct *by accident*; the config is misleading.

---

## OPEN — Traveller table-affecting (from the 2026-07-28 wave)

### T1. Damage logged as "Healed" on an accumulating track
Sign is not flipped for a track that accumulates rather than depletes.

### T2. `DamageHealModule` logs nothing at all
The primary damage surface produces no session-log entry.

### T3. Ticking Wounded double-penalises
Conditions declare `linkedAttributeId: "end"`, so the condition penalty stacks
with the END damage it represents.

### T4. "Recover All" is a one-tap unconfirmed wipe
Sits next to a disabled (dead-zone) Heal button. Destructive, no confirm.

### T5. One hit can never kill
A single overflow slot against `deadAtDepleted: 3`.

### T6. Four producer/consumer key spaces with zero assertions
Three of four have a hardcoded closed union on the consumer side with a cast
hiding the mismatch. `engineContract.test.ts` passes **every** finding in the
wave-4 report — it never renders a component and never invokes a function-valued
engine field. A contract test that cannot fail is the real defect here.

---

## OPEN — data integrity

### D1. KB graph not integrated with soft-delete
`src/features/kb/linkSyncEngine.ts`. Note *soft*-delete leaves ghost `note-<id>`
nodes and live backlinks visible in GraphView/BacklinksPanel. Also: duplicate-edge
race (fire-and-forget non-transactional `syncNote`), no placeholder re-resolution
when a `[[target]]` note later appears, and lossy slug ids merging distinct
labels. Partially mitigated — `softDeleteWithLinks` now calls `deleteNoteNode` —
but restore does not re-sync and `syncNote` is still unserialized.

### D2. Reference groups keyed on a mutable title string
`referenceSectionRepository`. The group→section relationship joins on the
group's `title`, not a stable id, so two cards both named "New Card" share and
clobber each other's sections and cannot be deleted. Classic
label-as-join-key. Needs a migration.

### D3. `referenceSection` / `referenceGroup` hard-delete
Dexie v11/v12 tables violate the project-wide soft-delete convention (added
after them).

### D4. Bundle import strips non-character entity fields
Only `characterRecordSchema` has `.passthrough()`. note / creatureTemplate /
session / campaign / party / encounter schemas drop unenumerated fields on
import, so a Traveller/SWADE bestiary loses its system stats. Adding
`.passthrough()` to the shared storage schemas broke the build (ripples into
`z.infer` index signatures) — needs **separate bundle-parse schemas**, not edits
to the storage types.

### D5. Dexie v7 ref-note migration emits malformed notes
`client.ts:268` spreads a ReferenceNote into `notes` without
`campaignId`/`body`/`status`, so `baseNoteSchema` drops it on read. Legacy
bundled content only. LOW.

### D6. Import envelope `type` not cross-checked against contents
`bundleParser`. A hand-edited or community bundle with a mislabelled `type`
merges as the wrong kind. Matters for the community-template goal.

### D7. Referential closure prunes rather than includes
`src/utils/export/referentialClosure.ts` drops edges whose endpoints fall
outside the bundle. Correct and honest, but the *better* fix is to widen
collection so the endpoint ships.

---

## OPEN — session log

### S1. Two tabs on one session share a draft key
They clobber each other's in-progress text.

### S2. `useSessionLog` flush-on-end loses buffered entries
`endSession` nulls `activeSession` synchronously, so the flush effect runs with a
null-bound (no-op) `logToSession` and wipes the coin/HP buffer. End-of-combat
"Took N damage" / "Coins ±N" lines written <3s before End Session are lost
(session log only — character HP itself saves). Also a stale-closure
wrong-session flush on unmount (`[]` deps).

### S3. `textToDoc` rewrites CRLF and collapses blank runs
Editing an entry round-trips its body and reflows it.

### S4. Timeline viewport resets on every commit
`TimelineRoot` unmounts, discarding the user's zoom and pan. The viewport is
seeded once at mount and only "self-heals" because of that unmount.

---

## OPEN — accessibility

### A1. ~11 hand-rolled `<div role="dialog">` modals
CampaignCreateModal, ManagePartyDrawer, QuickNoteDrawer, ParticipantDrawer,
CreatureTemplateForm, ImportPreview, inline dialogs in SessionScreen /
EncounterScreen, stale-session in CampaignContext. No focus trap, no Escape, no
focus restore. Route them through the existing Radix Modal/Drawer wrappers.

### A2. Non-keyboard-operable controls
`NotesGrid` note cards are `<div onClick>`. (`AttachmentThumbs` was deleted in
the tidy sweep, so its 20px destructive target is moot.)

---

## OPEN — config-over-hardcoding

### C1. `TagPicker` hardcodes a tag-preset list
Previously *two* divergent lists; `SessionQuickActions` was deleted, so one
remains. Should move to `src/config/defaults/*` read via a hook.

### C2. `PartyInventoryTab` imports a default directly
Uses `DEFAULT_INVENTORY_CONTAINER_KINDS` instead of a selector — no selector
layer exists yet.

---

## OPEN — latent / dead code

### L1. `PrintableSheetScreen` ignores `?characterId=`
Always prints the active character.

### L2. `useEncounter.startEncounter` (dead variant)
Can violate the one-active-encounter invariant. Delete or harden before reuse.

### L3. `notesToTimeline.buildTrack` silently drops `defaultHidden`
No production consumer today. Matters if that adapter is ever wired to a screen.

### L4. `applySuggestionToBody` has no production caller
Kept for its test coverage and documented non-chainable. Candidate deletion.

### L5. Duplicate `ProseMirrorNode` type
Declared in both `features/notes/textToDoc.ts:10` and
`features/notes/SuggestedLinksPanel.tsx:24`. Structurally identical, so they
interoperate — but they can drift.

### L6. `renderCampaignIndex.ts` unreferenced
Reads as an export-pipeline gap rather than dead code. Investigate before
deleting.

### L7. Residual Dragonbane literals in the magic surface
The spell edit drawer writes a literal `wpCost: 2` default
(`MagicScreen.tsx`), and `SpellCard.tsx` prints the header `WP Cost:`. Both
are display/default-only now that casting itself is engine-driven, but they
are the last `wp` literals in that surface.

---

## OPEN — screens ignoring play/edit mode

### P1. Most screens never consult play/edit mode
Still ungated, and **the user explicitly said "the rest can stay the way it is
for now"**: CharacterLibrary (16 write affordances), NoteEditor (9), Session (8),
Trash (5). Also the character sheet's portrait file-picker is the one input still
enabled in play mode (69/70 disabled). Listed for completeness, not as a
recommendation to change.

---

## BLOCKED

### B1. Tab S9 + S Pen handwriting fit
Requires the physical device. A `[HUMAN REVIEW]` criterion by design.

### B2. Timeline `notes` collapsed-by-default
The catalog wants `collapsed: true`; needs a visual check that the expand
affordance works before flipping it, or note lanes vanish.

---

## Verified clean — do not re-investigate

Migrations; storage soft-delete coverage and the Dexie index ladder
(compound-prefix queries safe); core math / currency / stat-keys; sheet, skills
and gear screens; system-engine adapters; circular-import guard; attachment
base64 round-trip; React effects/keys/sort-copies; type-safety and unsafe casts;
inventory container wealth math; reference soft-delete (no `deletedAt` field by
design); print-sheet null-safety; the bundle **merge** engine cluster (a–f
complete, 12 tests); zero illegitimate `systemId ===` branches; no label-derived
storage keys; Traveller core 2d6/3d6 math.
