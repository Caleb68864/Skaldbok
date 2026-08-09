---
type: phase-spec-index
master_spec: "docs/specs/2026-08-08-campaign-ledger-and-route-planner.md"
date: 2026-08-08
sub_specs: 10
---

# Campaign Ledger and Route Planner — Phase Specs

Refined from [2026-08-08-campaign-ledger-and-route-planner.md](../2026-08-08-campaign-ledger-and-route-planner.md),
after an 11-finding red-team pass (report:
[…-redteam-report.md](../2026-08-08-campaign-ledger-and-route-planner-redteam-report.md)).

| Sub-Spec | Title | Dependencies | Phase Spec |
|---|---|---|---|
| 1 | Character-free currency formatting | none | [sub-spec-1-currency-formatting.md](sub-spec-1-currency-formatting.md) |
| 2 | Domain types and Dexie version 15 | none | [sub-spec-2-domain-types-and-v15.md](sub-spec-2-domain-types-and-v15.md) |
| 3 | Ledger arithmetic | 2 | [sub-spec-3-ledger-math.md](sub-spec-3-ledger-math.md) |
| 4 | Ledger repositories | 2 | [sub-spec-4-ledger-repositories.md](sub-spec-4-ledger-repositories.md) |
| 5 | `routePlanner` on the system contract | none | [sub-spec-5-route-planner-declaration.md](sub-spec-5-route-planner-declaration.md) |
| 6 | Route arithmetic and repository | 2, 5 | [sub-spec-6-route-math-and-repository.md](sub-spec-6-route-math-and-repository.md) |
| 7 | Ledger screen, split editor, Distribute | 1, 3, 4 | [sub-spec-7-ledger-ui.md](sub-spec-7-ledger-ui.md) |
| 8 | Route screen with gated nav | 5, 6, 7 | [sub-spec-8-route-ui.md](sub-spec-8-route-ui.md) |
| 9 | Markdown export, wired to both screens | 3, 4, 6, 7, 8 | [sub-spec-9-export.md](sub-spec-9-export.md) |
| 10 | End-to-end verification and decisions | 7, 8, 9 | [sub-spec-10-verification.md](sub-spec-10-verification.md) |

## Waves

- **Wave 1** (parallel): SS-01, SS-02, SS-05
- **Wave 2** (parallel): SS-03, SS-04, SS-06
- **Wave 3**: SS-07
- **Wave 4**: SS-08
- **Wave 5**: SS-09
- **Wave 6**: SS-10

SS-08 is serialised behind SS-07 despite having no logical dependency on it —
both edit `src/routes/index.tsx` and `src/components/shell/CampaignHeader.tsx`,
and concurrent worktrees would collide. This was red-team finding C-2; do not
"optimise" it back into Wave 3.

## Integration sub-spec

Not auto-generated. **SS-10 already is the integration sub-spec** — it carries
both `[INTEGRATION]` criteria, the cross-boundary browser run, and the mutation
checks. Adding a second would duplicate it.

## Requirement Traceability Matrix

| Requirement | Covered By |
|---|---|
| R1: signed integer base units, user never types a sign | SS-02, SS-07 |
| R2: running balance derived, never persisted | SS-03, SS-07 |
| R3: one entry with gross, net, legs, snapshot | SS-03, SS-07 |
| R4: invariants I1 and I2 asserted in code | SS-03 |
| R5: editing the split never alters a past entry | SS-07, SS-10 |
| R6: under 100 → Unallocated leg; over 100 → disabled | SS-03, SS-07 |
| R7: `evenSplit(n)` sums to exactly 100 | SS-03 |
| R8: `baseDenominationId` + `formatAmount`, no signature changed | SS-01, SS-07 |
| R9: route screen exists only where declared | SS-05, SS-08 |
| R10: Zod entry shipped with the type, and read | SS-05, SS-08 |
| R11: dense order, reorder in one transaction | SS-06, SS-08 |
| R12: both features export Markdown | SS-09 |
| R13: soft-delete convention on all three tables | SS-04, SS-06 |
| R14: new `version(15)` block | SS-02 |

No orphaned requirements. R8 is split-owned: SS-01 declares, SS-07 provides the
`baseDenominationId` reader. That split is deliberate and is exactly what
red-team C-1 required — SS-01 alone cannot satisfy `declaredCapabilities.test.ts`.

## Cross-spec dependency audit

Producers precede consumers in every case:

| Symbol | Produced by (wave) | Consumed by (wave) |
|---|---|---|
| `CurrencyModel.formatAmount` | SS-01 (1) | SS-07 (3), SS-09 (5) |
| `CurrencyModel.baseDenominationId` | SS-01 (1) | SS-07 (3) |
| `LedgerEntry`, `PayoutSplit`, `RouteStop` | SS-02 (1) | SS-03, SS-04, SS-06 (2) |
| `computeDistribution`, `evenSplit` | SS-03 (2) | SS-07 (3) |
| `ledgerRepository`, `ledgerSplitRepository` | SS-04 (2) | SS-07 (3), SS-09 (5) |
| `SystemDefinition.routePlanner` | SS-05 (1) | SS-08 (4) |
| `readNumericField`, `routeRepository` | SS-06 (2) | SS-08 (4), SS-09 (5) |
| `generateEntityFilename` | SS-09 (5) | SS-09 (5) |

No violations.

## Decomposition balance check

SS-07 matches 3 distinct cross-cutting concerns (routing, state management,
persistence) — below the 4-concern overload threshold, so no split is forced.
It remains the largest unit in the spec (red-team A-5); its phase spec breaks it
into 9 implementation steps rather than leaving it as one block.

No other sub-spec exceeds 2 concerns.

## Execution

Run `/forge-run docs/specs/2026-08-08-campaign-ledger-and-route-planner.md` to
execute all phase specs (point at the master spec — forge-run auto-detects
these). Add `--sub N` for a single sub-spec.
