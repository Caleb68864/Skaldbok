---
type: phase-spec
sub_spec_id: SS-07
sub_spec: 7
phase: run
depends_on: ['SS-01', 'SS-03', 'SS-04']
wave: 3
master_spec: "docs/specs/2026-08-08-campaign-ledger-and-route-planner.md"
---

# Sub-Spec 7 — Ledger screen, split editor and Distribute modal

## Size warning

This is the largest unit in the spec (red-team A-5): five new files, a screen
plus two modals plus two hooks. It sits at the top of the 1–3 file band. It is
broken into nine steps below rather than left as one block. If a worker finds
step 5 or 6 ballooning, that is the signal to stop and report rather than push
through.

It touches three cross-cutting concerns (routing, state, persistence) — below the
four-concern overload threshold, so it is not force-split.

## Codebase analysis

- **Engine resolution:** `src/features/encounters/ParticipantDrawer.tsx:31` does
  `useSystemDefinition(activeCampaign?.system ?? 'classic-fantasy')`. Copy that.
  **Do not** use `useSystemEngine()` — it keys off the *active character*, and the
  ledger is campaign-scoped with no character guaranteed.
- **Nav:** `src/components/shell/CampaignHeader.tsx:177` holds the `Ships` link
  inside the sheet menu. Add `Ledger` beside it, same `className`, same
  `onClick={() => setSheetOpen(false)}`.
- **Routing:** `src/routes/index.tsx` — add `{ path: '/ledger', element: <LedgerScreen /> }`
  inside the `ShellLayout` children, beside `/ships` (line 88).
- **Party members** come from `partyRepository`; `PartyMember` already models a
  seat that is either a linked character or a bare `name`, which is exactly what
  a payee row needs.

## Interface Contracts

**Requires:**
- `currency.formatAmount` and `currency.baseDenominationId` from SS-01
- `computeDistribution`, `validateSplit`, `evenSplit`, `computeRunningBalance` from SS-03
- `ledgerRepository`, `ledgerSplitRepository` from SS-04

**Provides:** `src/screens/LedgerScreen.tsx` — the mount point SS-09 adds an
export control to.

## Decisions (committed — do not escalate)

- **`baseDenominationId` is read here.** The amount input is labelled with the
  `abbr` of the denomination it names. This is the shipped reader that keeps
  `declaredCapabilities.test.ts` green — SS-01 cannot satisfy it alone.
  (Red-team C-1.) Do not satisfy it by allowlisting.
- **The user never types a sign.** Two inputs, In and Out; the Out path negates
  on write.
- **The Distribute modal catches invariant throws.** `computeDistribution` throws
  on a breach; an unhandled throw in a React event handler is a white screen
  mid-session. Catch, toast the error message, write nothing. (Red-team A-1.)
- **Distribute is disabled with a visible reason** when `validateSplit` returns
  `over`, and when gross is zero or negative. Disabled-without-explanation is
  worse than absent.
- **Distributing beyond the balance is allowed** with a warning. Crews go into the
  red and the book should say so.
- **Empty state, never a blank screen,** when there is no active campaign —
  matching `useExportActions`' null-safe pattern.
- **New split defaults to 0% ship fund and no rows.** Do not seed 50% — that is
  this crew's agreement, not a product default.

## Implementation steps

### Step 1. `useLedger` hook

Reads entries via `ledgerRepository.listByCampaign`, folds
`computeRunningBalance`, exposes `entries`, `balance`, `addEntry`, `removeEntry`.
Resolves the engine from the campaign's system.

### Step 2. `useLedgerSplit` hook

`getOrCreateForCampaign`, exposes `split`, `validation` (from `validateSplit`),
`setShipFundPct`, `setRowPercent`, `addRow`, `removeRow`, `applyEvenSplit`.

### Step 3. `LedgerScreen` skeleton and route

The In/Out/Balance table plus the empty state. Register `/ledger` and the nav
link. Verify it renders before adding behaviour.

### Step 4. The add-entry form

Two amount inputs labelled from `baseDenominationId`'s `abbr`. Out negates on
write. All rendered money goes through `formatAmount`.

### Step 5. `SplitEditor`

One row per payee. Payee picker offers party members; a typed name with no
`payeeMemberId` is equally valid. Live running total with the over/under warning.
Even split button.

### Step 6. `DistributeModal`

Gross input, live leg preview from `computeDistribution`, net shown before
commit. Wrap the call in try/catch — toast on throw, write nothing.

### Step 7. Commit the distribution

One entry: `kind: 'distribution'`, `gross`, signed `amount`, `legs`, and a
**deep copy** of the split as `splitSnapshot`. A shallow copy shares the rows
array and lets a later edit mutate history — use `structuredClone` or an explicit
map.

### Step 8. Verify in a browser

Seed a Traveller campaign, record income, distribute, and read `ledgerEntries`
directly in IndexedDB (`skaldbok-db`) to confirm the snapshot and the net.

### Step 9. Commit

```bash
git add src/screens/LedgerScreen.tsx src/features/ledger src/routes/index.tsx src/components/shell/CampaignHeader.tsx
git commit -m "feat(ledger): the crew's shared cashbook"
```

## Verification Commands

```bash
npm run build
npx vitest run src/features/systems/declaredCapabilities.test.ts
```

## Checks

| Criterion | Type | Command |
|---|---|---|
| Route registered | [STRUCTURAL] | `grep -q "'/ledger'" src/routes/index.tsx \|\| (echo "FAIL: /ledger not registered" && exit 1)` |
| No systemId branching | [MECHANICAL] | `! grep -rq "systemId ===" src/features/ledger src/screens/LedgerScreen.tsx \|\| (echo "FAIL: systemId branch in ledger UI" && exit 1)` |
| Never touches character wealth | [MECHANICAL] | `! grep -rq "character.wealth" src/features/ledger \|\| (echo "FAIL: ledger reaches into character wealth" && exit 1)` |
| baseDenominationId has a real reader | [MECHANICAL] | `grep -rq "baseDenominationId" src/features/ledger src/screens/LedgerScreen.tsx \|\| (echo "FAIL: baseDenominationId declared in SS-01 but never read — declaredCapabilities will fail" && exit 1)` |
| Money rendered through the engine | [MECHANICAL] | `grep -rq "formatAmount" src/features/ledger src/screens/LedgerScreen.tsx \|\| (echo "FAIL: ledger formats money itself" && exit 1)` |
| Engine resolved from the campaign | [STRUCTURAL] | `grep -rq "useSystemDefinition" src/features/ledger \|\| (echo "FAIL: ledger does not resolve the system from the campaign" && exit 1)` |
| Distribute failure is caught | [STRUCTURAL] | `grep -q "catch" src/features/ledger/DistributeModal.tsx \|\| (echo "FAIL: DistributeModal does not catch invariant throws" && exit 1)` |
| Declared capabilities green | [MECHANICAL] | `npx vitest run src/features/systems/declaredCapabilities.test.ts \|\| (echo "FAIL: a declared engine member has no reader" && exit 1)` |
| Build clean | [MECHANICAL] | `npm run build \|\| (echo "FAIL: build" && exit 1)` |
