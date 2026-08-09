# Campaign Ledger and Route Planner

## Meta

- Project: Skaldbok
- Repo: `C:\Users\CalebBennett\Documents\GitHub\Skaldbok` (branch `Production`)
- Date: 2026-08-08
- Author: Caleb Bennett
- Source design: `docs/plans/2026-08-08-campaign-ledger-and-route-planner-design-evaluated.md`
- Status: ready
- Quality: Outcome 5 / Scope 5 / Decisions 5 / Edges 4 / Criteria 5 / Decomposition 4 / Purpose 5 = **33/35**

## Outcome

A Traveller crew can keep a shared cashbook for the campaign: record money in and
out, and run a Distribute action that takes off a ship-fund percentage and splits
the remainder among hand-entered crew percentages — writing one auditable ledger
entry that **snapshots the percentages it used**. The same campaign can keep an
ordered, reorderable jump route of worlds with Traveller's own field labels.
Both export as Markdown through the existing notes-log path. A Dragonbane campaign
sees the ledger (rendering coins correctly) and no route planner at all.

## Intent

**Trade-off hierarchy**, highest first:

1. **Auditability over convenience.** A past distribution must never change. When
   a design choice trades ease of entry against the integrity of history, history
   wins.
2. **Consistency with existing patterns over ideal design.** `shipRepository.ts`
   and `renderSession.ts` are the templates. Match them even where a fresh design
   would differ.
3. **Data-driven over branched.** A value that differs between rulesets comes from
   the engine or the system JSON, never from a `systemId` comparison.
4. **Additive over restructuring.** New optional members on existing contracts;
   never a changed signature.

**Decision boundaries.** Decide autonomously on structure, naming, decomposition,
test organisation and copy. Stop and ask before changing an existing
`CurrencyModel` signature, adding a Dexie upgrade callback, introducing a
`systemId ===` branch outside `baseEngineFor`, or pushing to any remote.

## Context

Both features come from a live Traveller session where the table had no shared
record of money or travel. The ledger's real job is settling arguments weeks
later, which is why the snapshot requirement — not the arithmetic — is the point.

Key repo facts established by inspection during design and evaluation:

- `campaignRepository.softDelete(id, txId?)` does **not** cascade to campaign-scoped
  side entities; `ships` and `inventoryContainers` are not cascaded. These three
  new tables match that behaviour.
- `TrashScreen.tsx` is a 104-line creatures-only MVP; Ships is not registered in
  it either.
- `CurrencyModel` is `{ mode, label, denominations, read, write }` — `read` and
  `write` both take a `CharacterRecord`. **There is no character-free formatter.**
- `ParticipantDrawer.tsx:31` resolves a system from a campaign via
  `useSystemDefinition(activeCampaign.system)` — the pattern the ledger uses.
- The Dexie ladder ends at `version(14)`.
- `schemas/system.schema.ts` is at the **repo root**, not under `src/`.
- The `Ships` nav link in `CampaignHeader.tsx` is ungated — a known wart, not a
  pattern to copy.

## Requirements

1. Money is stored as a signed integer count of the system's base currency
   denomination. Positive is in, negative is out. The user never types a sign.
2. The running balance is **derived by folding entries**, never persisted.
3. A distribution writes exactly one ledger entry carrying `gross`, the signed net
   `amount`, its `legs`, and a deep-copied `splitSnapshot`.
4. Two invariants hold for every distribution, asserted in code:
   **I1** `sum(legs.amount) === gross`; **I2** `amount === −(gross − shipFundLeg.amount)`.
5. Editing the current split never alters any previously written entry.
6. Split percentages that total under 100 produce a visible `Unallocated` leg;
   over 100 disables the Distribute action.
7. `evenSplit(n)` returns percentages summing to exactly 100, remainder on the
   leading rows.
8. `CurrencyModel` gains `baseDenominationId` and `formatAmount(baseUnits)`,
   implemented in all three engine adapters, with **no existing signature changed**.
9. A system declares its route fields via `SystemDefinition.routePlanner`; the
   route screen and its nav entry exist only when that block is present.
10. `routePlanner` is added to `schemas/system.schema.ts` in the same change as the
    TypeScript type, and is read by shipped code so `declaredCapabilities.test.ts`
    passes without an allowlist entry.
11. Route stops are dense-ordered and reordered inside a single Dexie transaction.
12. Both features export Markdown through `shareFile`, matching `renderSession.ts`
    frontmatter style.
13. All three new tables follow the soft-delete convention: `excludeDeleted` on
    every read, `softDelete` from UI, `hardDelete` never called from UI.
14. Schema changes land in a **new** `version(15)` block.

## Sub-Specs

---
sub_spec_id: SS-01
phase: run
depends_on: []
---

### 1. Character-free currency formatting on the engine

- **Scope:** Add `baseDenominationId: string` and `formatAmount(baseUnits: number): string` to `CurrencyModel` as required members, and implement them in all three adapters by decomposing across `denominations[].value` descending. Traveller renders `Cr 15,000`; classic-fantasy renders multi-denomination coins; Savage Worlds follows its own single denomination. Sign-aware. No existing member's signature changes.
- **Files (modify):**
  - `src/features/systems/engine/types.ts`
  - `src/features/systems/engine/classicFantasyEngine.ts`
  - `src/features/systems/engine/travellerEngine.ts`
  - `src/features/systems/engine/savageWorldsEngine.ts`
- **Files (new):**
  - `src/features/systems/engine/currencyFormat.test.ts`
- **Decisions:** Before writing a decomposition helper, grep `src/utils/` for an existing denomination splitter and reuse it if one exists. Thousands separators use `toLocaleString('en-US')`. Zero renders as the base denomination with a `0`, not an empty string. **Both new members must have a real reader in shipped code** — `formatAmount` is read by SS-07 and SS-09; `baseDenominationId` is read by SS-07's entry form, which labels the amount input with that denomination's `abbr`. Declaring either without a reader fails `declaredCapabilities.test.ts`, which scans this exact file for two-space-indented properties.
- **Acceptance criteria:**
  - `[STRUCTURAL]` `CurrencyModel` in `src/features/systems/engine/types.ts` declares `baseDenominationId: string` and `formatAmount: (baseUnits: number) => string`.
  - `[MECHANICAL]` `npm run build` exits 0 — proving all three adapters satisfy the widened interface.
  - `[MECHANICAL]` `npx vitest run src/features/systems/declaredCapabilities.test.ts` exits 0 once SS-07 has landed, with neither `baseDenominationId` nor `formatAmount` added to `KNOWN_UNIMPLEMENTED`.
  - `[BEHAVIORAL]` Traveller `formatAmount(15000)` returns a string containing `15,000`; `formatAmount(-15000)` renders as negative.
  - `[BEHAVIORAL]` classic-fantasy `formatAmount` of a value spanning denominations renders more than one denomination abbreviation.
  - `[MECHANICAL]` `npx vitest run src/features/systems/engine/engineContract.test.ts` exits 0.

---
sub_spec_id: SS-02
phase: run
depends_on: []
---

### 2. Domain types and Dexie version 15

- **Scope:** Zod schemas and inferred types for the ledger entry (with legs), the payout split, and the route stop. Add `version(15)` to the Dexie ladder with three new tables and the three `Table<>` declarations on the class. No `.upgrade()` callback — all tables are new.
- **Files (new):**
  - `src/types/ledger.ts`
  - `src/types/payoutSplit.ts`
  - `src/types/routeStop.ts`
- **Files (modify):**
  - `src/storage/db/client.ts`
- **Decisions:** Store strings for `RouteStop.values` regardless of a field's declared `type`; `name` is a real column, everything else lives in `values`. Leg `amount` is a non-negative magnitude with direction implied by `kind`; only the entry's `amount` is signed. Follow `src/types/ship.ts` for the audit-field block and `schemaVersion` constant placement.
- **Acceptance criteria:**
  - `[STRUCTURAL]` `src/storage/db/client.ts` contains a `this.version(15).stores({...})` block declaring `ledgerEntries`, `ledgerSplits` and `routeStops`, and the existing `version(14)` block is byte-identical to before.
  - `[STRUCTURAL]` `ledgerEntrySchema` declares `gross` as optional and `amount` as a signed integer; `ledgerLegSchema` declares `kind` as an enum of `shipFund`, `payee`, `unallocated`.
  - `[STRUCTURAL]` All three entity schemas declare `deletedAt` and `softDeletedBy` as optional strings.
  - `[STRUCTURAL]` `payoutSplitRowSchema` declares `payeeMemberId` optional and `payeeName` required — the snapshot field that survives a member rename.
  - `[MECHANICAL]` `npm run build` exits 0.

---
sub_spec_id: SS-03
phase: run
depends_on: ['SS-02']
---

### 3. Ledger arithmetic — the tested core

- **Scope:** Pure functions with no Dexie or React import: `computeRunningBalance`, `validateSplit`, `evenSplit`, `computeDistribution`. Distribution asserts I1 and I2 and throws rather than returning a wrong result. Exhaustive tests including the rounding and under/over-100 cases.
- **Files (new):**
  - `src/utils/ledgerMath.ts`
  - `src/utils/ledgerMath.test.ts`
- **Decisions:** `computeDistribution(gross: number, split: PayoutSplit): { legs: LedgerLeg[]; net: number }`, legs ordered ship fund, payees in split-row order, then unallocated. Integer arithmetic only — `Math.floor` throughout, no float reaches a return value. Rounding residual folds into the ship-fund leg. `computeRunningBalance` orders by `date`, then `createdAt`, then `id`. `evenSplit(3) === [34, 33, 33]` — remainder on leading rows.
- **Acceptance criteria:**
  - `[MECHANICAL]` `npx vitest run src/utils/ledgerMath.test.ts` exits 0.
  - `[BEHAVIORAL]` For gross 100000, shipFundPct 50, rows totalling 60: legs sum to 100000 (I1), the ship-fund leg is 50000, an `unallocated` leg of 20000 exists, and `net === -50000` (I2).
  - `[BEHAVIORAL]` A split whose rows total over 100 causes `validateSplit` to return `status: 'over'`.
  - `[BEHAVIORAL]` `computeDistribution` rejects a gross of 0 or a negative by throwing, rather than returning legs that satisfy the invariants vacuously.
  - `[BEHAVIORAL]` For at least 20 varied `(gross, shipFundPct, rows)` combinations chosen to force rounding, I1 and I2 both hold — asserted in a loop, not by spot check.
  - `[BEHAVIORAL]` `evenSplit(3)` returns `[34, 33, 33]` and `evenSplit(7)` sums to exactly 100.
  - `[BEHAVIORAL]` `computeRunningBalance` returns a stable order for two entries sharing a `date` and `createdAt`, differing only by `id`.
  - `[STRUCTURAL]` `src/utils/ledgerMath.ts` imports nothing from `dexie`, `react`, or `../storage/`.

---
sub_spec_id: SS-04
phase: run
depends_on: ['SS-02']
---

### 4. Ledger repositories

- **Scope:** `ledgerRepository` (entries) and `ledgerSplitRepository` (one row per campaign, created lazily on first read). Both modelled on `shipRepository.ts`: `listByCampaign`, `getById`, `create`, `update`, `softDelete`, `restore`, `hardDelete`.
- **Files (new):**
  - `src/storage/repositories/ledgerRepository.ts`
  - `src/storage/repositories/ledgerSplitRepository.ts`
- **Decisions:** `ledgerSplitRepository.getOrCreateForCampaign(campaignId)` returns an existing row or creates one with `shipFundPct: 0` and no rows — the screen never has to handle a null split. It is **idempotent under a concurrent first read**: if more than one row exists for a campaign it returns the oldest by `createdAt` and soft-deletes the rest, rather than trusting that a race cannot happen. Entries are returned in fold order (`date`, `createdAt`, `id`) so the caller does not re-sort.
- **Acceptance criteria:**
  - `[BEHAVIORAL]` Calling `getOrCreateForCampaign` twice for a fresh campaign yields the same row id both times, and `ledgerSplits` holds exactly one non-deleted row for that campaign.
  - `[MECHANICAL]` `grep -c "excludeDeleted" src/storage/repositories/ledgerRepository.ts` returns a count equal to or greater than the number of read functions in the file.
  - `[STRUCTURAL]` Both files export `softDelete(id, txId?)` and `restore(id)`, and neither is imported by any file under `src/screens/` or `src/features/` for `hardDelete`.
  - `[STRUCTURAL]` `ledgerSplitRepository` exports `getOrCreateForCampaign`.
  - `[MECHANICAL]` `npm run build` exits 0.

---
sub_spec_id: SS-05
phase: run
depends_on: []
---

### 5. `routePlanner` declared on the system contract

- **Scope:** Add the optional `routePlanner` block to `SystemDefinition`, add the matching Zod entry to the root `schemas/system.schema.ts`, and declare Traveller's five fields in its `system.json` with a `version` bump.
- **Files (modify):**
  - `src/types/system.ts`
  - `schemas/system.schema.ts`
  - `src/systems/traveller/system.json`
- **Decisions:** Shape is `{ label: string; distanceFieldId?: string; fields: Array<{ id: string; label: string; type?: 'text' | 'textarea' | 'number' }> }`. Traveller declares `label: 'Jump Route'`, `distanceFieldId: 'jump'`, and fields `name` (text), `uwp` (text), `hex` (text), `jump` (number), `notes` (textarea). Only `system.json` is bumped — the sheet layout is untouched, so `sheet.json` keeps its version.
- **Acceptance criteria:**
  - `[STRUCTURAL]` `schemas/system.schema.ts` contains a `routePlanner` entry whose `fields` array validates `id` and `label` as required.
  - `[MECHANICAL]` `npx vitest run src/features/systems/engine/systemDefinitionSchema.test.ts` exits 0.
  - `[BEHAVIORAL]` Parsing the Traveller definition through `systemDefinitionSchema` returns a result whose `routePlanner.fields` has length 5 — proving Zod does not strip the new key.
  - `[STRUCTURAL]` `src/systems/traveller/system.json` has a `version` strictly greater than its value on `HEAD`.
  - `[STRUCTURAL]` Neither `classic-fantasy` nor `savage-worlds` `system.json` declares `routePlanner`.

---
sub_spec_id: SS-06
phase: run
depends_on: ['SS-02', 'SS-05']
---

### 6. Route arithmetic and repository

- **Scope:** `routeMath` with `reorder`, `totalDistance` and the single numeric parse boundary `readNumericField`; plus `routeRepository` following the ship template, with reordering written in one Dexie transaction.
- **Files (new):**
  - `src/utils/routeMath.ts`
  - `src/utils/routeMath.test.ts`
  - `src/storage/repositories/routeRepository.ts`
- **Decisions:** `readNumericField(values, id): number` returns 0 for missing, blank or unparseable input, and is the only place in the feature that parses a numeric string. `reorder(stops, from, to)` returns a fully dense-renumbered array starting at 0. `routeRepository.reorder(campaignId, orderedIds)` writes every affected row inside one `db.transaction('rw', ...)`.
- **Acceptance criteria:**
  - `[MECHANICAL]` `npx vitest run src/utils/routeMath.test.ts` exits 0.
  - `[BEHAVIORAL]` `readNumericField({}, 'jump')` returns 0; `readNumericField({ jump: '' }, 'jump')` returns 0; `readNumericField({ jump: 'abc' }, 'jump')` returns 0; `readNumericField({ jump: '2' }, 'jump')` returns 2.
  - `[BEHAVIORAL]` `totalDistance` over a list where one stop has a blank distance returns a finite number, never `NaN`.
  - `[BEHAVIORAL]` `reorder` on a 5-item list moving index 0 to index 3 yields orders exactly `[0,1,2,3,4]` with no duplicates.
  - `[BEHAVIORAL]` `reorder` on a single-item list and on an empty list both return without throwing.

---
sub_spec_id: SS-07
phase: run
depends_on: ['SS-01', 'SS-03', 'SS-04']
---

### 7. Ledger screen, split editor and Distribute modal

- **Scope:** `/ledger` screen listing entries with In / Out / Balance columns and an add-entry form that negates on write for the Out column. A split editor with per-row hand-entered percentages, a live running total with an over/under warning, and an Even split button. A Distribute modal that previews legs and net before committing, and writes the entry with its snapshot. Register the route and an ungated nav link.
- **Files (new):**
  - `src/screens/LedgerScreen.tsx`
  - `src/features/ledger/useLedger.ts`
  - `src/features/ledger/useLedgerSplit.ts`
  - `src/features/ledger/DistributeModal.tsx`
  - `src/features/ledger/SplitEditor.tsx`
- **Files (modify):**
  - `src/routes/index.tsx`
  - `src/components/shell/CampaignHeader.tsx`
- **Decisions:** Resolve the engine via `useSystemDefinition(activeCampaign.system)`, following `ParticipantDrawer.tsx:31` — never `useSystemEngine()`, which keys off the active character. All money rendered through `currency.formatAmount`. The amount input is labelled with the `abbr` of the denomination named by `currency.baseDenominationId` — this is the shipped reader for that member. The split-row payee picker offers party members and also accepts a typed name with no `payeeMemberId`. Distribute is disabled with a visible reason when `validateSplit` returns `over`, and rejects a non-positive gross the same way. The modal **catches** any invariant throw from `computeDistribution`, shows a toast, and writes nothing — an unhandled throw here is a white screen mid-session.
- **Acceptance criteria:**
  - `[STRUCTURAL]` `src/routes/index.tsx` registers `/ledger` inside the `ShellLayout` children.
  - `[MECHANICAL]` `! grep -rq "systemId ===" src/features/ledger src/screens/LedgerScreen.tsx` exits 0 — no systemId branching.
  - `[MECHANICAL]` `! grep -rq "character.wealth" src/features/ledger` exits 0 — the ledger never touches character money.
  - `[MECHANICAL]` `grep -rq "baseDenominationId" src/features/ledger src/screens/LedgerScreen.tsx` exits 0 — proving the declared member has a real reader.
  - `[BEHAVIORAL]` With a Traveller campaign seeded, entering an amount in the Out column stores a negative `amount` in `ledgerEntries` (verified by reading IndexedDB).
  - `[BEHAVIORAL]` Attempting to distribute a gross of 0 or a negative leaves Distribute disabled with a visible reason and writes no entry.
  - `[BEHAVIORAL]` Distributing more than the current balance succeeds and shows a warning — the entry is written and the balance goes negative.
  - `[BEHAVIORAL]` If `computeDistribution` throws, the modal surfaces a toast and `ledgerEntries` gains no row (force by stubbing the helper in a scratch run, then restore).
  - `[BEHAVIORAL]` Distributing Cr 100,000 at 50% ship fund with rows totalling 60 writes one entry whose `splitSnapshot.rows` matches the split at that moment, and whose displayed balance drops by 50,000 — not 100,000.
  - `[BEHAVIORAL]` After that distribution, editing the split to different percentages leaves the written entry's `splitSnapshot` and leg amounts unchanged on re-read.
  - `[BEHAVIORAL]` Setting rows to total 110 disables Distribute and shows the reason.
  - `[HUMAN REVIEW]` The In/Out/Balance table is readable on a tablet at arm's length in the Traveller theme.

---
sub_spec_id: SS-08
phase: run
depends_on: ['SS-05', 'SS-06', 'SS-07']
---

### 8. Route screen with declaration-driven fields and gated nav

- **Scope:** `/route` screen rendering one editable row per stop, with inputs generated from `system.routePlanner.fields` and labelled from the declaration. Add, edit, delete and reorder. Register the route and a nav link **gated** on `system.routePlanner` being declared. This sub-spec contains the reader that satisfies `declaredCapabilities.test.ts`.
- **Files (new):**
  - `src/screens/RouteScreen.tsx`
  - `src/features/route/useRoute.ts`
- **Files (modify):**
  - `src/routes/index.tsx`
  - `src/components/shell/CampaignHeader.tsx`
- **Decisions:** Reorder via up/down controls rather than drag — reliable under a stylus on a tablet, and the existing screens have no drag primitive to reuse. Field `type` drives the input element only; every value is stored as a string. Direct navigation to `/route` for a system with no declaration redirects, matching the existing catch-all convention. This sub-spec is sequenced **after** SS-07 because both edit `src/routes/index.tsx` and `src/components/shell/CampaignHeader.tsx`; running them concurrently in isolated worktrees would collide on both files.
- **Acceptance criteria:**
  - `[MECHANICAL]` `grep -rq "routePlanner" src/screens src/features/route src/components/shell` exits 0 — proving a real reader exists outside the type files.
  - `[MECHANICAL]` `npx vitest run src/features/systems/declaredCapabilities.test.ts` exits 0 **without** `routePlanner` being added to `KNOWN_UNIMPLEMENTED`.
  - `[MECHANICAL]` `! grep -rqi "uwp\|parsec" src/screens/RouteScreen.tsx src/features/route` exits 0 — Traveller vocabulary comes from the declaration, never the screen.
  - `[MECHANICAL]` `! grep -rq "parseFloat\|parseInt\|Number(" src/features/route src/screens/RouteScreen.tsx` exits 0 — parsing lives only in `routeMath.readNumericField`. *(Relocated from SS-06, whose worker cannot see these files.)*
  - `[BEHAVIORAL]` In a Traveller campaign, the route screen renders five labelled inputs per stop, including one labelled from the declaration's `uwp` entry.
  - `[BEHAVIORAL]` In a Dragonbane campaign, no route nav link is rendered and `/route` does not render a route screen.
  - `[BEHAVIORAL]` Moving the third stop up by one and reloading shows the new order persisted with dense sequential `order` values.

---
sub_spec_id: SS-09
phase: run
depends_on: ['SS-03', 'SS-04', 'SS-06', 'SS-07', 'SS-08']
---

### 9. Markdown export for both features, wired to both screens

- **Scope:** Two renderers matching `renderSession.ts` house style (YAML frontmatter via its `yamlValue` approach, Markdown tables), a general filename helper, two new actions on `useExportActions`, **and the export controls on both screens that call them**. The ledger export renders each distribution's legs and its snapshot percentages so the exported book is self-auditing.
- **Files (new):**
  - `src/utils/export/renderLedger.ts`
  - `src/utils/export/renderRoute.ts`
  - `src/utils/export/renderLedger.test.ts`
- **Files (modify):**
  - `src/utils/export/generateFilename.ts`
  - `src/features/export/useExportActions.ts`
  - `src/screens/LedgerScreen.tsx`
  - `src/screens/RouteScreen.tsx`
- **Decisions:** Add `generateEntityFilename({ title, date }): string` to `generateFilename.ts` and have the existing `generateFilename(note)` delegate to it — do not widen the note signature and touch every caller. Both new actions follow the existing null-safe pattern: toast and return early with no active campaign, catch internally, never reject. **No privacy filtering on the ledger export** — a campaign cashbook is shared crew data by definition and entries carry no private flag. This is a deliberate decision, not an oversight; `useExportActions.ts:131` and `:189` apply `excludePrivateNotes` to *note* paths only, and a comment there records that those paths were once unfiltered by mistake. Record the decision in `docs/decisions.md` under SS-10 so the next reader does not re-litigate it.
- **Acceptance criteria:**
  - `[MECHANICAL]` `npx vitest run src/utils/export/renderLedger.test.ts` exits 0.
  - `[STRUCTURAL]` `src/utils/export/generateFilename.ts` exports both `generateFilename` and `generateEntityFilename`, and the original export's signature is unchanged.
  - `[BEHAVIORAL]` Rendering a ledger containing one distribution produces Markdown containing the ship-fund leg, every payee leg with its percentage, and the running balance column.
  - `[BEHAVIORAL]` `useExportActions` exposes a ledger action and a route action that each show a toast and return without throwing when there is no active campaign.
  - `[INTEGRATION]` Both screens render an export control that invokes its action and produces a Markdown blob — verified in a live browser, not by inspection. Neither action is orphaned.
  - `[MECHANICAL]` `npm run build` exits 0.

---
sub_spec_id: SS-10
phase: verify
depends_on: ['SS-07', 'SS-08', 'SS-09']
---

### 10. End-to-end verification, decisions entries and integration evidence

- **Scope:** Prove both features work in a real browser against real data, run the full test and build gates, mutation-check the load-bearing arithmetic, and write the `docs/decisions.md` entries. Produce an evidence file recording what was actually exercised.
- **Files (new):**
  - `docs/specs/ss10-ledger-route-integration-evidence.md`
- **Files (modify):**
  - `docs/decisions.md`
- **Decisions:** Browser verification uses Python Playwright against `npm run dev` at `https://localhost:5173` with `ignore_https_errors=True`; IndexedDB is `skaldbok-db`; seed `campaigns` with `status: 'active'`, a `sessions` row, and a `metadata` row `{ id: 'activeCampaignId', key: 'activeCampaignId', value: '<campaignId>' }`. Themes are switched only through the Settings UI. Dragonbane is not re-tested beyond confirming the route planner is absent and the ledger renders coins — no other Dragonbane surface was touched.
- **Acceptance criteria:**
  - `[MECHANICAL]` `npm test` exits 0 with no fewer than the 763 tests currently passing.
  - `[MECHANICAL]` `npm run build` exits 0.
  - `[INTEGRATION]` In a live browser on a seeded Traveller campaign: record income, open the split editor, set percentages, run Distribute, and confirm the new entry, its legs, its `splitSnapshot` and the resulting balance directly in IndexedDB — then change the split and confirm the stored entry is unchanged.
  - `[INTEGRATION]` In the same browser session: add three route stops, reorder one, reload the page, and confirm the order persisted; then export both the ledger and the route and confirm each produces a Markdown blob.
  - `[BEHAVIORAL]` Switch the seeded campaign to a Dragonbane system and confirm the route nav link is absent and ledger amounts render as coins.
  - `[MECHANICAL]` Mutation check: invert the residual fold in `computeDistribution`, confirm a named test fails, restore. Remove the ship-fund exclusion from the I2 net calculation, confirm a named test fails, restore. Change `evenSplit`'s remainder direction, confirm a named test fails, restore. Record the three failing test names in the evidence file.
  - `[STRUCTURAL]` `docs/decisions.md` gains entries for both features, each with a symptom, a fix, and Watch lines covering: the signed-amount convention diverging from the debts feature's `direction` field; why `gross` and `amount` differ on a distribution; and that the ledger export is deliberately unfiltered because a cashbook is shared crew data with no private flag.
  - `[MECHANICAL]` `grep -c "<FILL-IN>" docs/decisions.md` returns 0 — the pre-commit hook blocks otherwise.

## Edge Cases

- **Split totals under 100** — distribute anyway, materialising the shortfall as a visible `Unallocated` leg rather than silently inflating a crewmate's cut.
- **Split totals over 100** — Distribute disabled with the reason shown. You cannot pay out more than the pot.
- **Rounding residual** — folded into the ship-fund leg, the residual pot by nature. I1 and I2 asserted; a violation throws rather than writing a wrong entry.
- **Payee renamed, unlinked or soft-deleted after a payout** — nothing changes. The leg's `payeeName` is a snapshot; `payeeMemberId` is a soft reference used only to re-link a picker.
- **No party configured** — split rows accept ad-hoc typed names. The ledger works with zero party setup.
- **No active campaign** — both screens render an empty state. Never a blank screen.
- **Distribution exceeds the balance** — allowed, with a warning. Crews go into the red and the book should say so.
- **Blank or non-numeric route distance** — `readNumericField` returns 0; the total renders and never shows `NaN`.
- **System declares no `routePlanner`** — screen and nav entry do not exist; direct navigation redirects.
- **Imported system's `routePlanner`** — prevented from being stripped by shipping the Zod entry in SS-05, pinned by test.
- **Two entries sharing a date and creation millisecond** — `id` is the final ordering tiebreak, so the fold is deterministic.
- **Gross of zero or negative** — `computeDistribution` throws; the modal keeps Distribute disabled with a visible reason and writes nothing.
- **An invariant assertion fires at the table** — the Distribute modal catches, toasts, and writes nothing. An unhandled throw in a React event handler is a white screen mid-session, which is worse than a refused action.
- **Two concurrent first reads of a campaign's split** — `getOrCreateForCampaign` returns the oldest row and soft-deletes any duplicate, rather than assuming the race cannot happen.

## Out of Scope

- **Double-entry bookkeeping.** `legs[]` is the seam; `accountId` is not added. A later accounts feature needs no new table but will need to backfill `accountId` onto existing legs — stated so nobody is surprised.
- **A separate ship-fund balance.** One book; the fund is retained money inside it.
- **Any "fill from ship shares" calculator.** Ship shares are a fixed character-creation artifact, the group intends to renegotiate, and the 4/4/4 weights were a throwaway hand-derivation.
- **Jump maps, world generation, UWP validation.** Fields are typed, never computed or checked against a table.
- **Trash-screen registration.** `TrashScreen` is a creatures-only MVP; Ships is not in it either.
- **Campaign-delete cascade.** `campaignRepository.softDelete` does not cascade to ships or containers; these tables match that.
- **Refactoring `CampaignHeader` nav into config.** A known wart, deliberately not addressed here.
- **Per-character wealth integration.** The ledger never reads or writes `character.wealth`.
- **Route-stop and ledger-entry entity links** to notes or sessions. Natural future work; no FK blocks it.

## Constraints

### Musts

- Snapshot the split onto every distribution; nothing may retroactively change a past payout.
- Derive the running balance; never persist it.
- Assert I1 and I2 in code, not by inspection.
- Add `routePlanner` to `schemas/system.schema.ts` in the same change as the type.
- Route every read through `excludeDeleted`; every UI delete through `softDelete`.
- Bump `src/systems/traveller/system.json`'s `version` when editing it.
- Land schema changes in a new `version(15)` block.

### Must-Nots

- No `systemId ===` branch anywhere outside `baseEngineFor`.
- No edit to any existing Dexie `version()` block.
- No change to an existing `CurrencyModel` signature — additive only.
- No `hardDelete` call from any UI path.
- No `sheet.json` version bump — the sheet layout is untouched.
- No push to any remote.

### Preferences

- Match `shipRepository.ts` and `renderSession.ts` over a cleaner fresh design.
- Prefer a declarative field on the system contract over an engine branch.
- Prefer additive optional members over restructuring an existing contract.
- Prefer up/down reorder controls over drag, for stylus reliability.

### Escalation Triggers

- An existing `CurrencyModel` signature would need to change.
- I1 or I2 cannot be satisfied for some input.
- A Dexie upgrade callback appears necessary.
- A `systemId ===` branch starts to look unavoidable outside `baseEngineFor`.

## Verification

1. `npm test` — 763+ passing, including the new `ledgerMath`, `routeMath`, `renderLedger` and currency-format suites.
2. `npm run build` — clean; this is the only type-check.
3. `npx vitest run src/features/systems/declaredCapabilities.test.ts` — passes with no new allowlist entry.
4. `npx vitest run src/features/systems/engine/engineContract.test.ts` and `systemDefinitionSchema.test.ts` — pass.
5. Live browser run per SS-10's two `[INTEGRATION]` criteria, against a seeded Traveller campaign and the real `Milo Aer.skaldbok.json` character.
6. Mutation check on the three load-bearing behaviours, with failing test names recorded.
7. `docs/decisions.md` entries written and free of `<FILL-IN>`.

## Phase Specs

Refined by `/forge-prep` on 2026-08-08.

| Sub-Spec | Phase Spec |
|---|---|
| 1. Character-free currency formatting | `docs/specs/campaign-ledger-and-route-planner/sub-spec-1-currency-formatting.md` |
| 2. Domain types and Dexie version 15 | `docs/specs/campaign-ledger-and-route-planner/sub-spec-2-domain-types-and-v15.md` |
| 3. Ledger arithmetic | `docs/specs/campaign-ledger-and-route-planner/sub-spec-3-ledger-math.md` |
| 4. Ledger repositories | `docs/specs/campaign-ledger-and-route-planner/sub-spec-4-ledger-repositories.md` |
| 5. `routePlanner` declaration | `docs/specs/campaign-ledger-and-route-planner/sub-spec-5-route-planner-declaration.md` |
| 6. Route arithmetic and repository | `docs/specs/campaign-ledger-and-route-planner/sub-spec-6-route-math-and-repository.md` |
| 7. Ledger screen, split editor, Distribute | `docs/specs/campaign-ledger-and-route-planner/sub-spec-7-ledger-ui.md` |
| 8. Route screen with gated nav | `docs/specs/campaign-ledger-and-route-planner/sub-spec-8-route-ui.md` |
| 9. Markdown export, wired to both screens | `docs/specs/campaign-ledger-and-route-planner/sub-spec-9-export.md` |
| 10. End-to-end verification and decisions | `docs/specs/campaign-ledger-and-route-planner/sub-spec-10-verification.md` |

Index: `docs/specs/campaign-ledger-and-route-planner/index.md`
Contracts: `docs/specs/campaign-ledger-and-route-planner/contracts.json`
