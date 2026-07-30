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

> **Re-verified 2026-07-29 (second pass).** Every item below outside the
> Traveller section has now been checked against the code individually, with the
> evidence recorded inline. All of them are genuinely open. The two bad calls
> this session were both in the Traveller section, which had been copied from the
> wave-4 report; the items inherited from the earlier waves hold up.
>
> **Read this before trusting a status.** The first version of this file marked
> the whole Traveller section OPEN by copying the wave-4 report rather than
> checking the code, and four of five items were already fixed. Sections carrying
> a dated "verified" note have been checked individually; anything else is
> inherited and may be stale. Re-check before acting on it.

---

## Status — swept 2026-07-29

Every catalogued item was worked. What follows is the closing position.

### Closed
| Item | Where |
|---|---|
| F1–F11 | earlier commits today (modifiers, E2E honesty, wikilink chaining, create-record, timeline menus, creature labels, engine.magic) |
| T5 + knocked-out state | `bbf4b89` |
| T6 contract test that cannot fail | `dadb95d` |
| T7 Traveller modifier UI | already fixed in `708cce3` |
| L1 print `?characterId=` | `75637c5` — loads the requested character without switching the active one |
| L2 dead `startEncounter` | `d1fb38c` — removed, with the two orphaned hook params and screen props |
| L3 `defaultHidden` dropped | `d1fb38c` |
| L4 `applySuggestionToBody` | `d1fb38c` — deleted |
| L5 duplicate `ProseMirrorNode` | `d1fb38c` — one owner, re-exported |
| L6 `renderCampaignIndex` | `d1fb38c` — **wired**, not deleted; it was a pipeline gap |
| L7 residual `wp` literals | `d1fb38c` — `SpellCard` deleted, cost default from the engine |
| C1 / C2 config selectors | `d1fb38c` — `useConfigurableDefaults` is the layer that was missing |
| S1 shared draft key | `6b0b39d` — per-tab, with orphan adoption so reopening still recovers |
| S2 flush-on-end data loss | `6b0b39d` — buffers carry their session; unmount reads callbacks from a ref |
| S3 CRLF round-trip | `6b0b39d` |
| S4 timeline viewport reset | `6b0b39d` |
| D2 title-as-join-key | `1b5e70a` — schema v14 `groupId`, backfilled and tested |
| D3 reference hard delete | `1b5e70a` — soft delete with cascade and restore |
| D4 import field stripping | `1b5e70a` — separate permissive parse schema |
| D5 v7 ref-note migration | `1b5e70a` |
| D6 envelope scope check | `1b5e70a` |
| D7 closure pruning | `75637c5` — collection widened; closure kept as backstop |
| E1 dead play-mode policy | `75637c5` |
| A2 keyboard-inoperable cards | `75637c5` |
| D1 duplicate-edge race | `16c3c0e` — syncs serialised per note |
| D1 placeholder scope / resolution / reaping | `8fafeea` |
| B2 collapsed Notes lane | already live via `sessionTimelineAdapter`; needed no change |
| A1 all 14 dialogs | `75637c5` (8) + `5f2dd41` (6) |

### Still open — deliberately

**A1 — now complete (`5f2dd41`).** All fourteen hand-rolled dialogs use
`useModalBehaviour` for focus trap, Escape and focus restore. The six left in the
first pass had their dialog rendered conditionally or nested inside a backdrop,
so the ref goes on the inner panel and the hook takes the open flag. The better
end state is still the Radix wrappers; the hook is deliberately the same
contract, so each remains a straight substitution.

**D1 — now complete (`8fafeea`).** The race was fixed in `16c3c0e`;
soft-delete integration was already done. The remaining two are closed:
placeholder ids are campaign-scoped and no longer slug-merged, a placeholder is
folded into the note or character that later resolves it, and orphaned stubs are
reaped. Nothing remains under D1.

**P1 — investigated and closed (`579311e`), almost entirely a non-finding.**
Play mode is scoped by its own spec to the character *sheet*: it locks a
character's build so a mistap at the table cannot rewrite it. Gating the four
screens listed would have been a regression — writing notes and running a session
are what play mode is *for*, and neither screen writes character data. Trash only
restores (`hardDelete` has no UI caller), and Library's Delete is a confirmed
soft delete recoverable from Trash. One line was real: the hidden portrait file
input now carries `disabled={!isEditMode}`. The audit's "69/70" was
reachability-blind — the upload button that opens that input is already inside
`{isEditMode && (}`.

**B1.** Tab S9 + S Pen handwriting fit. Needs the physical device.

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
