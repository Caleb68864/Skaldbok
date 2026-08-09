---
type: converge-pass
run: 2026-08-09-campaign-ledger-and-route-planner
pass: 6
mode: standard
gaps_found: 2
gaps_fixed: 2
frozen: 1
---

# Pass 6 — standard scan (spec + this run's own reports)

**Clean streak entering pass:** 0 → **reset to 0** (gaps found)
**Pre-flight:** tree clean.
**New scope this pass:** the scanner was asked to audit the convergence run's
*own* `pass-*.md` files for claims untrue of the current tree.

**The code again scored Met on everything.** Both gaps were in documents, and
both were in **this run's own pass-3 report**.

## Gap 1 — SS-10 c7 was recorded as Met and was actually Partial

The criterion requires `docs/decisions.md` to carry **Watch lines** on three
topics. Pass 3 closed it by adding the unfiltered-export line and recorded the
other two as already present.

One of those two was not present *as a Watch line*. The gross-vs-amount
rationale existed under a `Fix:` bullet (`decisions.md:2385-2391`). No `Watch:`
line in the file mentioned `gross` at all.

So SS-10 c7 remained **Partial** for three passes while being reported as Met —
and it was reported as Met by *me*, in the pass that claimed to have fixed it.
Passes 4 and 5 then re-scored it Met on the strength of that report rather than
re-deriving it.

**Fixed:** a real Watch line, and one worth having rather than a box-tick — it
states that summing `gross` re-creates the original balance bug exactly, that a
leg-based total is wrong for the same reason, and that if a future change ever
makes `gross` and `amount` equal for a distribution, *that* is the regression.

## Gap 2 — a test count in pass-3.md was fabricated by copying

`pass-3.md` recorded `npx vitest run src/utils/ledgerMath.test.ts | 32 passed`.
The file has **24** tests and, per `git log`, has not changed since `83b981b` —
so it had 24 when pass 3 ran too.

The number came from the pass-3 scanner's report, and I transcribed it into my
own table without running the command. Every other count in that table
(101/82/15/10/19/14/8/11) is exact, which is precisely why the wrong one was
invisible.

**Fixed:** corrected in place with a note recording what it was and why it was
wrong, rather than silently overwritten.

## What these two have in common

Both are the same failure as the code gaps this run started with: **a claim
accepted without executing the thing that would confirm it.** Pass 3 asserted a
Watch line existed without grepping for `Watch`. I asserted a test count without
running the test. In both cases the assertion was plausible, adjacent to
something true, and wrong.

This run has now hit that shape five times — `grep -c … returns 0` exiting 1 on
success; `grep -c excludeDeleted` satisfied by an import; `git diff Production`
empty because the baseline contains the feature; a scanner reading `grep`'s exit
status instead of `vitest`'s; and now twice in my own reporting.

## Also fixed (minor, surfaced not scored)

`ledgerMath.ts:164` said "`|| 0` normalises negative zero" while the code uses a
ternary. Behaviour correct, comment stale — corrected, because a comment that
describes code that isn't there is the same defect class this whole run is about.

## Recorded, not fixed

`DistributeModal.handleConfirm` never resets `isSaving` on the success path. It
is harmless only because the modal unmounts immediately afterwards. If it ever
stays mounted — a "record another" flow, say — the button stays disabled. Real
latent bug, no criterion covers it, so it is not being folded into a convergence
loop.

## Verification run this pass

| Command | Result |
|---|---|
| `git status --short` (pre-flight) | clean |
| `npm test` | **854 passed / 53 files** |
| `npm run build` | exit 0 |
| All named suites (declaredCapabilities, engineContract, systemDefinitionSchema, currencyFormat, ledgerMath, routeMath, renderLedger, ledgerSplitRepository, routeRepository) | exit 0 |
| All `! grep -rq …` guards | exit 0 |
| `git diff 2d11b87^ HEAD -- client.ts` | 17 insertions, **0 deletions** (v14 untouched) |
| Three `Watch:` topics present in `decisions.md` | 3/3 |
| `grep -c "<FILL-IN>"` | 0 |

Evidence-file spot-check (3 of 3) held — pass 5's audit stands.
All other `pass-*.md` factual claims verified true.

## Result

**2 gaps → 2 fixed.** 1 frozen, unchanged. `clean_streak = 0`.

**Note on continuing:** six passes, 23 gaps, and the streak has never reached 1.
The code has been fully compliant since pass 4; passes 3–6 found only documents
misdescribing it, and three of those four were caused by fixing the previous one
incompletely. Pass 7 proceeds, but if it too returns only prose gaps, the loop
should be stopped and reported rather than spending the remaining budget
policing its own paperwork.
