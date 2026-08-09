---
type: phase-spec
sub_spec_id: SS-10
sub_spec: 10
phase: verify
depends_on: ['SS-07', 'SS-08', 'SS-09']
wave: 6
master_spec: "docs/specs/2026-08-08-campaign-ledger-and-route-planner.md"
---

# Sub-Spec 10 — End-to-end verification, decisions entries, integration evidence

This **is** the integration sub-spec. No separate one is auto-generated — it
already carries both `[INTEGRATION]` criteria, the cross-boundary browser run,
and the mutation checks.

## Interface Contracts

**Requires:** everything. **Provides:** the evidence file and the decisions
entries.

## Decisions (committed — do not escalate)

- **Browser harness:** Python Playwright (the Playwright MCP is unavailable).
  `npm run dev` serves `https://localhost:5173` with a self-signed cert, so the
  context needs `ignore_https_errors=True`.
- **IndexedDB is `skaldbok-db`.**
- **Seeding an active campaign** needs three things: a `campaigns` row with
  `status: 'active'`, a `sessions` row, and a `metadata` row
  `{ id: 'activeCampaignId', key: 'activeCampaignId', value: '<campaignId>' }`.
- **Themes are switched only through the Settings UI.** `settings.theme` in
  IndexedDB overrides localStorage, so a direct localStorage write is undone on
  the next render.
- **Real character to import:**
  `C:\Users\CalebBennett\Documents\Notes\Traveler\Characters\Milo Aer\Milo Aer.skaldbok.json`,
  already verified importable through the library's Import button.
- **Do not re-test Dragonbane** beyond the two checks below. No Dragonbane
  surface was touched; a broad regression sweep is wasted effort.
- **The commit step is mandatory.** This sub-spec's only new file is Markdown.
  Writing it without committing reports success while producing nothing durable.

## Implementation steps

### Step 1. Gates

```bash
npm test
npm run build
```

`npm test` must pass no fewer than the 763 tests green at baseline, plus the new
suites.

### Step 2. Seed and run the ledger flow

Seed a Traveller campaign, import Milo Aer, then in the browser: record income,
open the split editor, set percentages, run Distribute. Read `ledgerEntries`
directly from IndexedDB and confirm `gross`, the signed `amount`, every leg, and
`splitSnapshot`.

### Step 3. Prove the snapshot is immutable — the point of the feature

Change the split to different percentages. Re-read the stored entry. Its
`splitSnapshot` and leg amounts must be **byte-identical**. If this fails,
nothing else about the feature matters.

### Step 4. Run the route flow

Add three stops, reorder one, reload, confirm the order persisted with dense
sequential `order` values.

### Step 5. Export both

Confirm each produces a Markdown blob.

### Step 6. Dragonbane check — narrow

Switch the seeded campaign to a Dragonbane system. Confirm exactly two things:
no route nav link, and ledger amounts render as coins. Nothing further.

### Step 7. Mutation checks

For each, break it, confirm a **named** test fails, restore:

1. Invert `computeDistribution`'s residual fold.
2. Remove the ship-fund exclusion from the I2 net calculation.
3. Flip `evenSplit`'s remainder direction.

A mutation that survives means the code is untested or the test is wrong — fix
whichever. Record the three failing test names.

### Step 8. Write the evidence file

`docs/specs/ss10-ledger-route-integration-evidence.md`: what was exercised, what
was observed in IndexedDB, the three mutation-check test names, and anything
**not** exercised — state omissions plainly rather than implying full coverage.

### Step 9. Write the decisions entries

`docs/decisions.md`, house style: symptom, fix, and Watch lines. Required Watch
lines:

- The signed-amount convention **diverges** from the debts feature's
  `direction: 'owed' | 'due'`, and why — a cashbook whose balance is a plain sum
  cannot have a sign typed wrong, which that entry's own Watch line predicted.
- Why `gross` and `amount` differ on a distribution: the ship fund is retained,
  not paid out, so only the crew's share leaves the balance.
- The ledger export is **deliberately** unfiltered, unlike the note export paths
  at `useExportActions.ts:131,189`.

### Step 10. Commit

The worker MUST commit before reporting `status: complete`.

**`docs/` is gitignored** (`.gitignore:8`), yet 50 files under it are tracked —
including `docs/decisions.md` and the prior `ss06`/`ss11` evidence files. The
convention is force-add. A plain `git add` on the new evidence file **silently
does nothing**, and the commit then reports success having staged only
`decisions.md`.

```bash
git add docs/decisions.md
git add -f docs/specs/ss10-ledger-route-integration-evidence.md
git commit -m "docs: record the ledger and route decisions"
```

## Verification Commands

```bash
npm test
npm run build
grep -c "<FILL-IN>" docs/decisions.md   # must be 0 — the pre-commit hook blocks otherwise
```

## Checks

| Criterion | Type | Command |
|---|---|---|
| Full suite green | [MECHANICAL] | `npm test \|\| (echo "FAIL: npm test" && exit 1)` |
| Build clean | [MECHANICAL] | `npm run build \|\| (echo "FAIL: build" && exit 1)` |
| Evidence file written | [STRUCTURAL] | `test -f docs/specs/ss10-ledger-route-integration-evidence.md \|\| (echo "FAIL: evidence file missing" && exit 1)` |
| Evidence names the mutation tests | [STRUCTURAL] | `grep -qi "mutation" docs/specs/ss10-ledger-route-integration-evidence.md \|\| (echo "FAIL: evidence does not record the mutation checks" && exit 1)` |
| Decisions entries written | [STRUCTURAL] | `grep -q "2026-08-08" docs/decisions.md \|\| (echo "FAIL: no dated decisions entry" && exit 1)` |
| Watch line on the sign convention | [STRUCTURAL] | `grep -qi "signed" docs/decisions.md \|\| (echo "FAIL: no Watch line on the signed-amount convention" && exit 1)` |
| No placeholders left | [MECHANICAL] | `[ $(grep -c "<FILL-IN>" docs/decisions.md) -eq 0 ] \|\| (echo "FAIL: <FILL-IN> placeholder blocks the pre-commit hook" && exit 1)` |
| Evidence file is actually tracked | [MECHANICAL] | `git ls-files --error-unmatch docs/specs/ss10-ledger-route-integration-evidence.md >/dev/null 2>&1 \|\| (echo "FAIL: evidence file is untracked — docs/ is gitignored, it needs git add -f" && exit 1)` |
| Artifacts committed | [MECHANICAL] | `git diff --quiet HEAD -- docs/decisions.md docs/specs/ss10-ledger-route-integration-evidence.md \|\| (echo "FAIL: artifacts written but not committed" && exit 1)` |
