---
type: phase-spec
sub_spec_id: SS-03
sub_spec: 3
phase: run
depends_on: ['SS-02']
wave: 2
master_spec: "docs/specs/2026-08-08-campaign-ledger-and-route-planner.md"
---

# Sub-Spec 3 — Ledger arithmetic, the tested core

## Why this exists

This is the sub-spec the whole feature rests on. Everything else is plumbing;
this is where a bug silently corrupts the crew's books. The original design got
it wrong — it treated the ship fund as an outflow, which would have drifted the
balance upward-wrong by half of every payout, compounding, invisibly. That is
why there are two invariants and not one.

## Interface Contracts

**Provides:** `computeRunningBalance`, `validateSplit`, `evenSplit`,
`computeDistribution`.
**Requires:** `LedgerEntry`, `LedgerLeg`, `PayoutSplit` from SS-02.

### computeDistribution
- Direction: Sub-spec 3 → Sub-spec 7
- Owner: Sub-spec 3
- Shape: `computeDistribution(gross: number, split: PayoutSplit): { legs: LedgerLeg[]; net: number }`
- Throws on a non-positive `gross`, and on any invariant breach.

### validateSplit
- Direction: Sub-spec 3 → Sub-spec 7
- Owner: Sub-spec 3
- Shape: `validateSplit(split: PayoutSplit): { total: number; status: 'ok' | 'under' | 'over' }`

### evenSplit
- Direction: Sub-spec 3 → Sub-spec 7
- Owner: Sub-spec 3
- Shape: `evenSplit(n: number): number[]` — sums to exactly 100, remainder on leading rows.

## The invariants

> **I1** `sum(legs.map(l => l.amount)) === gross`
> **I2** `net === −(gross − shipFundLegAmount)`

I1 says the money is all accounted for. I2 says only the money that actually left
is subtracted from the balance. Both are asserted before returning; a breach
throws rather than returning a plausible wrong answer.

## Decisions (committed — do not escalate)

- **Integer arithmetic only.** `Math.floor` throughout. No float reaches a return
  value. Percentages are the only non-integer input and are consumed immediately.
- **Leg order:** ship fund, then payees in split-row order, then unallocated.
  Deterministic order matters — the export and the UI both render this sequence.
- **Rounding residual folds into the ship-fund leg.** It is the residual pot by
  nature, and it keeps I1 exact without a synthetic "rounding" leg.
- **Under 100 → an `unallocated` leg** carrying the shortfall, counted as paid
  out. Never silently redistributed to payees.
- **Over 100 → `status: 'over'`;** the caller must not proceed. `computeDistribution`
  does not defend against this itself beyond the invariant assertions.
- **`gross <= 0` throws.** A zero distribution satisfies both invariants vacuously
  and would write a meaningless entry.
- **Fold order:** `date`, then `createdAt`, then `id`. The `id` tiebreak makes the
  result deterministic when two rows share a millisecond.
- **No I/O.** This module imports nothing from `dexie`, `react`, or `../storage/`.

## Implementation steps

### Step 1. Write the failing tests first

`src/utils/ledgerMath.test.ts`. Cover, at minimum:

1. `computeRunningBalance` — a mixed in/out sequence produces the right running
   totals; two entries sharing `date` and `createdAt` order stably by `id`.
2. `validateSplit` — `ok` at exactly 100, `under` at 60, `over` at 110.
3. `evenSplit` — `evenSplit(3)` is `[34, 33, 33]`; `evenSplit(7)` sums to 100;
   `evenSplit(1)` is `[100]`.
4. `computeDistribution` — the worked example from the master spec: gross 100000,
   shipFundPct 50, two rows at 30. Assert the ship-fund leg is 50000, both payee
   legs are 15000, an `unallocated` leg of 20000 exists, legs sum to 100000, and
   `net === -50000`.
5. **The invariant sweep.** A loop over at least 20 `(gross, shipFundPct, rows)`
   combinations chosen to force rounding — primes, odd percentages, three and
   five payees. Assert I1 and I2 for every one. This is the test that matters
   most; write it as a loop, not as spot checks.
6. `computeDistribution(0, …)` and `computeDistribution(-1, …)` both throw.

### Step 2. Verify they fail

```bash
npx vitest run src/utils/ledgerMath.test.ts
```

### Step 3. Implement `src/utils/ledgerMath.ts`

Follow the six-step algorithm in the master spec exactly. Assert I1 and I2 at the
end of `computeDistribution` and throw an `Error` naming which invariant broke —
the message ends up in a toast (SS-07), so make it human-readable.

### Step 4. Verify they pass

```bash
npx vitest run src/utils/ledgerMath.test.ts
```

### Step 5. Prove the tests bite (mutation check)

This module is load-bearing, so verify the tests actually constrain it:

1. Invert the residual fold (subtract instead of add) → confirm a named test fails → restore.
2. Remove the ship-fund exclusion from `net` → confirm a named test fails → restore.
3. Flip `evenSplit`'s remainder to the trailing rows → confirm a named test fails → restore.

Record the three failing test names — SS-10 requires them in its evidence file.

### Step 6. Commit

```bash
git add src/utils/ledgerMath.ts src/utils/ledgerMath.test.ts
git commit -m "feat(ledger): distribution arithmetic with asserted invariants"
```

## Verification Commands

```bash
npx vitest run src/utils/ledgerMath.test.ts
npm run build
```

## Checks

| Criterion | Type | Command |
|---|---|---|
| Ledger math suite passes | [MECHANICAL] | `npx vitest run src/utils/ledgerMath.test.ts \|\| (echo "FAIL: ledgerMath suite" && exit 1)` |
| Module is pure — no Dexie | [STRUCTURAL] | `! grep -q "from 'dexie'" src/utils/ledgerMath.ts \|\| (echo "FAIL: ledgerMath imports dexie" && exit 1)` |
| Module is pure — no React | [STRUCTURAL] | `! grep -q "from 'react'" src/utils/ledgerMath.ts \|\| (echo "FAIL: ledgerMath imports react" && exit 1)` |
| Module is pure — no storage layer | [STRUCTURAL] | `! grep -q "storage/" src/utils/ledgerMath.ts \|\| (echo "FAIL: ledgerMath reaches into storage" && exit 1)` |
| All four functions exported | [STRUCTURAL] | `for f in computeRunningBalance validateSplit evenSplit computeDistribution; do grep -q "export function $f" src/utils/ledgerMath.ts \|\| (echo "FAIL: $f not exported" && exit 1); done` |
| Invariants are asserted, not assumed | [STRUCTURAL] | `grep -qE "throw new Error" src/utils/ledgerMath.ts \|\| (echo "FAIL: no invariant assertion found" && exit 1)` |
