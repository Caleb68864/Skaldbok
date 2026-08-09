# SS-10 — Integration evidence: campaign ledger and jump route

Date: 2026-08-08
Branch: `2026/08/09-0319-caleb-logic-feat-campaign-ledger-and-route-planner`

Exercised in a real browser against a seeded **Pirates of the Spinward Main**
campaign, using the actual financial profile and route from Session 1
(097-1105 Regina).

## Gates

| Gate | Result |
|---|---|
| `npm test` | **819 passed / 50 files** (baseline was 763 / 47) |
| `npm run build` | clean (`tsc -b && vite build`) |
| `declaredCapabilities.test.ts` | passes, no new `KNOWN_UNIMPLEMENTED` entries |
| `systemDefinitionSchema.test.ts` | passes, asserts Traveller's 5 route fields survive Zod |
| `engineContract.test.ts` | passes after the `CurrencyModel` widening |

## Browser harness

Python Playwright against `npm run dev` (`https://localhost:5175`,
`ignore_https_errors=True`). IndexedDB `skaldbok-db`, seeded with a `campaigns`
row (`status: 'active'`), a `sessions` row, and the `activeCampaignId` metadata
row. Two scripts, **30/30** and **15/15** checks passing.

## Session 1 data used

- Crew pay split as agreed at the table: **50% ship fund**, then
  Johnathan Johnson 36 / Milo Aer 36 / Eldon Holt 18 / Derrick Daylighter 10.
- Real spends: Milo Cr5,100 (rescue bubble + recon wardrobe); Johnathan
  Cr20,000 vacc suit and Cr10,000 toward Milo's; monthly operating costs
  Cr267,878 (of which Cr201,335 mortgage).
- Income: the Cr819,000 speculative full-hold figure the notes cost out
  (63 tons × Cr13,000/ton electronics at Regina).
- Route: Regina 1910 (A788899-C) → Extolay 1711 (B55589A-A, 2pc) →
  Knorbes 1807 (E888765-2, 4pc) → Zila 2908 (E556727-7, 11pc) →
  Regina (10pc). **27 parsecs total.**

## What was verified

### Ledger
- Money out stores a **negative** integer; the user never types a sign.
- Cr267,878 stored exactly; balance folds to the arithmetic sum.
- Distributing Cr819,000 by the agreed split produced, read back from
  IndexedDB: ship fund **Cr409,500**, Johnathan **Cr147,420**, Milo
  **Cr147,420**, Eldon **Cr73,710**, Derrick **Cr40,950**.
- **I1** legs sum to gross (819,000). **I2** net is **−Cr409,500**, not
  −Cr819,000 — the retained ship fund is excluded from the balance movement.
- The percentages were snapshotted onto the entry.

### The snapshot requirement — the one that matters
The split was renegotiated **after** the payout (ship fund 50 → 70, Johnathan
36 → 25) and the page reloaded. The written entry's `splitSnapshot` and every
leg amount were compared byte-for-byte before and after: **identical**. The live
split row did change (control assertion, confirmed at 70), so the test proves
immutability rather than an absent write.

### Route
- 5 stops stored with dense ordering `[0,1,2,3,4]`.
- Regina's UWP and Zila's hex round-tripped through the generic `values` bag.
- 27-parsec total rendered.
- Reordering Zila and reloading persisted the new order, still dense.

### System gating
- Traveller renders the route screen with five declaration-labelled fields.
- Switching the campaign to Dragonbane: **no route nav link**, and `/route`
  says "Dragonbane does not use a route planner."
- The same stored integers render as **`1065g 2s 2c`** under Dragonbane's coin
  system and `Cr …` under Traveller — one `formatAmount`, no branch.

### Session-log integration
- Every ledger movement writes a `log` note scoped to the active session,
  carrying `typeData.ledgerEntryId` back to the entry.
- The distribution note names every share:
  `Ledger: distributed Cr 819,000 — ship fund Cr 409,500 (retained),
  Johnathan Johnson Cr 147,420, Milo Aer Cr 147,420, Eldon Holt Cr 73,710,
  Derrick Daylighter Cr 40,950`
- The lines are **visible in `/session/log`** (see the bug found, below).
- Session Markdown export appends the cashbook; the session ZIP ships it as
  `ledger.md`.

## Mutation checks

Each mutation applied, the named test confirmed failing, then restored:

| Mutation | Test that caught it |
|---|---|
| Invert the rounding-residual fold (`shipFund + residue` → `- residue`) | `computeDistribution > holds both invariants across inputs chosen to force rounding` |
| Treat the ship fund as an outflow (`net = -gross`) | `computeDistribution > retains the ship fund and pays out only the rest` (+3 others) |
| Flip `evenSplit`'s remainder to the trailing rows | `evenSplit > puts the remainder on the leading rows` |

No mutation survived.

## Bugs found and fixed during verification

1. **`-0` net.** `-(0)` is negative zero in JavaScript; a fully-retained payout
   produced `-0`, which would render as "-0". Normalised.
2. **Missing React key** in `LedgerScreen` — an entry renders as its own row
   plus one per leg, so the key belongs on the fragment. Found via console.
3. **`logToSession` never wrote a note body** (pre-existing). `SessionLog`
   renders `docToText(entry.body)`, not the title, so notes logged with a title
   alone appeared as **rows containing nothing but a timestamp**. Added an
   optional `body` to `LogToSessionOptions`, converted to a ProseMirror doc at
   the boundary (a raw string round-trips to nothing).

## Not exercised

- **The `QuickLogBar` path still logs title-only**, so notes typed there remain
  blank rows in `/session/log`. It is the same defect as (3) above and the fix
  is now one argument away, but changing it was outside this change's scope and
  it has not been touched or tested.
- The ink-capture surface of `/session/log` (untouched here).
- The session ZIP export was verified by construction and by the shared
  `buildLedgerMarkdown` helper, not by unzipping a produced archive; the
  single-file session Markdown path and the standalone ledger export were both
  exercised end to end.
- Import/round-trip of a campaign bundle containing ledger or route rows.
- No Dragonbane surface beyond the two checks above was re-tested; none was
  touched.
