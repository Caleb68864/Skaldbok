---
type: converge-pass
run: 2026-08-09-campaign-ledger-and-route-planner
pass: 4
mode: standard
gaps_found: 1
gaps_fixed: 1
frozen: 1
---

# Pass 4 — standard scan (whole spec)

**Clean streak entering pass:** 0 → **reset to 0** (a gap was found)
**Tree check:** the scanner ran `git status --short` first and confirmed it was
clean before reading anything — the guard added after pass 3's concurrency error.
**`npm test` permitted this pass** so Verification step 1 could be executed by the
scanner rather than taken on trust.

## Gap

**The evidence file contradicted the code — and contradicted itself.**

`docs/specs/ss10-ledger-route-integration-evidence.md` claimed that under
Dragonbane, `/route` *"says 'Dragonbane does not use a route planner.'"* That
string exists nowhere in `src/`. The shipped behaviour is
`<Navigate to="/session" replace />` (`RouteScreen.tsx:53`), which is what the
browser check actually confirmed and what SS-08's Decisions block requires.

The cause is mine and worth naming: pass 3 corrected this file's **gate table**
(the stale 819/50 test counts) and left the **System gating section** describing
the pre-convergence error-page behaviour. Half-correcting a document is worse
than not touching it — the file now asserted two incompatible things about the
same screen, and the wrong half was the one a reader would quote.

**Fixed:** the section now records the redirect, with a dated correction note
explaining what changed and why, rather than silently overwriting the history.
The labels assertion was also strengthened to the actual observed values
(`['Name','UWP','Hex','Jump','Notes']`).

## Methodological finding — a criterion that could have passed on an empty diff

The scanner found that **`git diff Production` is not a usable baseline for this
work**. `Production` (768410b) already carries the entire feature, so diffing
against it returns empty for `client.ts` and `system.json` — not because nothing
changed, but because the change is already in the baseline.

SS-05 c4 (traveller `system.json` version strictly greater than HEAD) and SS-02
c1 (v14 byte-identical) are both phrased as diffs. Scored naively against
`Production`, **an empty diff reads as a pass**. The scanner used `git log -S` to
recover the true pre-feature values instead and confirmed the bump is real
(15 → 16 → 17), so the scores stand — but they stand on different evidence than
the criteria's wording implies.

This is the same failure shape as pass 3's SS-04 c2 finding and pass 1's
`grep -c … returns 0` findings: **a check that passes because the command found
nothing to look at.** Three separate instances now, across four passes.

## Observation — thinnest-covered module

`ledgerRepository.ts` is the only one of the three new repositories without a
dedicated test file; `ledgerSplitRepository.test.ts` and
`routeRepository.test.ts` both exist. No SS-04 criterion requires one, and its
behaviour is exercised through SS-10's executed browser run, so this is **not
scored as a gap** and has not been silently fixed.

It is worth a human decision, because of what that module holds: it is the
repository that writes the money. Recommended as a follow-up alongside the
`yamlValue` extraction.

## Verification run this pass (all executed by the scanner)

| Command | Result |
|---|---|
| `git status --short` (pre-flight) | clean |
| `npm test` | **854 passed / 53 files** — Verification step 1 discharged |
| `npm run build` | exit 0 |
| `declaredCapabilities` / `engineContract` / `systemDefinitionSchema` | exit 0 |
| `currencyFormat` / `ledgerMath` / `routeMath` | exit 0 |
| `renderLedger` / `ledgerSplitRepository` / `routeRepository` | exit 0 |
| All `! grep -rq …` guards | exit 0 |
| `grep -c "<FILL-IN>" docs/decisions.md` | 0 |

Every one of the 14 Requirements, all SS-01..SS-10 criteria, all 14 Edge Cases,
all Musts/Must-Nots, and all 7 Verification steps scored **Met**, except the one
gap above and the frozen `[HUMAN REVIEW]` item.

## Not fully verifiable

**SS-07 c8** names a specific method — "force by stubbing the helper in a scratch
run, then restore". A read-only scanner cannot mutate the tree, so it verified by
control-flow proof instead: `onConfirm` (`DistributeModal.tsx:88`) is unreachable
unless `computeDistribution` (`:87`) returns, and the `catch` (`:98-107`) toasts
without writing. The proof is sound; the stub run itself was not re-executed this
pass. Recorded rather than claimed as executed.

## Result

**1 gap → 1 fixed.** 1 frozen, unchanged. `clean_streak = 0`. Proceeding to
pass 5.
