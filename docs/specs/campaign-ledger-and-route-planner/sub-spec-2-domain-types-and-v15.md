---
type: phase-spec
sub_spec_id: SS-02
sub_spec: 2
phase: run
depends_on: []
wave: 1
master_spec: "docs/specs/2026-08-08-campaign-ledger-and-route-planner.md"
---

# Sub-Spec 2 — Domain types and Dexie version 15

## Codebase analysis

- `src/types/ship.ts` is the closest template: a campaign-scoped Zod entity with
  the standard audit block (`schemaVersion`, `createdAt`, `updatedAt`,
  `deletedAt?`, `softDeletedBy?`) and a `CURRENT_*_SCHEMA_VERSION` constant kept
  in the repository, not the type file.
- `src/storage/db/client.ts` — the ladder ends at `this.version(14)` (line 558),
  which has an `.upgrade(upgradeReferenceGroupsToV14)`. Table declarations sit on
  the class around lines 150–151 (`inventoryContainers`, `ships`).
- Index style from v13: `ships: 'id, campaignId, ownerCharacterId, deletedAt'`.

## Interface Contracts

**Provides:** `LedgerEntry`, `LedgerLeg`, `PayoutSplit`, `PayoutSplitRow`,
`RouteStop` types and their Zod schemas; three Dexie tables.
**Requires:** nothing.
**Shared state:** the Dexie schema — SS-04 and SS-06 write through it.

### LedgerEntry
- Direction: Sub-spec 2 → Sub-specs 3, 4, 7, 9
- Owner: Sub-spec 2
- Shape: `{ id, campaignId, date, description, amount: number (signed int), gross?: number, kind: 'manual'|'distribution', legs: LedgerLeg[], splitSnapshot?: PayoutSplit, …audit }`

### LedgerLeg
- Direction: Sub-spec 2 → Sub-specs 3, 7, 9
- Owner: Sub-spec 2
- Shape: `{ id, label, amount: non-negative int, payeeMemberId?, payeeName?, percent?, kind: 'shipFund'|'payee'|'unallocated' }`

### RouteStop
- Direction: Sub-spec 2 → Sub-specs 6, 8, 9
- Owner: Sub-spec 2
- Shape: `{ id, campaignId, order: number, name: string, values: Record<string,string>, …audit }`

## Decisions (committed — do not escalate)

- **Sign lives on the entry, not the leg.** `LedgerEntry.amount` is signed;
  `LedgerLeg.amount` is a non-negative magnitude whose direction is implied by
  `kind` (`shipFund` = retained, `payee`/`unallocated` = paid out). This is what
  makes the balance fold a plain sum.
- **`gross` is optional.** Absent on a manual entry, where `amount` is the whole
  story. Present on every distribution.
- **Route values are always strings**, regardless of a declared field's `type`.
  `name` is a real column because the list and the export filename need a title
  without consulting the system definition.
- **No `.upgrade()` callback.** All three tables are new; there is no existing
  data to migrate. If an upgrade callback starts to look necessary, escalate —
  it means something has been misunderstood.
- **Never edit `version(14)`.** It must be byte-identical afterwards.

## Implementation steps

### Step 1. Write the type files

`src/types/ledger.ts`, `src/types/payoutSplit.ts`, `src/types/routeStop.ts`.
Zod schema first, `z.infer` type second, matching `ship.ts`'s TSDoc density.
`payoutSplit.ts` must not import from `ledger.ts` — `ledger.ts` imports the split
schema for `splitSnapshot`, so the dependency runs one way only.

### Step 2. Declare the tables on the class

Add three `Table<T, string>` declarations beside `ships!` in
`src/storage/db/client.ts`.

### Step 3. Add version 15

Below the `version(14)` block, with a comment in the house style explaining what
the tables are for:

```ts
    this.version(15).stores({
      ledgerEntries: 'id, campaignId, date, kind, deletedAt',
      ledgerSplits:  'id, campaignId, deletedAt',
      routeStops:    'id, campaignId, order, deletedAt',
    });
```

No `.upgrade()`.

### Step 4. Verify

```bash
npm run build
git diff src/storage/db/client.ts   # confirm version(14) is untouched
```

### Step 5. Commit

```bash
git add src/types src/storage/db/client.ts
git commit -m "feat(ledger): campaign ledger and route stop schemas"
```

## Verification Commands

```bash
npm run build
npm test
```

## Checks

| Criterion | Type | Command |
|---|---|---|
| version(15) declares all three tables | [STRUCTURAL] | `grep -q "version(15)" src/storage/db/client.ts && grep -q "ledgerEntries" src/storage/db/client.ts && grep -q "routeStops" src/storage/db/client.ts \|\| (echo "FAIL: version(15) block incomplete" && exit 1)` |
| version(14) untouched | [MECHANICAL] | `git diff HEAD -- src/storage/db/client.ts \| grep -q "^-.*version(14)" && (echo "FAIL: version(14) was modified" && exit 1) \|\| true` |
| Entry carries gross and signed amount | [STRUCTURAL] | `grep -q "gross" src/types/ledger.ts \|\| (echo "FAIL: ledger.ts missing gross" && exit 1)` |
| Leg kind enum present | [STRUCTURAL] | `grep -q "shipFund" src/types/ledger.ts && grep -q "unallocated" src/types/ledger.ts \|\| (echo "FAIL: leg kind enum incomplete" && exit 1)` |
| All three types carry audit fields | [STRUCTURAL] | `for f in ledger payoutSplit routeStop; do grep -q "deletedAt" src/types/$f.ts \|\| (echo "FAIL: $f.ts missing deletedAt" && exit 1); done` |
| Split row keeps a name snapshot | [STRUCTURAL] | `grep -q "payeeName" src/types/payoutSplit.ts \|\| (echo "FAIL: payoutSplit.ts missing payeeName snapshot field" && exit 1)` |
| Build clean | [MECHANICAL] | `npm run build \|\| (echo "FAIL: build" && exit 1)` |

**Note:** `payoutSplit.ts` legitimately has no `deletedAt` of its own if the
split is stored as a nested object on a `ledgerSplits` row that carries the audit
block. If you take that shape, adjust the third check to target the row type and
record the choice here.
