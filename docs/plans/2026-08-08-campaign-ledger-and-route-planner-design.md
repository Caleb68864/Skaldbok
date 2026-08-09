---
date: 2026-08-08
topic: "Campaign ledger (cashbook) and jump-route planner"
author: Caleb Bennett
status: draft
tags:
  - design
  - campaign-ledger-and-route-planner
  - traveller
---

# Campaign Ledger and Route Planner — Design

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
   │   ├ signed amount    │                       │   ├ order (dense)   │
   │   ├ legs[]           │◄── snapshot           │   ├ name            │
   │   └ splitSnapshot    │    written here       │   └ values{} ◄──────┼── field ids
   │                      │    at distribute time │                     │   declared by
   │  ledgerSplits        │                       │                     │   the system
   │   ├ shipFundPct      │                       └──────────┬──────────┘
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
   │  validateSplit       │                       └─────────────────────┘
   │  evenSplit           │
   └──────────────────────┘

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

```ts
/** One line of a multi-part entry. The seam double-entry will grow into. */
export const ledgerLegSchema = z.object({
  id: z.string(),
  label: z.string(),                       // "Ship fund", "Unallocated", or a payee
  /** Signed, same convention as the parent entry. */
  amount: z.number().int(),
  /** Party seat this leg paid, when it paid a person. */
  payeeMemberId: z.string().optional(),
  /** Display name AT THE TIME. Survives rename, unlink, soft-delete. */
  payeeName: z.string().optional(),
  /** The percentage this leg was computed from, for audit. */
  percent: z.number().optional(),
  kind: z.enum(['shipFund', 'payee', 'unallocated']),
  // accountId?: string  <- double-entry lands here, additively, no migration
});

export const ledgerEntrySchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  /** ISO date (day precision) — the in-world/table date of the movement. */
  date: z.string(),
  description: z.string().default(''),
  /** Signed integer in the system's base currency unit. + is in, - is out. */
  amount: z.number().int(),
  kind: z.enum(['manual', 'distribution']).default('manual'),
  /** Present on distributions; empty on plain cashbook lines. */
  legs: z.array(ledgerLegSchema).default([]),
  /** The agreement AS IT STOOD when this distribution was made. */
  splitSnapshot: payoutSplitSchema.optional(),
  schemaVersion, createdAt, updatedAt, deletedAt, softDeletedBy
});
```

**Owns:** one movement of money. **Does not own:** the running balance (derived,
never stored) or the current agreement (that is `ledgerSplits`).

### `types/payoutSplit.ts`

```ts
export const payoutSplitRowSchema = z.object({
  id: z.string(),
  payeeMemberId: z.string().optional(),   // undefined = ad-hoc payee
  payeeName: z.string(),                  // always present, always the truth shown
  percent: z.number(),                    // of the remainder, hand-entered
});

export const payoutSplitSchema = z.object({
  shipFundPct: z.number(),                // off the top
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
| `computeRunningBalance(entries)` | Ordered fold. Returns each entry with its balance-after. A plain sum of signed ints — cannot double-count. |
| `validateSplit(split)` | `{ total, status: 'ok' \| 'under' \| 'over' }`. `ok` is exactly 100. |
| `evenSplit(n)` | `n` percentages summing to **exactly** 100. 3 → `[34, 33, 33]`. |
| `computeDistribution(amount, split)` | The whole thing. Returns `legs[]`. |

`computeDistribution` invariant, non-negotiable and the prime mutation target:

> **`sum(legs.map(l => l.amount)) === entry.amount`, always, for every input.**

Algorithm, in integer base units throughout — no floats reach storage:

1. `shipFund = floor(amount × shipFundPct / 100)`
2. `pool = amount − shipFund`
3. each payee `= floor(pool × row.percent / 100)`
4. `allocated = sum(payees)`; if `validateSplit` is `under`, the shortfall
   becomes an explicit **`Unallocated`** leg — visible in the books rather than
   silently inflating somebody's cut
5. any rounding residual is folded into the **ship fund** leg, which is the
   residual pot by nature
6. assert the invariant before returning

`status === 'over'` never reaches step 1. The Distribute action is disabled and
the reason is shown — you cannot pay out more than the pot.

### `utils/routeMath.ts` — pure

`reorder(stops, fromIndex, toIndex)` returns a fully renumbered dense list;
`totalDistance(stops)` sums the declared distance field. Dense renumber rather
than sparse fractional ordering: these lists are ~20 rows, and dense is the
version that cannot drift into float-collision territory over a campaign.

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

1. **`schemas/system.schema.ts`** must gain the matching Zod entry. Zod strips
   unknown keys, so forgetting this means bundled Traveller works and every
   *imported* system silently loses its route planner. `CLAUDE.md` names this
   trap; `systemDefinitionSchema.test.ts` is where it gets pinned.
2. **`declaredCapabilities.test.ts`** fails unless something in `src` reads
   `routePlanner`. The reader is the route screen plus the nav gate — both land
   in this change, so the test passes honestly rather than via the allowlist.

### Screens, repositories, export

- `screens/LedgerScreen.tsx` at `/ledger`, `screens/RouteScreen.tsx` at `/route`.
- `features/ledger/` — `useLedger`, `useLedgerSplit`, the Distribute modal.
  `features/route/` — `useRoute`.
- `storage/repositories/ledgerRepository.ts`, `ledgerSplitRepository.ts`,
  `routeRepository.ts`. Every read filters through `excludeDeleted`; deletes are
  `softDelete`; `hardDelete` exists but is never called from UI.
- `utils/export/renderLedger.ts` and `renderRoute.ts` produce Markdown with YAML
  frontmatter matching `renderSession.ts`'s house style, delivered through the
  existing `shareFile` / `generateFilename` path. Two new actions on
  `useExportActions`.

Nav: both links go in `CampaignHeader.tsx` beside Ships. The Route link is
gated on `system.routePlanner` being declared.

## Data Flow

**Recording money.** User types a date, description and an amount into either
the In or the Out column. The form negates on write for the Out column — the
user never types a sign. `ledgerRepository.create` stores a signed integer. The
screen reads the campaign's entries ordered by `date`, then `createdAt` as the
tiebreak, and folds `computeRunningBalance` over them for display. **The balance
is never persisted**, so it cannot go stale against an edited or restored row.

**Distributing.** User opens Distribute, enters an amount. The modal reads the
*current* `ledgerSplits` row and runs `computeDistribution`. It shows the legs
before committing. On confirm, one `ledgerEntry` is written with
`kind: 'distribution'`, the signed total, the legs, **and a deep copy of the
split as `splitSnapshot`**. From that moment the entry is independent of the
agreement: editing `ledgerSplits` afterwards changes nothing that already
happened. Re-reading session 3 renders session 3's percentages.

**Currency.** Amounts are integer counts of the system's base unit, formatted on
read through `engine.currency` resolved from the campaign's system. No screen
formats credits itself.

**Route.** Stops are read by `campaignId` ordered by `order`. Adding appends at
`order = length`. Reordering calls `routeMath.reorder` and writes the whole
renumbered list in one Dexie transaction, so an interrupted drag cannot leave
two stops sharing an index. Field values round-trip through `values` keyed by
the system's declared field ids.

## Error Handling

| Failure | Behaviour |
|---|---|
| **Split rows ≠ 100** | Running total shown live with a warning. Under 100 still distributes, producing a visible `Unallocated` leg. Over 100 disables Distribute with the reason stated. This is the failure they will actually hit. |
| **Rounding** | Residual folded into the ship fund. The `sum(legs) === amount` assertion runs on every distribution; a violation throws rather than writing a silently wrong entry. |
| **Payee renamed / removed after a payout** | Nothing changes. The leg carries `payeeName` as a snapshot; `payeeMemberId` is a soft reference used only to re-link a picker. |
| **No party configured** | Split rows accept ad-hoc names with no `payeeMemberId`. The ledger works with zero party setup. |
| **No active campaign** | Both screens render an empty state, matching `useExportActions`' null-safe pattern. Never a blank screen. |
| **Distribution exceeds balance** | Allowed, with a warning. Crews go into the red and the book should say so rather than refuse the entry. |
| **System declares no `routePlanner`** | Route screen and nav entry do not exist. Direct navigation to `/route` redirects, per the existing catch-all convention. |
| **Imported system's `routePlanner` stripped by Zod** | Prevented, not handled — the schema entry ships in the same change and is pinned by test. |

## Success Criteria

- A crew can record cash in and out across a session and read a correct running
  balance.
- A distribution writes one ledger entry whose legs sum exactly to the amount,
  for every combination of ship-fund percentage, crew count and rounding.
- Changing the split after a distribution leaves every prior distribution's
  displayed percentages and amounts **byte-identical**.
- A route of worlds can be added, edited, reordered and deleted, with Traveller's
  five fields under Traveller's own labels.
- Dragonbane and Savage Worlds campaigns show no route planner anywhere.
- Both features export as Markdown through the notes-log path.
- `npm test` and `npm run build` clean. Pure logic is extracted and
  mutation-checked: break `computeDistribution`'s residual handling and
  `evenSplit`'s remainder, confirm a test fails, restore.
- `docs/decisions.md` entries written, including a Watch line on the signed-amount
  convention diverging from the debts feature's `direction` field.

## Exclusions

- **No double-entry.** The `legs[]` array is the seam; `accountId` is not added.
- **No "fill from ship shares" calculator.** Ship shares are a fixed
  character-creation artifact, the group intends to renegotiate, and the 4/4/4
  weights were a throwaway hand-derivation. Scaffolding for a rule they are
  about to discard.
- **No jump-map, no world generation, no distance validation.** UWP and parsecs
  are typed, not computed or verified against any table.
- **No character-creation wizard adjacency** — nothing here generates content.
- **No refactor of `CampaignHeader` nav into config.** Noted as a wart; out of
  scope.
- **No per-character wealth integration.** The ledger is the crew's book; it does
  not move money into or out of `character.wealth`.

## Open Questions

1. **Trash screen.** Should soft-deleted ledger entries and route stops surface
   in `TrashScreen`? Following the convention says yes; it is additive and can
   follow. *Changes:* one registration per entity if in scope now.
2. **Campaign delete cascade.** Whether deleting a campaign should cascade to
   these three tables under one `softDeletedBy` transaction id. Depends on what
   `campaignRepository.softDelete` cascades today — to be read during
   implementation and matched, not invented.
3. **Route stop → note links.** "This is where the Tarkine job happened" is an
   obvious future `entityLink`. Deliberately not built; the table has no FK that
   would block it.
4. **Ledger entry → session link.** Same shape: attributing income to the session
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
(running balance must skip a level or double-count — a live bug mid-session).

**Payee identity — member ref plus name snapshot** *(selected)* over free text (no
picker, typo drift) and hard link (a renamed member rewrites history, the exact
failure the snapshot rule exists to prevent).

## Next Steps

- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-08-08-campaign-ledger-and-route-planner-design.md`)
- [ ] Confirm `campaignRepository.softDelete`'s current cascade before writing the three repositories
- [ ] Decide Trash-screen registration in or out of this change
