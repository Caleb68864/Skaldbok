---
date: 2026-08-08
evaluated_date: 2026-08-08
topic: "Campaign ledger (cashbook) and jump-route planner"
author: Caleb Bennett
status: evaluated
tags:
  - design
  - campaign-ledger-and-route-planner
  - traveller
---

# Campaign Ledger and Route Planner — Design (Evaluated)

## Summary

Two campaign-scoped features driven by live Traveller play. The **ledger** is a
shared cashbook for the crew's money, with a payout model that snapshots the
agreed split onto every distribution so the books stay auditable after the crew
renegotiates. The **route planner** is an ordered, reorderable list of worlds on
the campaign's jump route. Both export the way the notes log exports.

Neither feature belongs to a character or to the ship. Both hang off the
campaign, following the `Ship` precedent already in the repo.

## Approach Selected

**Declarative gating on `SystemDefinition`** for the route planner: a system
declares a `routePlanner` block naming its own world fields, and the screen and
its nav entry exist only for systems that declare one. The ledger is ungated —
every system has `engine.currency` and a shared purse is universal.

Chosen over an engine panel key because the same declaration that hides the
screen from Dragonbane is what supplies "UWP" and "parsecs" as *Traveller's*
words. Gating alone solves half the problem; the vocabulary half is the one that
bites when system #4 arrives.

## Architecture

```
                        ┌──────────────────────────┐
                        │      Campaign (row)      │
                        └────┬────────────────┬────┘
                             │                │
              ┌──────────────┘                └──────────────┐
              │                                              │
   ┌──────────▼───────────┐                       ┌──────────▼──────────┐
   │  LEDGER              │                       │  ROUTE              │
   │                      │                       │                     │
   │  ledgerEntries       │                       │  routeStops         │
   │   ├ gross            │                       │   ├ order (dense)   │
   │   ├ amount (signed,  │                       │   ├ name            │
   │   │   net cash move) │                       │   └ values{} ◄──────┼── field ids
   │   ├ legs[]           │◄── snapshot           │                     │   declared by
   │   └ splitSnapshot    │    written here       │                     │   the system
   │                      │    at distribute time └──────────┬──────────┘
   │  ledgerSplits        │                                  │
   │   ├ shipFundPct      │                                  │
   │   └ rows[]  (current agreement, mutable)                │
   └──────────┬───────────┘                                  │
              │                                              │
   ┌──────────▼───────────┐                       ┌──────────▼──────────┐
   │ ledgerRepository     │                       │ routeRepository     │
   │ ledgerSplitRepository│                       │                     │
   └──────────┬───────────┘                       └──────────┬──────────┘
              │                                              │
   ┌──────────▼───────────┐                       ┌──────────▼──────────┐
   │ utils/ledgerMath.ts  │  ← pure, tested       │ utils/routeMath.ts  │
   │  computeBalance      │                       │  reorder            │
   │  computeDistribution │                       │  totalDistance      │
   │  validateSplit       │                       │  readNumericField   │
   │  evenSplit           │                       └─────────────────────┘
   └──────────────────────┘

   engine.currency.formatAmount(baseUnits)  ← NEW: character-free money rendering
   SystemDefinition.routePlanner ──gates──► nav entry + /route screen
   (schemas/system.schema.ts must know it, or imported systems lose it)
```

Three new Dexie tables in **`version(15)`** (current ladder ends at 14):

```ts
this.version(15).stores({
  ledgerEntries: 'id, campaignId, date, kind, deletedAt',
  ledgerSplits:  'id, campaignId, deletedAt',
  routeStops:    'id, campaignId, order, deletedAt',
});
```

No `.upgrade()` callback — all three tables are new and every read path is
written against their presence from the start.

## Components

### `types/ledger.ts`

> **Evaluation fix (Critical 1).** The original schema wrote a distribution's
> `amount` as the full distributed total. Half that money never leaves the book:
> the ship fund is *retained*. The balance would have drifted upward-wrong by the
> ship-fund share of every payout, silently, compounding, for weeks. `gross` and
> `amount` are now separate numbers with separate invariants.

```ts
/** One line of a multi-part entry. The seam double-entry will grow into. */
export const ledgerLegSchema = z.object({
  id: z.string(),
  label: z.string(),                       // "Ship fund", "Unallocated", or a payee
  /** Positive magnitude in base units. Direction is implied by `kind`. */
  amount: z.number().int().nonnegative(),
  /** Party seat this leg paid, when it paid a person. */
  payeeMemberId: z.string().optional(),
  /** Display name AT THE TIME. Survives rename, unlink, soft-delete. */
  payeeName: z.string().optional(),
  /** The percentage this leg was computed from, for audit. */
  percent: z.number().optional(),
  /**
   * `shipFund` is RETAINED — it stays in the book and does not move cash.
   * `payee` and `unallocated` are PAID OUT.
   */
  kind: z.enum(['shipFund', 'payee', 'unallocated']),
  // accountId?: string  <- double-entry lands here; see the caveat below
});

export const ledgerEntrySchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  /** ISO date (day precision) — the in-world/table date of the movement. */
  date: z.string(),
  description: z.string().default(''),
  /**
   * NET cash movement, signed, in the system's base currency unit.
   * + is in, − is out. This and only this is what the running balance folds.
   */
  amount: z.number().int(),
  /**
   * On a distribution, the total sum being divided. Legs sum to this.
   * Absent on plain cashbook lines, where `amount` is the whole story.
   */
  gross: z.number().int().optional(),
  kind: z.enum(['manual', 'distribution']).default('manual'),
  legs: z.array(ledgerLegSchema).default([]),
  /** The agreement AS IT STOOD when this distribution was made. */
  splitSnapshot: payoutSplitSchema.optional(),
  schemaVersion, createdAt, updatedAt, deletedAt, softDeletedBy
});
```

**Owns:** one movement of money. **Does not own:** the running balance (derived,
never stored) or the current agreement (that is `ledgerSplits`).

> **Double-entry caveat (evaluation fix, Important 5).** `legs[]` means a later
> accounts feature needs no new *table* and no restructuring of existing rows —
> which is what "without a migration" was asking for. It does not mean zero work:
> adding `accountId` will require backfilling it onto legs already written.
> Stated plainly here so nobody is surprised by it later.

### `types/payoutSplit.ts`

```ts
export const payoutSplitRowSchema = z.object({
  id: z.string(),
  payeeMemberId: z.string().optional(),   // undefined = ad-hoc payee
  payeeName: z.string(),                  // always present, always the truth shown
  percent: z.number(),                    // of the remainder, hand-entered
});

export const payoutSplitSchema = z.object({
  shipFundPct: z.number(),                // off the top, retained
  rows: z.array(payoutSplitRowSchema),
});
```

`ledgerSplits` is one row per campaign wrapping a `payoutSplit` plus the audit
fields. It is *mutable* and represents only the current agreement. History lives
in the snapshots, never here.

**Why a table and not a field on `Campaign`:** it keeps the campaign row small
and leaves room to keep superseded agreements as rows later without touching the
campaign schema.

### `utils/ledgerMath.ts` — pure, the tested core

| Function | Contract |
|---|---|
| `computeRunningBalance(entries)` | Ordered fold over `amount`. Returns each entry with its balance-after. Order: `date`, then `createdAt`, then `id` as final tiebreak so the fold is deterministic when two rows share a millisecond. |
| `validateSplit(split)` | `{ total, status: 'ok' \| 'under' \| 'over' }`. `ok` is exactly 100. |
| `evenSplit(n)` | `n` percentages summing to **exactly** 100, **remainder on the leading rows**: `evenSplit(3) === [34, 33, 33]`. Pinned by test, not left to `floor` incidentally. |
| `computeDistribution(gross, split)` | Returns `{ legs, net }`. |

Two invariants, both asserted before the entry is written:

> **I1. `sum(legs.map(l => l.amount)) === gross`**
> **I2. `net === −(gross − shipFundLegAmount)`**

I1 is the prime mutation target. I2 is the one that keeps the balance honest.

Algorithm, in integer base units throughout — no floats reach storage:

1. `shipFund = floor(gross × shipFundPct / 100)` → a `shipFund` leg (**retained**)
2. `pool = gross − shipFund`
3. each payee `= floor(pool × row.percent / 100)` → `payee` legs (**paid out**)
4. if `validateSplit` is `under`, the shortfall becomes an explicit
   **`Unallocated`** leg (**paid out**) — visible in the books rather than
   silently inflating somebody's cut
5. any rounding residual folds into the **ship fund** leg, the residual pot by
   nature
6. `net = −(sum of payee legs + unallocated leg)`
7. assert I1 and I2; throw rather than write a silently wrong entry

`status === 'over'` never reaches step 1. Distribute is disabled with the reason
shown — you cannot pay out more than the pot.

Worked example, Cr 100,000 with a 50% fund and a 30/30 split (rows total 60):

```
Cr 100,000 salvage        in   +100,000   bal 100,000
Payout — Tarkine          out    −50,000   bal  50,000
  ⤷ Ship fund (50%)     retained  50,000
  ⤷ Milo Aer (30%)          paid  15,000
  ⤷ Sgt. Vance (30%)        paid  15,000
  ⤷ Unallocated (40%)       paid  20,000
```

`gross = 100,000`; legs sum to 100,000 (I1); `net = −(100,000 − 50,000) = −50,000` (I2).

### `engine.currency` — new capability (evaluation fix, Critical 2)

`CurrencyModel` today is `{ mode, label, denominations, read, write }`, and both
`read` and `write` take a `CharacterRecord`. **The ledger has no character**, and
because the ledger is ungated, Dragonbane's three-denomination `coins` mode has
to render too — so "print the integer" is not a fallback.

Two additive fields, implemented in all three adapters:

```ts
interface CurrencyModel {
  // …existing…
  /** Id of the smallest denomination — the unit ledger amounts are stored in. */
  baseDenominationId: string;
  /** Renders a bare base-unit integer. Cr 15,000 / 1g 4s 2c. Sign-aware. */
  formatAmount: (baseUnits: number) => string;
}
```

Implemented by decomposing across `denominations[].value`, descending. **Additive
only** — no existing signature changes, so Dragonbane's wealth panels are
provably untouched, per the CLAUDE.md rule that the classic-fantasy adapter
delegates rather than restates. The ledger screen is the reader that satisfies
`declaredCapabilities.test.ts`.

### `utils/routeMath.ts` — pure

`reorder(stops, fromIndex, toIndex)` returns a fully renumbered dense list.
`totalDistance(stops, distanceFieldId)` sums the declared distance field.

> **Evaluation fix (Important 4).** `values` is `Record<string, string>` while a
> declared field may say `type: 'number'`. `readNumericField(values, id)` is the
> single parse boundary: it returns `0` for missing, blank or unparseable input,
> so a half-filled route renders a total instead of `NaN`. Storage stays strings;
> nothing else in the feature calls `parseFloat`.

Dense renumber rather than sparse fractional ordering: these lists are ~20 rows,
and dense is the version that cannot drift into float-collision territory.

### `SystemDefinition.routePlanner` — the declared capability

```ts
routePlanner?: {
  /** Screen and nav label, e.g. "Jump Route". */
  label: string;
  /** Field shown as the row's distance, by id, e.g. "jump". */
  distanceFieldId?: string;
  fields: Array<{
    id: string;                              // key into RouteStop.values
    label: string;                           // "UWP", "Hex", "Jump (pc)"
    type?: 'text' | 'textarea' | 'number';
  }>;
};
```

Traveller declares five: `name`, `uwp`, `hex`, `jump`, `notes`. `name` is a real
column on `RouteStop` (every stop needs a title for the list and the export
filename); the rest live in `RouteStop.values: Record<string, string>`, exactly
as `identityFields` values live in `CharacterRecord.metadata`.

**Two obligations discharged in the same change, or this ships broken:**

1. **`schemas/system.schema.ts`** (repo root, not under `src/`) must gain the
   matching Zod entry. Zod strips unknown keys, so forgetting this means bundled
   Traveller works and every *imported* system silently loses its route planner.
   `systemDefinitionSchema.test.ts` is where it gets pinned.
2. **`declaredCapabilities.test.ts`** fails unless something in `src` reads
   `routePlanner`. The reader is the route screen plus the nav gate — both land
   in this change, so the test passes honestly rather than via the allowlist.

### Screens, repositories, export

- `screens/LedgerScreen.tsx` at `/ledger`, `screens/RouteScreen.tsx` at `/route`.
- `features/ledger/` — `useLedger`, `useLedgerSplit`, the Distribute modal.
  `features/route/` — `useRoute`.
- `storage/repositories/ledgerRepository.ts`, `ledgerSplitRepository.ts`,
  `routeRepository.ts` — modelled directly on `shipRepository.ts`, which is the
  closest existing campaign-scoped repo. Every read filters through
  `excludeDeleted`; deletes are `softDelete(id, txId?)`; `hardDelete` exists but
  is never called from UI.
- `utils/export/renderLedger.ts` and `renderRoute.ts` produce Markdown with YAML
  frontmatter matching `renderSession.ts`'s house style, delivered through the
  existing `shareFile` path.

> **Evaluation fix (Important 3).** `generateFilename(note)` is `Note`-typed and
> cannot name a ledger export. Add a sibling `generateEntityFilename({ title,
> date })` and have the existing note helper delegate to it, rather than widening
> the note signature and touching every current caller.

Nav: both links go in `CampaignHeader.tsx` beside Ships. The Route link is gated
on `system.routePlanner` being declared.

## Data Flow

**Recording money.** User types a date, description and an amount into either the
In or the Out column. The form negates on write for the Out column — the user
never types a sign. `ledgerRepository.create` stores a signed integer. The screen
reads entries ordered by `date`, `createdAt`, `id` and folds
`computeRunningBalance` over them. **The balance is never persisted**, so it
cannot go stale against an edited or restored row.

**Distributing.** User opens Distribute and enters a gross amount. The modal reads
the *current* `ledgerSplits` row and runs `computeDistribution`, showing the legs
and the resulting net before committing. On confirm, one `ledgerEntry` is written
with `kind: 'distribution'`, the gross, the net, the legs, **and a deep copy of
the split as `splitSnapshot`**. From that moment the entry is independent of the
agreement: editing `ledgerSplits` afterwards changes nothing that already
happened. Re-reading session 3 renders session 3's percentages.

**Currency.** Amounts are integer counts of `currency.baseDenominationId`,
rendered through `currency.formatAmount`, with the engine resolved from the
campaign's system via `useSystemDefinition(activeCampaign.system)` — the pattern
already used by `ParticipantDrawer.tsx:31`. No screen formats money itself.

**Route.** Stops are read by `campaignId` ordered by `order`. Adding appends at
`order = length`. Reordering calls `routeMath.reorder` and writes the whole
renumbered list in one Dexie transaction, so an interrupted drag cannot leave two
stops sharing an index. Field values round-trip through `values` keyed by the
system's declared field ids, read numerically only via `readNumericField`.

## Error Handling

| Failure | Behaviour |
|---|---|
| **Split rows ≠ 100** | Running total shown live with a warning. Under 100 still distributes, producing a visible `Unallocated` leg. Over 100 disables Distribute with the reason stated. This is the failure they will actually hit. |
| **Rounding** | Residual folds into the ship fund. I1 and I2 are asserted on every distribution; a violation throws rather than writing a silently wrong entry. |
| **Balance drift** | Structurally prevented: the fold reads `amount` only, and `amount` excludes retained money by construction (I2). |
| **Payee renamed / removed after a payout** | Nothing changes. The leg carries `payeeName` as a snapshot; `payeeMemberId` is a soft reference used only to re-link a picker. |
| **No party configured** | Split rows accept ad-hoc names with no `payeeMemberId`. The ledger works with zero party setup. |
| **No active campaign** | Both screens render an empty state, matching `useExportActions`' null-safe pattern. Never a blank screen. |
| **Distribution exceeds balance** | Allowed, with a warning. Crews go into the red and the book should say so rather than refuse the entry. |
| **Blank / non-numeric route distance** | `readNumericField` returns 0. The total renders; it never shows `NaN`. |
| **System declares no `routePlanner`** | Route screen and nav entry do not exist. Direct navigation to `/route` redirects, per the existing catch-all convention. |
| **Imported system's `routePlanner` stripped by Zod** | Prevented, not handled — the schema entry ships in the same change and is pinned by test. |

## Success Criteria

- A crew can record cash in and out across a session and read a correct running
  balance.
- A distribution writes one ledger entry satisfying I1 and I2 for **every**
  combination of ship-fund percentage, crew count, split total and rounding.
- **The balance after a distribution equals the balance before, minus only the
  money that actually left.** Retained ship-fund money stays counted.
- Changing the split after a distribution leaves every prior distribution's
  displayed percentages and amounts **byte-identical**.
- Money renders correctly in a Traveller campaign (`Cr 15,000`) and a Dragonbane
  one (multi-denomination coins), from the same stored integer.
- A route of worlds can be added, edited, reordered and deleted, with Traveller's
  five fields under Traveller's own labels.
- Dragonbane and Savage Worlds campaigns show no route planner anywhere.
- Both features export as Markdown through the notes-log path.
- `npm test` and `npm run build` clean. Pure logic is extracted and
  mutation-checked: break `computeDistribution`'s residual handling, break I2's
  ship-fund exclusion, and break `evenSplit`'s remainder — confirm a test fails
  for each, restore.
- `docs/decisions.md` entries written, including Watch lines on the signed-amount
  convention diverging from the debts feature's `direction` field, and on the
  gross/net distinction.

## Exclusions

- **No double-entry.** `legs[]` is the seam; `accountId` is not added.
- **No separate ship-fund balance.** One book; the fund is retained money inside
  it. A second tracked balance is the first half of double-entry.
- **No "fill from ship shares" calculator.** Ship shares are a fixed
  character-creation artifact, the group intends to renegotiate, and the 4/4/4
  weights were a throwaway hand-derivation. Scaffolding for a rule they are about
  to discard.
- **No jump-map, no world generation, no distance validation.** UWP and parsecs
  are typed, not computed or verified against any table.
- **No Trash-screen registration.** `TrashScreen` is a 104-line creatures-only
  MVP and Ships is not in it either. Matching the precedent, not extending it.
- **No campaign-delete cascade.** `campaignRepository.softDelete(id, txId?)` does
  not cascade to ships or inventory containers today; these three tables match
  that behaviour rather than inventing a new one.
- **No refactor of `CampaignHeader` nav into config.** Noted as a wart; out of
  scope.
- **No per-character wealth integration.** The ledger is the crew's book; it does
  not move money into or out of `character.wealth`.

## Open Questions

*Both original open questions were resolved by reading the repo during
evaluation; they are now recorded as Exclusions above.*

1. **Route stop → note links.** "This is where the Tarkine job happened" is an
   obvious future `entityLink`. Deliberately not built; the table has no FK that
   would block it.
2. **Ledger entry → session link.** Same shape: attributing income to the session
   it was earned in is natural and unrequested. Not built.

## Approaches Considered

**Route gating — A: declarative on `SystemDefinition`** *(selected)*. Data-driven
fields and labels; a community JSON system gets a hex-crawl planner with no code.
Costs a Zod schema entry and a reader, both in-change.

**B: engine panel key.** `route` in `engine.panels`, fields hardcoded in the
Traveller adapter. Gates correctly but leaves vocabulary in code — data pretending
to be behaviour, and blocks system #4.

**C: always on, generic labels.** Cheapest. Repeats the existing ungated-Ships
wart and shows Dragonbane a UWP field.

**Distribution shape — one entry with legs** *(selected)* over N flat entries per
payee (floods the cashbook, duplicates the snapshot) and parent-plus-children
(running balance must skip a level or double-count).

**Payee identity — member ref plus name snapshot** *(selected)* over free text (no
picker, typo drift) and hard link (a renamed member rewrites history, the exact
failure the snapshot rule exists to prevent).

---

## Commander's Intent

**Desired End State.** A GM opens a Traveller campaign at the table, records the
Cr 100,000 the crew was paid, hits Distribute, and sees the ship fund retained and
each crewmate's cut written into one auditable entry. Three sessions later the
crew renegotiates the split; every earlier payout still shows the percentages that
were actually agreed at the time. In the same campaign a jump route of worlds can
be entered, reordered and exported. In a Dragonbane campaign, none of the route
UI exists and the ledger renders coins correctly.

**Purpose.** Both features come from a live session where the table had no shared
record. The ledger's real job is settling arguments about money weeks after the
fact — which is why the snapshot requirement, not the arithmetic, is the point.
The route planner's real job is remembering where the ship has been and what it
costs to get to the next place.

**Constraints:**
- **MUST** snapshot the split onto every distribution. Nothing may retroactively
  change a past payout.
- **MUST** derive the running balance; never persist it.
- **MUST** satisfy I1 and I2 by assertion, not by inspection.
- **MUST** add the `routePlanner` entry to `schemas/system.schema.ts` in the same
  change as the type.
- **MUST** route every read through `excludeDeleted` and every UI delete through
  `softDelete`.
- **MUST NOT** introduce a `systemId ===` branch anywhere outside `baseEngineFor`.
- **MUST NOT** edit an existing Dexie `version()` block.
- **MUST NOT** change any existing `CurrencyModel` signature — additive only.
- **MUST NOT** push to a remote.

**Freedoms.** The agent MAY choose component decomposition, hook boundaries, test
file organisation, Markdown export layout, and all internal naming.

**Committed interface/contract defaults:**

- **Distribution return shape** → **Default:**
  `computeDistribution(gross: number, split: PayoutSplit): { legs: LedgerLeg[]; net: number }`
  — legs in order shipFund, payees (split-row order), unallocated.
  *(override only if the modal needs the pool exposed separately)*
- **Currency extension** → **Default:**
  `baseDenominationId: string` and `formatAmount(baseUnits: number): string` added
  to `CurrencyModel`; e.g. `formatAmount(15000) === 'Cr 15,000'` for Traveller.
  *(override if an existing helper in `utils/` already decomposes denominations —
  check before writing a new one)*
- **Route numeric read** → **Default:**
  `readNumericField(values: Record<string,string>, id: string): number`, returning
  0 for missing/blank/unparseable.
- **Export filename** → **Default:**
  `generateEntityFilename({ title: string; date: string }): string`, with the
  existing `generateFilename(note)` delegating to it.
- **Repository surface** → **Agent-free:** mirror `shipRepository.ts` method names
  and shapes (`listByCampaign`, `getById`, `create`, `update`, `softDelete`,
  `restore`, `hardDelete`). Any consistent naming that matches that file is fine.
- **Nav placement** → **Agent-free:** anywhere adjacent to the existing Ships link
  in `CampaignHeader.tsx`.

## Execution Guidance

**Observe:**
- `npm run build` after each schema or engine change — it is the only type-check.
- `npm test` after each `ledgerMath` / `routeMath` edit.
- `declaredCapabilities.test.ts` specifically, after adding `routePlanner` or the
  currency fields — it fails on a declared-but-unread property.
- `systemDefinitionSchema.test.ts` after touching `schemas/system.schema.ts`.
- `engineContract.test.ts` after touching any engine adapter.

**Orient:**
- `src/storage/repositories/shipRepository.ts` is the template for all three new
  repositories — campaign-scoped, soft-deleting, `excludeDeleted` on every read.
- `src/utils/export/renderSession.ts` is the template for both renderers,
  including its `yamlValue` frontmatter helper and filename dedup.
- `src/features/encounters/ParticipantDrawer.tsx:31` is the template for resolving
  a system from a campaign rather than a character.
- `src/types/ship.ts` is the template for a campaign-scoped Zod entity.
- Version 14 in `src/storage/db/client.ts` is the last block; add 15 below it.
- `schemas/system.schema.ts` lives at the **repo root**, not under `src/`.

**Escalate when:**
- Any existing `CurrencyModel` signature would need to change (only additive
  changes are sanctioned).
- The `sum(legs) === gross` invariant cannot be met for some input — that is a
  design problem, not an implementation one.
- A `systemId ===` branch starts to look necessary outside `baseEngineFor`.
- A Dexie upgrade callback appears to be needed (all three tables are new; it
  should not be).
- Anything suggests pushing to a remote.

**Shortcuts (apply without deliberation):**
- `generateId()` from `utils/ids` for every id, including soft-delete tx ids.
- `nowISO()` from `utils/dates` for every timestamp.
- `excludeDeleted()` from `utils/softDelete` on every repository read.
- Zod schema + `z.infer` type in `src/types/<entity>.ts`, one file per entity.
- Tests as `<module>.test.ts` beside the module, Vitest, pure logic only.
- Bump `system.json`'s `version` when editing it. The Traveller sheet layout is
  untouched here, so `sheet.json` does **not** need a bump.

## Decision Authority

**Agent decides autonomously:** file and folder layout; component decomposition;
hook boundaries; test organisation and case design; Markdown export layout;
internal naming; empty-state and warning copy.

**Agent recommends, human approves:** the `version(15)` store strings and index
choices; the `routePlanner` JSON shape (a public contract community templates will
depend on); the `formatAmount` signature and its Dragonbane decomposition format;
any deviation from the committed defaults above.

**Human decides:** scope changes; whether the ship fund ever becomes a second
tracked balance; Trash-screen and cascade scope; anything pushed to a remote.

## War-Game Results

**Most likely failure.** *(Found and fixed during evaluation.)* The ship-fund leg
double-counting, making the balance drift upward-wrong by half of every payout —
silent, compounding, and invisible until the book disagreed with the table by a
large margin. Mitigated by the gross/net split and invariant I2, and named as an
explicit success criterion so a test covers it.

**Second most likely.** Forgetting the `schemas/system.schema.ts` entry, so
bundled Traveller works and imported systems silently lose their route planner.
Mitigated by making it a MUST constraint and by `systemDefinitionSchema.test.ts`.

**Scale stress.** ~50 entries × 6 legs, ~20 route stops. Dense reorder rewrites
the whole list per drag — trivially cheap at this size. N/A.

**Dependency risk.** Extending `CurrencyModel` touches all three engine adapters
and sits under the existing wealth panels. Additive-only new optional members keep
Dragonbane provably unchanged; `engineContract.test.ts` fingerprints the change.

**Maintenance assessment.** Strong. The design records *why* for every non-obvious
choice, and the two invariants are stated as prose the next reader can check code
against. The one thing a newcomer would not guess is why `amount` and `gross`
differ — hence the Watch line required in `docs/decisions.md`.

## Evaluation Metadata

- Evaluated: 2026-08-08
- Cynefin Domain: Complicated
- Critical Gaps Found: 2 (2 resolved)
- Important Gaps Found: 3 (3 resolved)
- Suggestions: 2 (2 resolved)
- Original open questions closed by repo evidence: 2

## Next Steps

- [ ] Turn this into a Forge spec (`/forge docs/plans/2026-08-08-campaign-ledger-and-route-planner-design-evaluated.md`)
- [ ] Check for an existing denomination-decomposition helper in `utils/` before writing `formatAmount`
