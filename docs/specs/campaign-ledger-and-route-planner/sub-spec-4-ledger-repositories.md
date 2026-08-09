---
type: phase-spec
sub_spec_id: SS-04
sub_spec: 4
phase: run
depends_on: ['SS-02']
wave: 2
master_spec: "docs/specs/2026-08-08-campaign-ledger-and-route-planner.md"
---

# Sub-Spec 4 — Ledger repositories

## Codebase analysis

`src/storage/repositories/shipRepository.ts` is the template — campaign-scoped,
soft-deleting, `excludeDeleted` on every read, `CURRENT_SHIP_SCHEMA_VERSION` as a
module constant, TSDoc on every export.

**One inconsistency to resolve deliberately.** The repo has two soft-delete
signatures:

- `shipRepository.softDelete(id)` — generates its own `txId`, no enlistment.
- `campaignRepository.softDelete(id, txId?)` — accepts a caller's `txId` so the
  row can join an existing cascade.

**Follow `campaignRepository`'s `(id, txId?)` form.** It is the more capable of
the two and costs nothing. Ship's narrower signature predates the cascade
convention; do not propagate it.

## Interface Contracts

**Provides:** `ledgerRepository` and `ledgerSplitRepository` module surfaces.
**Requires:** `LedgerEntry`, `PayoutSplit` and the Dexie tables from SS-02.

### ledgerRepository
- Direction: Sub-spec 4 → Sub-specs 7, 9
- Owner: Sub-spec 4
- Shape: `listByCampaign(campaignId, opts?)`, `getById(id, opts?)`, `create(data)`,
  `update(id, patch)`, `softDelete(id, txId?)`, `restore(id)`, `hardDelete(id)`

### ledgerSplitRepository.getOrCreateForCampaign
- Direction: Sub-spec 4 → Sub-spec 7
- Owner: Sub-spec 4
- Shape: `getOrCreateForCampaign(campaignId: string): Promise<LedgerSplitRow>`

## Decisions (committed — do not escalate)

- **`getOrCreateForCampaign` is idempotent under a concurrent first read.** If
  more than one non-deleted row exists for a campaign, return the oldest by
  `createdAt` and soft-delete the rest. Cheap insurance; the screen then never
  has to handle a null or a duplicate split. (Red-team A-6.)
- **A new split defaults to `shipFundPct: 0` and no rows.** Not 50 — that is this
  particular crew's agreement, not a product default, and guessing it would be a
  hardcoded user-facing value.
- **`listByCampaign` returns entries already in fold order** (`date`,
  `createdAt`, `id`) so callers never re-sort and cannot get it subtly wrong.
- **`hardDelete` exists and is never imported by UI code.** Purge jobs only.

## Implementation steps

### Step 1. `ledgerRepository.ts`

Copy `shipRepository.ts`'s shape. Every read passes through `excludeDeleted` from
`../../utils/softDelete` unless `{ includeDeleted: true }`. `create` uses
`generateId()` and `nowISO()`.

### Step 2. `ledgerSplitRepository.ts`

Same shape plus `getOrCreateForCampaign`. Implement the duplicate-collapse inside
a `db.transaction('rw', db.ledgerSplits, …)` so the read-decide-write is atomic.

### Step 3. Verify build and read-path coverage

```bash
npm run build
grep -c "excludeDeleted" src/storage/repositories/ledgerRepository.ts
```

The count must be at least the number of functions that read rows.

### Step 4. Commit

```bash
git add src/storage/repositories/ledgerRepository.ts src/storage/repositories/ledgerSplitRepository.ts
git commit -m "feat(ledger): entry and split repositories"
```

## Verification Commands

```bash
npm run build
npm test
```

## Checks

| Criterion | Type | Command |
|---|---|---|
| Reads filter soft-deleted rows | [MECHANICAL] | `[ $(grep -c "excludeDeleted" src/storage/repositories/ledgerRepository.ts) -ge 1 ] \|\| (echo "FAIL: ledgerRepository has no excludeDeleted call" && exit 1)` |
| softDelete accepts a cascade txId | [STRUCTURAL] | `grep -qE "softDelete\(id: string, txId\?" src/storage/repositories/ledgerRepository.ts \|\| (echo "FAIL: softDelete does not accept txId — follow campaignRepository, not shipRepository" && exit 1)` |
| restore exported from both | [STRUCTURAL] | `grep -q "export async function restore" src/storage/repositories/ledgerRepository.ts && grep -q "export async function restore" src/storage/repositories/ledgerSplitRepository.ts \|\| (echo "FAIL: restore missing" && exit 1)` |
| getOrCreateForCampaign exists | [STRUCTURAL] | `grep -q "getOrCreateForCampaign" src/storage/repositories/ledgerSplitRepository.ts \|\| (echo "FAIL: getOrCreateForCampaign missing" && exit 1)` |
| hardDelete never called from UI | [STRUCTURAL] | `! grep -rq "hardDelete" src/screens src/features/ledger 2>/dev/null \|\| (echo "FAIL: hardDelete reachable from UI" && exit 1)` |
| Build clean | [MECHANICAL] | `npm run build \|\| (echo "FAIL: build" && exit 1)` |
