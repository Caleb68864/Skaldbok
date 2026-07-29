---
type: phase-spec-index
master_spec: "docs/specs/2026-07-29-notes-overhaul-completion.md"
date: 2026-07-29
sub_specs: 6
---

# Notes Overhaul Completion — Phase Specs

Refined from [2026-07-29-notes-overhaul-completion.md](../2026-07-29-notes-overhaul-completion.md)
on 2026-07-29. Red-teamed before refinement; all 10 findings patched into the
master spec (see [redteam-report.md](redteam-report.md)).

| Sub-Spec | Title | Dependencies | Phase Spec |
|----------|-------|--------------|------------|
| 1 | FAB navigates to the full-screen log | none | [sub-spec-1-fab-full-screen-log.md](sub-spec-1-fab-full-screen-log.md) |
| 2 | Delete the quick-action surface | 1 | [sub-spec-2-delete-quick-action-surface.md](sub-spec-2-delete-quick-action-surface.md) |
| 3 | Remove the openQuickLog plumbing | 1, 2 | [sub-spec-3-remove-openquicklog-plumbing.md](sub-spec-3-remove-openquicklog-plumbing.md) |
| 4 | Log entries on the timeline (top-level, hidden) | none | [sub-spec-4-timeline-log-lane.md](sub-spec-4-timeline-log-lane.md) |
| 5 | Reach the log from the More screen | none | [sub-spec-5-more-screen-log-link.md](sub-spec-5-more-screen-log-link.md) |
| 6 | End-to-end verification and evidence | 1, 2, 3, 4, 5 | [sub-spec-6-integration-verification.md](sub-spec-6-integration-verification.md) |

## Waves

- **Wave 1:** SS-01, SS-04, SS-05 (no dependencies — run in parallel)
- **Wave 2:** SS-02
- **Wave 3:** SS-03
- **Wave 4:** SS-06 (integration verification)

SS-06 serves as this spec's integration sub-spec; no additional one is
auto-generated.

## Requirement Traceability Matrix

| Requirement | Covered By |
|-------------|-----------|
| R1: FAB navigates to `/session/log` and hides there | Sub-spec 1 |
| R2: Nine quick-action files deleted | Sub-spec 2 |
| R3: `openQuickLog` plumbing removed, callers rewired | Sub-spec 3 |
| R4: Log entries on a top-level hidden-by-default timeline lane | Sub-spec 4 |
| R5: `MoreScreen` offers a Session Log link | Sub-spec 5 |
| R6: Auto-logging behaviour unchanged | Sub-spec 6 (verification); enforced as a must-not across 1-5 |
| R7: `npm run build` and `npm test` pass | Sub-specs 1-5 (each), Sub-spec 6 (final) |

No orphaned requirements. R6 is verification-only by design — it is a negative
requirement (nothing changes), so it is enforced as a must-not in every sub-spec
and confirmed once in SS-06.

## Cross-Spec Dependency Audit

| Consumer | Consumes | Producer | Wave order |
|----------|----------|----------|------------|
| SS-02 | `GlobalFAB` no longer importing `SessionQuickActions` | SS-01 | 1 → 2 ✓ |
| SS-03 | no consumer of the quick-log context members | SS-01, SS-02 | 1, 2 → 3 ✓ |
| SS-06 | all merged code | SS-01…SS-05 | 1-3 → 4 ✓ |

No symbol-level ordering violations. SS-05 produces nothing other sub-specs
consume, which is why it sits in Wave 1 alongside SS-01.

**File-level overlap (recorded after converge pass 1 grew SS-04's scope).**
SS-04 and SS-02 both modify `src/features/session/SessionTimelinePanel.tsx` —
SS-02 removes the dead `onSelectionContextChange` prop, SS-04 adds the
`defaultHidden` classification. They touch disjoint regions and the waves keep
them sequential (SS-04 in Wave 1, SS-02 in Wave 2), so this is not an ordering
violation. It does mean the two sub-specs cannot be run **concurrently** against
one worktree: parallel writes to the same file would collide. Run them in wave
order, or isolate with `isolation: worktree`.

## Decomposition Balance

No sub-spec matches 4+ cross-cutting concerns. SS-01 touches routing and layout
(2); SS-03 touches state management and routing (2); the rest touch one or none.
Balance check passes.

SS-02 exceeds the file-count heuristic (10 files) but is explicitly marked
**do not split** — the deletion is atomic, and any partial split leaves an
intermediate state where `tsc -b` fails.

## Execution

Run `/forge-run docs/specs/2026-07-29-notes-overhaul-completion.md` to execute
all phase specs (point at the master spec file — forge-run auto-detects linked
phase specs).

Run `/forge-run docs/specs/2026-07-29-notes-overhaul-completion.md --sub N` to
execute a single sub-spec.
