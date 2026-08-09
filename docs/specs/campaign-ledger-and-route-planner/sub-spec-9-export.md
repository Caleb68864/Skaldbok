---
type: phase-spec
sub_spec_id: SS-09
sub_spec: 9
phase: run
depends_on: ['SS-03', 'SS-04', 'SS-06', 'SS-07', 'SS-08']
wave: 5
master_spec: "docs/specs/2026-08-08-campaign-ledger-and-route-planner.md"
---

# Sub-Spec 9 — Markdown export, wired to both screens

## Why the screens are in scope

The first draft added two actions to `useExportActions` and depended only on the
data layers — so the actions would have shipped with nothing calling them
(red-team C-3). The screens are now in `Files (modify)` and SS-07/SS-08 are
dependencies. **An export action with no button is not done.**

## Codebase analysis

- `src/utils/export/renderSession.ts` — the house style: a local `yamlValue`
  helper for frontmatter, `deduplicateFilename` for archive safety, and a return
  of `Map<filename, content>`.
- `src/features/export/useExportActions.ts` — every action is null-safe: toast
  and early-return with no active campaign, try/catch internally, never rejects.
  Delivery is `shareFile(blob, generateFilename(...))`.
- `generateFilename` is `Note`-typed, which is why a sibling helper is needed
  rather than a widened signature.
- Lines 131 and 189 apply `excludePrivateNotes`, with a comment recording that
  those paths *were once unfiltered by mistake*.

## Interface Contracts

### generateEntityFilename
- Direction: Sub-spec 9 → Sub-spec 9 (internal), future callers
- Owner: Sub-spec 9
- Shape: `generateEntityFilename(input: { title: string; date: string }): string`
- The existing `generateFilename(note)` delegates to it; its own signature is
  unchanged.

**Requires:** repositories from SS-04 and SS-06; `LedgerEntry`/`RouteStop` from
SS-02; both screens from SS-07 and SS-08.

## Decisions (committed — do not escalate)

- **No privacy filtering on either export.** A campaign cashbook and a jump route
  are shared crew data by definition, and neither entity carries a private flag.
  Adding one is scope creep. This is a deliberate decision — recorded here, and
  required in SS-10's `docs/decisions.md` entry — precisely because
  `useExportActions.ts:131,189` shows this codebase has shipped an accidentally
  unfiltered export path before, and the next reader must be able to tell the two
  cases apart. (Red-team A-2.)
- **Delegate, don't widen.** `generateFilename(note)` keeps its signature and
  calls the new helper. Widening it would touch every current caller for no gain.
- **The ledger export renders legs and snapshot percentages**, so the exported
  book is self-auditing without the app.
- **Both actions follow the existing null-safe contract:** toast and return early
  with no active campaign, catch internally, never reject.

## Implementation steps

### Step 1. Write the failing test

`src/utils/export/renderLedger.test.ts`. Build a ledger with one manual entry and
one distribution, render it, and assert the output contains: the ship-fund leg,
every payee leg with its percentage, and a running-balance column.

### Step 2. Verify it fails

```bash
npx vitest run src/utils/export/renderLedger.test.ts
```

### Step 3. `generateEntityFilename`

Add to `src/utils/export/generateFilename.ts`; refactor `generateFilename` to
delegate. Confirm no existing caller changes.

### Step 4. The two renderers

`renderLedger.ts` and `renderRoute.ts`, matching `renderSession.ts`'s frontmatter
and table style. Money rendered through the engine's `formatAmount`.

### Step 5. Two actions on `useExportActions`

`exportLedger` and `exportRoute`, following the null-safe pattern exactly.

### Step 6. Wire the buttons — the step that makes this real

Add an export control to `LedgerScreen.tsx` and `RouteScreen.tsx`, each calling
its action. Verify in a browser that both produce a Markdown blob.

### Step 7. Commit

```bash
git add src/utils/export src/features/export/useExportActions.ts src/screens/LedgerScreen.tsx src/screens/RouteScreen.tsx
git commit -m "feat(export): share the cashbook and the jump route as Markdown"
```

## Verification Commands

```bash
npx vitest run src/utils/export/
npm run build
```

## Checks

| Criterion | Type | Command |
|---|---|---|
| Ledger renderer suite passes | [MECHANICAL] | `npx vitest run src/utils/export/renderLedger.test.ts \|\| (echo "FAIL: renderLedger suite" && exit 1)` |
| Both filename helpers exported | [STRUCTURAL] | `grep -q "export function generateFilename" src/utils/export/generateFilename.ts && grep -q "generateEntityFilename" src/utils/export/generateFilename.ts \|\| (echo "FAIL: generateEntityFilename missing or original export removed" && exit 1)` |
| Both renderers exist | [STRUCTURAL] | `test -f src/utils/export/renderLedger.ts && test -f src/utils/export/renderRoute.ts \|\| (echo "FAIL: a renderer is missing" && exit 1)` |
| Actions exist on the hook | [STRUCTURAL] | `grep -qi "exportLedger" src/features/export/useExportActions.ts && grep -qi "exportRoute" src/features/export/useExportActions.ts \|\| (echo "FAIL: export actions missing" && exit 1)` |
| Actions are not orphaned — ledger | [MECHANICAL] | `grep -qi "exportLedger" src/screens/LedgerScreen.tsx \|\| (echo "FAIL: exportLedger has no caller — orphaned action" && exit 1)` |
| Actions are not orphaned — route | [MECHANICAL] | `grep -qi "exportRoute" src/screens/RouteScreen.tsx \|\| (echo "FAIL: exportRoute has no caller — orphaned action" && exit 1)` |
| Existing note export untouched | [MECHANICAL] | `npx vitest run src/utils/export/renderSession.test.ts \|\| (echo "FAIL: note/session export regressed" && exit 1)` |
| Build clean | [MECHANICAL] | `npm run build \|\| (echo "FAIL: build" && exit 1)` |
