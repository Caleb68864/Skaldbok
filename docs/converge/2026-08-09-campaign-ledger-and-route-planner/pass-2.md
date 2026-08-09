---
type: converge-pass
run: 2026-08-09-campaign-ledger-and-route-planner
pass: 2
mode: standard
gaps_found: 3
gaps_fixed: 3
frozen: 1
---

# Pass 2 — standard scan

**Clean streak entering pass:** 0 → **reset to 0** (gaps found)
**Scanners:** two, split ledger-core / engine-and-route, both told what changed
in pass 1 and asked to confirm the redirect race cannot recur.

## Gaps

| # | Gap | Score | Outcome |
|---|---|---|---|
| 1 | **SS-05 c3 — `routePlanner` survival through Zod is not pinned by any test** | Not Met | **Fixed** |
| 2 | SS-08 c5 — five labelled inputs per stop, unverified (no render test) | Partial | **Fixed** — browser assertion |
| 3 | SS-09 `[INTEGRATION]` — export controls produce a blob, unverified | Partial | **Fixed** — browser, both halves |

### Gap 1 is the significant one

The criterion reads: *"Parsing the Traveller definition through
`systemDefinitionSchema` returns a result whose `routePlanner.fields` has length
5 — proving Zod does not strip the new key."*

The scanner found `routePlanner` in **zero** test files.
`systemDefinitionSchema.test.ts` asserted only `safeParse().success` and never
inspected `result.data`. So removing the Zod entry would have left the entire
suite green while silently stripping `routePlanner` from every **imported**
system — bundled Traveller reads straight off the module and would have kept
working, so the failure would only ever appear for someone else's JSON.

That is precisely the trap `CLAUDE.md` documents, precisely why the criterion
was written, and it was never implemented. The file already contained a sibling
test — *"preserves groupId and skillGroups through the parse"* — written for the
identical failure. The pattern existed and was not followed.

**Fix:** two tests. `preserves routePlanner and every declared field through the
parse` pins the five field ids, non-empty labels, and that `distanceFieldId`
names a field that exists (otherwise the total silently reads 0 for every stop).
`does not invent a routePlanner for a system that declares none` pins the
absence that gates the feature off.

**Mutation check:** deleting the `routePlanner` entry from
`schemas/system.schema.ts` no longer merely fails an assertion — the suite
becomes *uncollectable*, because `result.data.routePlanner` stops type-checking.
The guard is now compile-time, which is stronger than the criterion asked for.
Restored; 854 tests green.

### Gaps 2 and 3

Both were unverifiable by the scanners rather than suspected-broken: they are
read-only and cannot drive a browser. Discharged by execution in this pass:

- Five labelled inputs: asserted directly against the rendered DOM. The labels
  are `['Name','UWP','Hex','Jump','Notes']` — the system's own words, none of
  them present in the screen's source.
- Export blobs: both halves. The ledger half was already covered; the **route
  half had never been clicked in any run** — found while discharging this, not
  reported by a scanner. Now covered by a dedicated check that captures the blob
  and asserts the frontmatter, the declaration-driven columns, route ordering,
  and that free-text notes are pulled out of the table.

## Verification run this pass

| Command | Result |
|---|---|
| `npm run build` | exit 0 |
| `npm test` | **854 passed / 53 files** (was 852) |
| `npx vitest run …/systemDefinitionSchema.test.ts` | 15 passed |
| Browser: ledger + route + gating | **34/34** (was 31) |
| Browser: session-log + ledger export | **15/15** |
| Browser: route export | **7/7** (new) |

## Observations carried forward, not scored

**`useSystemDefinition` does not reset `system` to `null` when `systemId`
changes.** Switching campaigns while sitting on `/route` briefly renders the
previous system's planner before the new definition resolves. Pre-existing, in a
shared hook, and not the failure the spec names — nobody is bounced off their own
route — but it is the same class of async-guard defect as the two already found
in this feature. Recorded for a human decision rather than fixed, since the hook
is used by every system-aware screen.

**`generateEntityFilename` signature drift.** SS-09's Decisions block commits to
`{ title, date }`; the shipped signature is `{ title, suffix, fallback? }`. The
acceptance criterion only requires both exports with the original `generateFilename`
signature untouched, which holds — so this is spec-vs-code drift in a committed
default, not a failed criterion. The spec is the stale half.

## Result

**3 gaps → 3 fixed.** 1 frozen (`[HUMAN REVIEW]` tablet readability), unchanged.
`clean_streak = 0`. Proceeding to pass 3.
