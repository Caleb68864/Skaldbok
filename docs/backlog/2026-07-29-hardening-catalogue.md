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

> **Read this before trusting a status.** The first version of this file marked
> the whole Traveller section OPEN by copying the wave-4 report rather than
> checking the code, and four of five items were already fixed. Sections carrying
> a dated "verified" note have been checked individually; anything else is
> inherited and may be stale. Re-check before acting on it.

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

## OPEN — Traveller

**Correction (2026-07-29).** This section was originally copied from the
2026-07-28 wave-4 report **without re-checking it**, despite this file claiming
to be status-verified. Four of the five items had already been fixed. Verified
individually this time.

| Was | Item | Actual status |
|---|---|---|
| T1 | Log records damage as "Healed" | **Already fixed** — `useSessionLog` carries an `accumulates` flag and `SheetScreen` derives it from the resource's `direction` |
| T2 | `DamageHealModule` logs nothing | **Already fixed** — it imports `useSessionLog` and logs every outcome |
| T3 | Ticking Wounded double-penalises | **Already fixed** — `linkedAttributeId` removed from all three Traveller conditions; `system.json` at v10 |
| T4 | "Recover All" unconfirmed | **Already fixed** — two-step tap-again-to-confirm, self-clearing after 5s |
| T5 | One hit can never kill | **Fixed `bbf4b89`** — overflow continues through the remaining tracks |
| — | Knocked-out state never stored | **Fixed `bbf4b89`** — `DamageTrackModel.statusConditions` + sync in `writeResources` |

### T6. ~~Contract test that cannot fail~~ — **fixed `dadb95d`**
`engineContract.test.ts` gained behavioural assertions (adapter routing by
function identity, producer/consumer key agreement, capability coherence, actual
invocation of the function-valued fields), and a new `engineConsumers.test.ts`
scans source for the consumer-side mistakes no engine-internal assertion can
reach. `TempModifier.duration` is no longer a closed Dragonbane union, and
`AddModifierDrawer` no longer defaults to the literal `'stretch'`. Every
assertion was mutation-tested.

### T7. ~~Traveller has no modifier UI~~ — **already fixed in `708cce3`**
`modifierAndConditionExtras` is shared by both the attributes and characteristics
panels. I listed this as open on 2026-07-29 without checking the code — the
**second** time in one session I reported a Traveller item open that was already
done. Verify before reporting.

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
