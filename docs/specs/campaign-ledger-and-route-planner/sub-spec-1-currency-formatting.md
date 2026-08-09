---
type: phase-spec
sub_spec_id: SS-01
sub_spec: 1
phase: run
depends_on: []
wave: 1
master_spec: "docs/specs/2026-08-08-campaign-ledger-and-route-planner.md"
---

# Sub-Spec 1 — Character-free currency formatting on the engine

## Why this exists

`CurrencyModel` is `{ mode, label, denominations, read, write }`, and both `read`
and `write` take a `CharacterRecord`. The ledger is campaign-scoped and has no
character. Because the ledger is ungated, Dragonbane's three-denomination
`coins` mode must render too — so "print the integer" is not a fallback.

## Codebase analysis

- `src/features/systems/engine/types.ts:72` — `CurrencyModel` interface.
  `CurrencyDenomination` at line 31 already carries `value` ("worth in the
  smallest denomination"), which is exactly the decomposition input needed.
- Adapters: `classicFantasyEngine.ts`, `travellerEngine.ts`,
  `savageWorldsEngine.ts`. All three must satisfy the widened interface or
  `tsc -b` fails — which is the enforcement mechanism, no runtime check needed.
- `engineContract.test.ts` fingerprints the engine's visible output. Adding
  members changes the fingerprint; expect to extend it.
- Tests are `<module>.test.ts` beside the module, Vitest, `npm test` = `vitest run`.

## Interface Contracts

### CurrencyModel.formatAmount
- Direction: Sub-spec 1 → Sub-spec 7, Sub-spec 9
- Owner: Sub-spec 1
- Shape: `formatAmount: (baseUnits: number) => string`

### CurrencyModel.baseDenominationId
- Direction: Sub-spec 1 → Sub-spec 7
- Owner: Sub-spec 1
- Shape: `baseDenominationId: string` — the id of the denomination with the
  lowest `value`; ledger amounts are integer counts of it.

**Provides:** both members above.
**Requires:** nothing.
**Shared state:** none.

## Decisions (committed — do not escalate)

- **Reader obligation.** `declaredCapabilities.test.ts` scans this exact file for
  two-space-indented interface properties and requires a `.field` / `['field']`
  read somewhere in `src` outside tests. `formatAmount` is read by SS-07/SS-09;
  `baseDenominationId` is read by SS-07's amount-input label. Neither may be
  added to `KNOWN_UNIMPLEMENTED`.
- **Additive only.** No existing member's signature changes. This is what keeps
  Dragonbane's wealth panels provably untouched.
- **Formatting.** Thousands separators via `toLocaleString('en-US')`. Zero renders
  as `0` in the base denomination, never an empty string. Negative values render
  with a leading `-` before the abbreviation.
- **Reuse check first.** Grep `src/utils/` for an existing denomination splitter
  before writing one. If one exists, delegate to it.

## Implementation steps

### Step 1. Write the failing test

Create `src/features/systems/engine/currencyFormat.test.ts`. Assert, for each
bundled system's engine:

- `baseDenominationId` names a denomination that exists in `denominations` and
  has the lowest `value` of any of them.
- Traveller: `formatAmount(15000)` contains `15,000`; `formatAmount(0)` is
  non-empty; `formatAmount(-15000)` renders as negative.
- classic-fantasy: a value spanning denominations renders more than one
  denomination `abbr`.
- Round-trip sanity: the sum of `count × value` implied by the rendered string
  equals the input.

### Step 2. Verify the test fails

```bash
npx vitest run src/features/systems/engine/currencyFormat.test.ts
```

Expect a type error or assertion failure — the members do not exist yet.

### Step 3. Widen the interface

Add to `CurrencyModel` in `src/features/systems/engine/types.ts`, with TSDoc on
both explaining the ledger is the consumer:

```ts
  /** Id of the smallest denomination — the unit ledger amounts are stored in. */
  baseDenominationId: string;
  /** Renders a bare base-unit integer. Sign-aware. */
  formatAmount: (baseUnits: number) => string;
```

`npm run build` now fails in three adapters. That failure is the checklist.

### Step 4. Implement in each adapter

Decompose descending by `denominations[].value`, emitting only non-zero
denominations (except when the total is zero, where the base denomination is
emitted with `0`). Traveller's single credit denomination collapses to the simple
case automatically — do not special-case it.

### Step 5. Verify tests pass and the contract fingerprint moves

```bash
npx vitest run src/features/systems/engine/currencyFormat.test.ts
npx vitest run src/features/systems/engine/engineContract.test.ts
npm run build
```

If `engineContract.test.ts` fails on a changed fingerprint, extend the
fingerprint — that test exists to notice exactly this, and updating it is the
correct response, not a workaround.

### Step 6. Commit

```bash
git add src/features/systems/engine
git commit -m "feat(engine): render money without a character"
```

## Verification Commands

```bash
npm run build
npx vitest run src/features/systems/engine/
```

## Checks

| Criterion | Type | Command |
|---|---|---|
| `CurrencyModel` declares both new members | [STRUCTURAL] | `grep -q "baseDenominationId" src/features/systems/engine/types.ts && grep -q "formatAmount" src/features/systems/engine/types.ts \|\| (echo "FAIL: CurrencyModel missing new members" && exit 1)` |
| All three adapters satisfy the interface | [MECHANICAL] | `npm run build \|\| (echo "FAIL: build — an adapter does not implement the widened CurrencyModel" && exit 1)` |
| Currency format suite passes | [MECHANICAL] | `npx vitest run src/features/systems/engine/currencyFormat.test.ts \|\| (echo "FAIL: currency formatting" && exit 1)` |
| Engine contract still fingerprints | [MECHANICAL] | `npx vitest run src/features/systems/engine/engineContract.test.ts \|\| (echo "FAIL: engine contract" && exit 1)` |
| No new KNOWN_UNIMPLEMENTED entries | [STRUCTURAL] | `! grep -qE "baseDenominationId\|formatAmount" src/features/systems/declaredCapabilities.test.ts \|\| (echo "FAIL: new member was allowlisted instead of read" && exit 1)` |

**Note on the last check:** it will pass in isolation but the
`declaredCapabilities` suite itself only goes green once SS-07 lands the
`baseDenominationId` reader. That is intentional and is recorded in the master
spec's SS-01 criteria — do not resolve it by allowlisting.
