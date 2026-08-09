---
type: converge-pass
run: 2026-08-09-campaign-ledger-and-route-planner
pass: 5
mode: standard
gaps_found: 1
gaps_fixed: 1
frozen: 1
---

# Pass 5 — standard scan (whole spec + document audit)

**Clean streak entering pass:** 0 → **reset to 0** (a gap was found)
**Pre-flight:** tree clean before the scan began.
**Baseline rule enforced:** the scanner was barred from `git diff Production` and
required to recover pre-feature values with `git log -S` / `git show <commit>^`.

**Every `[MECHANICAL]` criterion was executed this pass. The code scored Met on
all 14 Requirements, all SS-01..SS-10 criteria, all Constraints, all Edge Cases
and all 7 Verification steps.** The only gap was in a document.

## Gap

**The evidence file's "Not exercised" section described a bug that had already
been fixed.**

It claimed *"the `QuickLogBar` path still logs title-only… it has not been
touched or tested."* Commit `768410b` changed that call to
`logToSession(title, 'log', {}, { body: title })` and the fix was browser-verified.

This is the **second** stale claim found in this one file, and it sat in the same
region pass 4 edited. Pass 4 corrected the *gating* section and did not re-read
the rest — exactly the half-correction habit pass 4 itself criticised. The fix
this time was to read the file end to end and re-verify **every** factual claim
against the tree, not just the flagged line:

| Claim | Verified |
|---|---|
| QuickLogBar logs `'log'` with a body | `QuickLogBar.tsx:50` |
| `-0` net normalised | `ledgerMath.ts:167` |
| `Fragment key` in the ledger table | `LedgerScreen.tsx:132` |
| `body?` on `LogToSessionOptions` | `useSessionLog.ts:57` |
| Session ZIP ships `ledger.md` | `useExportActions.ts:239` |
| Three named mutation tests exist | 3 matches in `ledgerMath.test.ts` |

The stale note was replaced with a dated correction rather than deleted, and the
section gained the `ledgerRepository.ts` coverage gap so the "what still needs
attention" list is actually current.

## Why an out-of-date limitation note is worse than none

A "Not exercised" list is where a reader looks to decide what still needs work.
A stale entry there does two kinds of damage: it sends someone to fix something
already fixed, and it quietly devalues every other item in the list. Once one
line is known to be wrong, none of them can be trusted without re-derivation —
which is the whole cost the document existed to save.

## Chronological log vs current-state document

Two further stale statements were found in `docs/decisions.md`
(`:2479-2482` "QuickLogBar still logs title-only"; `:2367` "`baseDenominationId`
has no consumer yet"). **Both were deliberately left alone.**

`decisions.md` is a dated, append-only log — each entry records what was true and
why at the time it was written, and the later 2026-08-09 entries explicitly
supersede both statements. Rewriting past entries to match present reality would
destroy exactly the record the file exists to keep.

`ss10-…-evidence.md` is the opposite: a current-state document, read as an
assertion about the tree as it stands. It has no dated-entry structure to
supersede anything, so a false sentence in it is simply false. That difference is
why one was corrected and the other was not.

## Scanner self-correction worth recording

The scanner reported that its **first** verification loop was reading `grep`'s
exit status rather than `vitest`'s, and that it re-ran all seven suites with true
exit-code capture after noticing. That is the same "passes because the command
found nothing to look at" trap this run has now hit four times — and the first
time a scanner caught it in its own method rather than in the spec.

## Verification run this pass

| Command | Result |
|---|---|
| `git status --short` (pre-flight) | clean |
| `npm test` | **854 passed / 53 files** |
| `npm run build` | exit 0 |
| `declaredCapabilities` / `engineContract` / `systemDefinitionSchema` | exit 0 |
| `currencyFormat` / `ledgerMath` / `routeMath` / `renderLedger` | exit 0 |
| All `! grep -rq …` guards | exit 0 |
| `git show 7d03d6c^:…/system.json` | pre-feature version **15**, now **17** |
| `grep -c "<FILL-IN>" docs/decisions.md` | 0 |

## Result

**1 gap → 1 fixed.** 1 frozen (`[HUMAN REVIEW]`), unchanged. `clean_streak = 0`.
Proceeding to pass 6.
