---
type: converge-pass
run: 2026-08-09-campaign-ledger-and-route-planner
pass: 3
mode: standard
gaps_found: 1
gaps_fixed: 1
frozen: 1
---

# Pass 3 — standard scan (whole spec, single scanner)

**Clean streak entering pass:** 0 → **reset to 0** (a gap was found)
**Scope:** all 14 requirements, every criterion in SS-01..SS-10, all Constraints,
all Edge Cases, and the 7 numbered `## Verification` steps. Prompted
specifically to hunt for criteria that pass **for the wrong reason**.

## Gap

**SS-10 c7 — the required Watch line was never written, and the code already
cites it.**

The criterion requires `docs/decisions.md` to carry Watch lines on three topics.
The signed-amount divergence from the debts feature's `direction` field was
present. The unfiltered-export line was absent.

> **Corrected in pass 6.** This report originally claimed *two* of the three
> topics were already present, counting the gross-vs-amount rationale. That
> rationale existed, but under a `Fix:` bullet — **not as a `Watch:` line**,
> which is what the criterion asks for. SS-10 c7 was therefore still `Partial`
> after this pass, not `Met`. A proper Watch line was added in pass 6.

That alone is a documentation gap. What makes it worth the pass is that
`useExportActions.ts:441-443` already contains:

> *"Deliberately not privacy-filtered… See `docs/decisions.md`, 2026-08-08."*

So the code carried a **dangling reference to a decision that did not exist** —
pointing a future reader at a rationale they would not find, for a path whose
sibling note-export code was once accidentally unfiltered and fixed. SS-09's
Decisions block ordered it recorded specifically "so the next reader does not
re-litigate it", and that is precisely what would have happened.

**Fixed:** a Watch bullet on the 2026-08-08 export entry stating the two cases
are different — notes carry a private flag, a crew cashbook and a jump route do
not — and noting that the code points here by date.

## Verification step 1 discharged

The scanner could not run bare repo-wide `npm test` (prohibited by its rules, to
keep passes fast and the tree clean), so it scored SS-10 c1 / Verification step 1
`Partial (unverified)` and correctly declined to take the evidence file's word
for it. Run directly: **854 passed / 53 files**, comfortably over the 763 floor.

The evidence file's gate table still claimed 819/50 and has been corrected with
a dated note rather than silently overwritten.

## Two criteria that pass for the wrong reason

The scanner was asked to hunt for these and found one, plus corroborated a
process error of mine.

**1. SS-04 c2 is a weak gate.** The criterion is
`grep -c "excludeDeleted" ledgerRepository.ts` ≥ the number of read functions. It
returns 2 and there are 2 read functions, so it passes — but **one of the two
matches is the `import` on line 3**. `getById` never calls `excludeDeleted`; it
inlines `if (!options?.includeDeleted && row.deletedAt) return undefined`.

The behaviour is correct — `excludeDeleted` is an array helper and cannot apply
to a single row — and the same shape holds in the other two repositories. But
the criterion would pass a file whose only "use" was the import. Recorded as a
weak criterion, not a defect; rewriting it is a spec change, not a code fix.

**2. A mutation was live in the working tree while the scanner was scanning.**
My own doing: I re-ran the three SS-10 mutation checks against the shared tree at
the same time as pass 3's scan. The scanner observed `ledgerMath.test.ts` failing
with `Distribution lost money: legs total -1, gross is 3` and ` M
src/utils/ledgerMath.ts` in `git status`, correctly identified it as the
inverted-residual-fold mutation, and reported it rather than filing a phantom
gap.

That is a process error worth recording: **mutation checks must not run
concurrently with a scan of the same working tree.** It self-corrected here
because the restore landed and the scanner was careful, but it could as easily
have produced a false gap and burned a pass — or, worse, a false *clean*.

## Verification run this pass

| Command | Result |
|---|---|
| `npm test` | **854 passed / 53 files** |
| `npm run build` | exit 0 |
| `npx vitest run …/declaredCapabilities.test.ts` | 101 passed |
| `npx vitest run …/engineContract.test.ts` | 82 passed |
| `npx vitest run …/systemDefinitionSchema.test.ts` | 15 passed |
| `npx vitest run …/currencyFormat.test.ts` | 10 passed |
| `npx vitest run src/utils/ledgerMath.test.ts` | 24 passed *(corrected in pass 6 — originally recorded as 32, a scanner's figure copied without checking; the file has 24 tests and has not changed since 83b981b)* |
| `npx vitest run src/utils/routeMath.test.ts` | 19 passed |
| `npx vitest run …/renderLedger.test.ts` | 14 passed |
| `npx vitest run …/ledgerSplitRepository.test.ts` | 8 passed |
| `npx vitest run …/routeRepository.test.ts` | 11 passed |
| Mutation checks ×3 | each caught, each restored, tree verified clean |
| `grep -c "<FILL-IN>" docs/decisions.md` | 0 |

## Result

**1 gap → 1 fixed.** 1 frozen (`[HUMAN REVIEW]`), unchanged. `clean_streak = 0`.
Proceeding to pass 4.
