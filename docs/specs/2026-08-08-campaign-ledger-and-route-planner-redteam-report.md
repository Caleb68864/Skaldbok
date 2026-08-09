---
type: redteam-report
generated: 2026-08-08
target: docs/specs/2026-08-08-campaign-ledger-and-route-planner.md
findings_count: 11
critical: 5
advisory: 6
applied: 11
skipped: 0
---

# Red Team Review: 2026-08-08-campaign-ledger-and-route-planner.md

10 sub-specs, 46 acceptance criteria at review time. All 9 roles run. Every
finding below was verified against the codebase before being raised — none are
speculative.

## CRITICAL Findings (5)

### C-1: `baseDenominationId` declared with no reader
- **Role:** Developer Implementer / Integration Architect
- **Location:** SS-01
- **Issue:** `declaredCapabilities.test.ts` scans `src/features/systems/engine/types.ts`
  for two-space-indented interface properties and requires a `.field` / `['field']`
  read somewhere in `src` outside tests. `formatAmount` is read by SS-07 and SS-09.
  **Nothing read `baseDenominationId`** — `formatAmount` hides the denomination
  internally. This is the same defect shape the test was written for, which the
  repo has hit five times.
- **Evidence:** Read `src/features/systems/declaredCapabilities.test.ts` lines 1–60;
  confirmed `DECLARATION_FILES` includes `engine/types.ts` and that the corpus is
  all of `src` except tests.
- **Fix applied:** SS-07's amount input is now labelled with the `abbr` of the
  denomination named by `baseDenominationId`, making it a genuine reader. Added a
  `[MECHANICAL]` grep proof to SS-07 and a `declaredCapabilities` gate to SS-01, so
  the failure surfaces in SS-01/SS-07 rather than eight sub-specs later in SS-10.

### C-2: SS-07 and SS-08 modify the same two files concurrently
- **Role:** Integration Architect
- **Location:** SS-07 / SS-08 `Files (modify)` and frontmatter
- **Issue:** Both edit `src/routes/index.tsx` and
  `src/components/shell/CampaignHeader.tsx`. Their `depends_on` sets were disjoint
  (`['SS-01','SS-03','SS-04']` vs `['SS-05','SS-06']`), so the factory would
  schedule them in parallel. Under worktree isolation that is a guaranteed
  collision on both files.
- **Fix applied:** `SS-07` added to SS-08's `depends_on`, with the reason recorded
  in SS-08's Decisions block so a future editor does not "optimise" it back out.

### C-3: Export actions orphaned — nothing calls them
- **Role:** Integration Architect / Product
- **Location:** SS-09
- **Issue:** SS-09 added two actions to `useExportActions` and depended only on
  SS-03/04/06. No sub-spec modified either screen to add an export control. The
  actions would ship dead and Requirement 12 would be half-met — the classic
  construction-site-without-caller shape.
- **Fix applied:** Both screens added to SS-09's `Files (modify)`; `SS-07` and
  `SS-08` added to its `depends_on`; a new `[INTEGRATION]` criterion requires both
  controls to be exercised in a live browser and states explicitly that neither
  action is orphaned.

### C-4: `grep -c … returns 0` criteria exit 1 and read as failures
- **Role:** QA Tester
- **Location:** SS-06, SS-07 (×2), SS-08
- **Issue:** `grep -c` with no match prints `0` and **exits 1**. Verified directly.
  A verifier keying on exit status marks a correct codebase as failing — and the
  apparent remedy is to *add* the forbidden pattern, which is the worst possible
  false negative.
- **Fix applied:** All four rewritten to `! grep -rq "pattern" <paths>`, which
  exits 0 on absence. Positive-presence checks rewritten to `grep -rq`.

### C-5: SS-06 carried a criterion greping files SS-08 creates
- **Role:** QA Tester / Developer Implementer
- **Location:** SS-06, final criterion (its own text said "once SS-08 lands")
- **Issue:** A worker executing SS-06 cannot satisfy it; the paths do not exist and
  `grep` exits 2.
- **Fix applied:** Relocated verbatim into SS-08 with a note recording the move.
  SS-06 gained an empty-and-single-item `reorder` criterion in its place.

## ADVISORY Findings (6)

### A-1: `computeDistribution` throws with no stated catcher
- **Role:** End User / SRE
- SS-03 correctly throws on an invariant breach, but nothing said who catches it.
  An unhandled throw in a React event handler is a white screen mid-session.
- **Fix applied:** SS-07's Decisions block commits the modal to catching, toasting
  and writing nothing, with a `[BEHAVIORAL]` criterion.

### A-2: Ledger export bypasses the privacy filter
- **Role:** Security Auditor
- `useExportActions.ts:131,189` apply `excludePrivateNotes`, and a comment there
  records that those paths were **once unfiltered by mistake**. The ledger export
  reintroduces an unfiltered path.
- **Resolution:** Author decided no filtering — a campaign cashbook is shared crew
  data by definition and entries carry no private flag; adding one is scope creep.
  Recorded as a deliberate decision in SS-09's Decisions block and required in the
  `docs/decisions.md` entry under SS-10, so it cannot later be misread as an
  oversight.

### A-3: `gross ≤ 0` undefined
- **Role:** QA Tester
- **Fix applied:** SS-03 throws on a non-positive gross (criterion added); SS-07
  keeps Distribute disabled with a visible reason (criterion added).

### A-4: "Distribution exceeds balance" had no acceptance criterion
- **Role:** QA Tester
- Present in Edge Cases, verified nowhere.
- **Fix applied:** `[BEHAVIORAL]` criterion in SS-07 — the entry is written, the
  warning shows, the balance goes negative.

### A-5: SS-07 is the oversized sub-spec
- **Role:** Scope Realist
- 5 new files: a screen, two modals, two hooks. Matches the shape that
  historically gets deferred. Not raised to CRITICAL because `/forge-prep` runs
  next and exists precisely to decompose it — flagged there for attention.

### A-6: `getOrCreateForCampaign` create race
- **Role:** Data / Migration Steward
- Two concurrent first reads could write two split rows. Unlikely on a
  single-device local-first app, cheap to prevent.
- **Fix applied:** The method now returns the oldest row by `createdAt` and
  soft-deletes duplicates; idempotency criterion added to SS-04.

## Role Scorecards

Developer 2 | QA 4 | End User 1 | Architect 3 | Scope Realist 1 | Security 1 | SRE 1 | Data 1 | Product 0

Product raised nothing: outcome, purpose and success metric are all concretely
stated and traceable to the live-session feedback that prompted the work.

## Post-patch validation

`forge-factory validate-spec-paths --require-tracked` re-run after all edits:
10 sub-specs, 39 files, exit 0. Two advisories
(`SS-09 modify: LedgerScreen.tsx`, `RouteScreen.tsx`) classified
`modify-target-deferred` — correct, because the C-3 fix added the dependency edges
that make those files exist before SS-09 runs.
