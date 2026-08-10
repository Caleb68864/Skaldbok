# Full Thrust fleet sheets — same app or a new one?

**Date:** 2026-08-10
**Supersedes:** the 2026-07-27 evaluation (memory: `full-thrust-fleet-sheets-evaluation`)
**Status:** decision — same app, with a spike as the next action

## Why this is being re-decided

The July evaluation stopped on a blocking architectural asymmetry:

> `Ship` is not engine-driven, unlike `Character`. `src/types/ship.ts` hardcodes
> Traveller axes (jump, fuel, cargo tons, TL, upkeep in credits) and
> `ShipsScreen` never calls `useSystemEngine`. So a new system's ships cannot be
> expressed by adding a `system.json` the way character sheets can.

**That premise is now false.** As of `1d5cd36` (2026-08-10), vehicles are a
ruleset declaration: `SystemDefinition.vehicles` declares the label, the live
counters, the build specs (grouped into panels) and the crew roster, and the
record stores open `counters` / `specs` bags keyed by those ids. `ShipsScreen`
names no ruleset's concepts. A Full Thrust ship sheet — Mass, Thrust, Hull rows,
Screens, FTL — is expressible as JSON today, with no code change.

The decision was made on a fact that no longer holds, so it has to be re-made.

## What is still true

The second half of the July finding stands, and it is the real question:

- **`SystemEngine` is person-shaped.** Attributes, skills, rest, death,
  advancement. Full Thrust has no PCs at all.
- **The shell is character-primary.** `BottomNav` hardcodes a "Characters" tab,
  and `useSystemEngine` keys off the *active character* — a system with no
  characters has no engine unless every surface uses `useSystemEngineFor(systemId)`.

Two smaller facts, verified while writing this:

- A character-less system **does** validate. `attributes`, `resources` and
  `skillCategories` are required arrays but carry no `.min()`, so empty ones pass
  the schema.
- Ships **cannot** currently join an encounter. `EncounterParticipant.type` is a
  closed `z.enum(['pc', 'npc', 'monster'])`. The `represents` edge itself is
  fine — `entityLink.toEntityType` is a free string.

## What Full Thrust would still need

1. **A fleet.** Ships are campaign-scoped with an optional owning character, so
   today one campaign is one fleet. A battle has at least two opposing fleets.
   This is the one genuinely missing entity — either a `Fleet` row that ships
   point at, or reuse of `Party` as a grouping.
2. **Ships as combat participants.** Widening the participant enum, plus
   `represents → ship`. Small, but it is a structural enum, so it is a migration
   rather than a preference.
3. **Damage boxes, not counters.** A Full Thrust hull is rows of boxes crossed
   off, and armour/screens absorb before hull. `counters` models a current/max
   pair, which approximates it but loses the row structure that makes threshold
   checks legible at the table.
4. **Arcs and weapon rows.** `weapons` on a vehicle is `string[]`. Full Thrust
   wants arc, range band and dice per mount — the same treatment `itemFields`
   gives weapons on a character.
5. **Hiding the character surfaces** for a system with no characters.

Items 3 and 4 are the same shape as work already done twice this month
(`financeFields`, `vehicles`): declare the fields, render them generically. Item 5
is the `labels.abilitiesScreen: null` pattern applied to a whole tab.

## Decision

**Same app.** The blocker that argued for a separate app is gone, and the
remaining gaps are ordinary feature work in the direction the codebase is already
moving — not fighting the architecture.

The supporting reasons are unchanged from July and still hold: one offline
install on the tablet that is already at the table, and campaign/session/notes/
timeline/reference/export reused wholesale rather than rebuilt.

The argument *against* — that Full Thrust is its own game night, so only
infrastructure is shared — is real but weaker than it was: with vehicles
declarative, "only infrastructure" now includes the entire ship sheet.

## Next action: spike before committing

Do **not** start with the fleet entity. Start with the cheapest thing that
produces a real answer:

> Write `src/systems/full-thrust/system.json` declaring `vehicles` only —
> Mass, Thrust, Hull, Screens, FTL, weapons as specs — with empty attributes,
> resources and skill categories. Register it. Create a campaign on it and build
> two ships on the existing Ships screen.

That costs an hour and answers the questions that matter: how close the generic
vehicle sheet gets to a usable FT ship, whether a character-less campaign
navigates acceptably, and exactly which of items 1–5 above hurt first. Every one
of those is currently a guess, including the ones in this document.

If the spike shows the vehicle sheet is close, the order is: fleet grouping →
weapon fields → damage boxes → participant widening. If it shows the sheet is
badly wrong for FT, that is a much stronger argument for a separate app than
anything available today — and it will have cost an hour to learn.
