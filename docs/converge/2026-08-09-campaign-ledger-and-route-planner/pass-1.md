---
type: converge-pass
run: 2026-08-09-campaign-ledger-and-route-planner
pass: 1
mode: standard
gaps_found: 15
gaps_fixed: 12
frozen: 1
accepted: 2
---

# Pass 1 — standard scan

**Reference:** `docs/specs/2026-08-08-campaign-ledger-and-route-planner.md`
**Base:** `Production` (work already merged; the change slice is empty by design —
this scan is spec-vs-codebase)
**Branch:** `2026/08/09-0530-caleb-converge-ledger-spec`
**Clean streak entering pass:** 0 → **reset to 0** (gaps found)

## Scope split

| Scanner | Slice | Verdict |
|---|---|---|
| A | R1–R7, SS-02 / SS-03 / SS-04 | 1 gap |
| B | R8–R11, SS-01 / SS-05 / SS-06 / SS-08 | 6 gaps |
| C | R12–R14, SS-07 / SS-09, all Constraints, all Edge Cases | 8 gaps |

## Suppression set

From `## Out of Scope`: double-entry/`accountId`; separate ship-fund balance;
ship-shares calculator; jump maps / world generation / UWP validation;
Trash-screen registration; campaign-delete cascade; `CampaignHeader` nav config
refactor; per-character wealth integration; route-stop/ledger-entry
**entityLinks**. No sibling `*-gap-report.md` exists.

### Accepted deviations (recorded, not fixed)

**1. Ledger → session-log mirroring and ledger-in-session-export.** The spec
lists entity links to sessions as out of scope. What shipped is not an
`entityLink`: each movement writes a `log` **note** carrying
`typeData.ledgerEntryId`, and both session export paths carry the cashbook.
Requested by the user after the spec was written — sanctioned expansion, not
creep. The spec has not been amended to describe it; that divergence is real and
is on the record here.

**2. `Must-Not: push to any remote` — violated, by explicit instruction.**
Scanner C correctly flagged that all four feature commits are on
`origin/Production`. The constraint was written before the user said "push to
prod". A later explicit instruction overrides a spec constraint; the push was
authorised, is not reversible, and is not a defect. Recorded so the violation is
visible rather than silently suppressed.

## Gaps found and what happened

| # | Gap | Source | Outcome |
|---|---|---|---|
| 1 | SS-04 AC1 `getOrCreateForCampaign` idempotency asserted only by reading | A | **Fixed** — `ledgerSplitRepository.test.ts`, 8 tests, mutation-checked |
| 2 | **SS-09 `renderLedger.test.ts` does not exist** — declared in `Files (new)`, never written | C | **Fixed** — 14 tests |
| 3 | SS-08 C3 `! grep -rqi "uwp\|parsec"` fails on the screen's own doc comment | B | **Fixed** — comment reworded; criterion now exits 0 |
| 4 | `src/features/route/useRoute.ts` absent; logic inlined in the screen | B | **Fixed** — extracted |
| 5 | SS-08 C4 vacuous — grep exits 2 because `src/features/route` did not exist | B | **Fixed** by (4); both paths now exist and the criterion genuinely passes |
| 6 | R9 / Edge — `/route` rendered a "Not available" panel; SS-08 Decisions mandate a **redirect** and forbid an error page | B, C | **Fixed** — `<Navigate to="/session" replace />` |
| 7 | SS-07 + Edge — invariant throw surfaced as inline text, spec says **toast** | C | **Fixed** — `showToast(message, 'error')`; recomputes on the write path so the throw is reachable |
| 8 | SS-08 B3 reorder persistence unverified — no repository test | B | **Fixed** — `routeRepository.test.ts`, 11 tests |
| 9 | Preference — `yamlValue` not reused; hand-rolled escaping weaker than the house helper | C | **Fixed** — helper adopted in both renderers; also fixes newline handling |
| 10 | SS-08 B1 five labelled inputs — unverified | B | **Fixed** — browser run, 31/31 |
| 11 | SS-08 B2 Dragonbane gating — unverified | B | **Fixed** — browser run asserts the redirect lands on `/session` |
| 12 | SS-09 `[INTEGRATION]` export controls produce a blob — unverified | C | **Fixed** — browser run |
| 13 | SS-07 `[HUMAN REVIEW]` tablet readability | C | **Frozen** — needs a human on a device; excluded from the streak |
| 14 | Accepted deviation 1 (session-log mirroring) | — | Suppressed |
| 15 | Accepted deviation 2 (remote push) | — | Suppressed |

## Regression found and fixed inside this pass

Fixing gap 6 introduced a new bug the browser caught immediately: the redirect
was gated on `route.isLoading`, which tracks the **stops** query, not the system
definition. Those race and stops win — so the redirect fired while `planner` was
still `undefined` and bounced Traveller users off their own route screen. The
unit suite could not see it; only execution did.

Fixed by exposing `systemResolved` from `useRoute` and gating on that. This is
the second time in this feature that a guard keyed on the wrong async source
(the first being `useSystemEngine` vs `useSystemDefinition` for a campaign).

## Verification run this pass

| Command | Result |
|---|---|
| `npm run build` | exit 0 |
| `npm test` | **852 passed / 53 files** (was 819 / 50) |
| `npx vitest run src/utils/export/renderLedger.test.ts` | 14 passed |
| `npx vitest run src/storage/repositories/ledgerSplitRepository.test.ts` | 8 passed |
| `npx vitest run src/storage/repositories/routeRepository.test.ts` | 11 passed |
| `! grep -rqi "uwp\|parsec" src/screens/RouteScreen.tsx src/features/route` | exit 0 |
| `! grep -rq "parseFloat\|parseInt\|Number(" src/features/route src/screens/RouteScreen.tsx` | exit 0 (both paths exist) |
| `grep -rq "routePlanner" src/screens src/features/route src/components/shell` | exit 0 |
| Browser: ledger + route + gating | **31/31** |
| Browser: session-log mirroring + export | **15/15** |

Mutation check on the new repository test: inverting `getOrCreateForCampaign` to
newest-wins-without-collapse fails *"collapses pre-existing duplicates to the
oldest and soft-deletes the rest"*. Restored.

## Escalated, not silently fixed

**`yamlValue` is privately duplicated in five renderers** — `renderSession`,
`renderNote`, `renderCampaignIndex`, `renderAttachmentSidecar`, and now
`renderLedger`/`renderRoute` make six copies. Extracting it into one module
would touch four files outside this gap's implicated set, which is a scope
expansion this loop is not permitted to make silently. Recommended as a
follow-up.

## Result

**15 gaps → 12 fixed, 1 frozen, 2 accepted.** `clean_streak = 0`. Proceeding to
pass 2.
