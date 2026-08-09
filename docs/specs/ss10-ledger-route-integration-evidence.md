# SS-10 — Integration evidence: campaign ledger and jump route

Date: 2026-08-08
Branch: `2026/08/09-0319-caleb-logic-feat-campaign-ledger-and-route-planner`

Exercised in a real browser against a seeded **Pirates of the Spinward Main**
campaign, using the actual financial profile and route from Session 1
(097-1105 Regina).

## Gates

> **Updated 2026-08-09** after the convergence run over this spec
> (`docs/converge/2026-08-09-campaign-ledger-and-route-planner/`). The gate
> numbers below are current; the original figures at the time this file was
> first written were 819 tests / 50 files. Three passes of scanning added
> `renderLedger.test.ts`, `ledgerSplitRepository.test.ts`,
> `routeRepository.test.ts` and two `routePlanner` schema pins.

| Gate | Result |
|---|---|
| `npm test` | **854 passed / 53 files** (baseline was 763 / 47) |
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
- Traveller renders the route screen with five declaration-labelled fields. The
  labels read `['Name', 'UWP', 'Hex', 'Jump', 'Notes']` — asserted against the
  rendered DOM, and none of those words appears in the screen's source.
- Switching the campaign to Dragonbane: **no route nav link**, and `/route`
  **redirects** — the browser lands on `/session`.

  > *Corrected 2026-08-09.* This section previously said `/route` "says
  > *Dragonbane does not use a route planner*". That was true of the original
  > implementation and is no longer true of the code: SS-08's Decisions block
  > requires a redirect and explicitly forbids an error page, and the
  > convergence run replaced the panel with
  > `<Navigate to="/session" replace />` (`src/screens/RouteScreen.tsx:53`).
  > The string no longer exists anywhere in `src/`.
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

*Reviewed line by line on 2026-08-09 during the convergence run, after two
separate stale claims were found in this file. Every item below was re-checked
against the tree rather than carried forward.*

- The ink-capture surface of `/session/log` — untouched by this work and not
  driven by any harness here.
- **The session ZIP export.** Verified by construction and through the shared
  `buildLedgerMarkdown` helper, *not* by unzipping a produced archive. The
  single-file session Markdown path and both standalone exports (ledger and
  route) were each exercised end to end in a browser; the ZIP path was not.
- Import / round-trip of a campaign bundle containing ledger or route rows.
- No Dragonbane surface beyond the two checks above was re-tested; none was
  touched.
- **`ledgerRepository.ts` has no dedicated test file.** Its siblings
  (`ledgerSplitRepository.test.ts`, `routeRepository.test.ts`) do. No SS-04
  criterion requires one, and its behaviour is covered by the browser run — but
  it is the module that writes the money and is the thinnest-covered new code
  here. Recorded as a recommendation, deliberately not fixed inside a
  convergence loop.

### Corrected on 2026-08-09

This section previously claimed **"the `QuickLogBar` path still logs title-only…
it has not been touched or tested."** That was true when written and false by the
time it was read: commit `768410b` changed the call to
`logToSession(title, 'log', {}, { body: title })` and the fix was verified in a
browser (`decisions.md`, 2026-08-09). The claim was *two* faults deep — the bar
also wrote the wrong note **type**, so its entries were filtered out of
`/session/log` entirely rather than merely rendering blank.

Left standing here because the same section is where a reader looks to decide
what still needs attention, and an out-of-date "known limitation" is worse than
no note at all: it sends someone to fix something already fixed, and it makes
every other item in the list less trustworthy.
