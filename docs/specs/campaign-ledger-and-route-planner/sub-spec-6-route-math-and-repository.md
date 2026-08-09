---
type: phase-spec
sub_spec_id: SS-06
sub_spec: 6
phase: run
depends_on: ['SS-02', 'SS-05']
wave: 2
master_spec: "docs/specs/2026-08-08-campaign-ledger-and-route-planner.md"
---

# Sub-Spec 6 — Route arithmetic and repository

## Interface Contracts

**Provides:** `reorder`, `totalDistance`, `readNumericField`; `routeRepository`.
**Requires:** `RouteStop` from SS-02; `routePlanner.distanceFieldId` from SS-05.

### readNumericField
- Direction: Sub-spec 6 → Sub-specs 8
- Owner: Sub-spec 6
- Shape: `readNumericField(values: Record<string, string>, id: string): number`
- The **single** parse boundary in the whole route feature.

### routeRepository.reorder
- Direction: Sub-spec 6 → Sub-spec 8
- Owner: Sub-spec 6
- Shape: `reorder(campaignId: string, orderedIds: string[]): Promise<void>` —
  writes every affected row inside one `db.transaction('rw', …)`.

## Decisions (committed — do not escalate)

- **`readNumericField` returns `0`** for missing, blank, or unparseable input. It
  never returns `NaN` and never throws. Storage stays strings; the declared field
  `type` drives the input element only.
- **Dense ordering from 0**, renumbered wholesale on every reorder. Not sparse
  fractional ordering — these lists are ~20 rows and dense is the variant that
  cannot drift into float-collision territory over a campaign.
- **Reorder is transactional.** An interrupted write must not leave two stops
  sharing an index.
- **`routeRepository` follows `campaignRepository`'s `softDelete(id, txId?)`**,
  same as SS-04, not `shipRepository`'s narrower form.

## Implementation steps

### Step 1. Write the failing tests

`src/utils/routeMath.test.ts`:

1. `readNumericField({}, 'jump')`, `{ jump: '' }`, `{ jump: 'abc' }` all return 0;
   `{ jump: '2' }` returns 2; `{ jump: '2.5' }` returns 2.5.
2. `totalDistance` over a list where one stop has a blank distance returns a
   finite number — assert `Number.isFinite`, which is the assertion that would
   have caught the original `NaN` design.
3. `reorder` on a 5-item list moving index 0 to 3 yields orders exactly
   `[0,1,2,3,4]` with no duplicates and the expected identity sequence.
4. `reorder` on a single-item list and on an empty list return without throwing.

### Step 2. Verify they fail

```bash
npx vitest run src/utils/routeMath.test.ts
```

### Step 3. Implement `src/utils/routeMath.ts`

Pure — no Dexie, no React. `totalDistance(stops, distanceFieldId)` delegates every
numeric read to `readNumericField`.

### Step 4. Implement `src/storage/repositories/routeRepository.ts`

`shipRepository.ts` shape plus `reorder`. `create` appends at `order = count`.

### Step 5. Verify

```bash
npx vitest run src/utils/routeMath.test.ts
npm run build
```

### Step 6. Commit

```bash
git add src/utils/routeMath.ts src/utils/routeMath.test.ts src/storage/repositories/routeRepository.ts
git commit -m "feat(route): stop ordering and the single numeric parse boundary"
```

## Verification Commands

```bash
npx vitest run src/utils/routeMath.test.ts
npm run build
```

## Checks

| Criterion | Type | Command |
|---|---|---|
| Route math suite passes | [MECHANICAL] | `npx vitest run src/utils/routeMath.test.ts \|\| (echo "FAIL: routeMath suite" && exit 1)` |
| Parse boundary exported | [STRUCTURAL] | `grep -q "export function readNumericField" src/utils/routeMath.ts \|\| (echo "FAIL: readNumericField not exported" && exit 1)` |
| reorder and totalDistance exported | [STRUCTURAL] | `grep -q "export function reorder" src/utils/routeMath.ts && grep -q "export function totalDistance" src/utils/routeMath.ts \|\| (echo "FAIL: routeMath exports incomplete" && exit 1)` |
| Module is pure | [STRUCTURAL] | `! grep -qE "from 'dexie'\|from 'react'\|storage/" src/utils/routeMath.ts \|\| (echo "FAIL: routeMath is not pure" && exit 1)` |
| Reorder is transactional | [STRUCTURAL] | `grep -q "db.transaction" src/storage/repositories/routeRepository.ts \|\| (echo "FAIL: routeRepository.reorder is not transactional" && exit 1)` |
| Reads filter soft-deleted rows | [MECHANICAL] | `[ $(grep -c "excludeDeleted" src/storage/repositories/routeRepository.ts) -ge 1 ] \|\| (echo "FAIL: routeRepository has no excludeDeleted call" && exit 1)` |
| Build clean | [MECHANICAL] | `npm run build \|\| (echo "FAIL: build" && exit 1)` |

**Moved out of this sub-spec:** the "no `parseFloat` outside `routeMath`" check
now lives in SS-08. It greps `src/features/route` and `src/screens/RouteScreen.tsx`,
which do not exist until SS-08 creates them — a worker here cannot satisfy it.
(Red-team C-5.)
