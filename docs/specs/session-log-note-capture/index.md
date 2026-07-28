---
type: phase-spec-index
master_spec: "docs/specs/2026-07-27-session-log-note-capture.md"
date: 2026-07-27
sub_specs: 14
---

# Session Log — stylus-first note capture — Phase Specs

Refined from [2026-07-27-session-log-note-capture.md](../2026-07-27-session-log-note-capture.md).

## Execution waves

| Wave | Sub-specs | Rationale |
|------|-----------|-----------|
| 1 | SS-01, SS-02, SS-03 | No dependencies — leaf utilities and the shared component |
| 2 | SS-04, SS-05, SS-09, SS-10, SS-11, SS-14 | Depend only on wave 1 |
| 3 | SS-06, SS-08 | Panel needs the scanner; screen needs pad + repository |
| 4 | SS-07 | Promote sheet needs links, repository and panel |
| 5 | SS-13 | Selection needs the promote sheet and the screen |
| 6 | SS-12 | Integration — wires the FAB and verifies end to end |

## Sub-specs

| Sub-Spec | Title | Dependencies | Phase Spec |
|----------|-------|--------------|------------|
| SS-01 | `textToDoc` + `log` note type | none | [sub-spec-01-text-to-doc.md](sub-spec-01-text-to-doc.md) |
| SS-02 | `promoted_into` relationship + docs | none | [sub-spec-02-promoted-into-link.md](sub-spec-02-promoted-into-link.md) |
| SS-03 | `WritePad` ruled surface | none | [sub-spec-03-writepad.md](sub-spec-03-writepad.md) |
| SS-04 | Log-entry repository methods | SS-01 | [sub-spec-04-log-repository.md](sub-spec-04-log-repository.md) |
| SS-05 | Link scanner | SS-01 | [sub-spec-05-link-scanner.md](sub-spec-05-link-scanner.md) |
| SS-06 | Suggested-links panel | SS-05 | [sub-spec-06-suggested-links-panel.md](sub-spec-06-suggested-links-panel.md) |
| SS-07 | Promote-entries sheet | SS-02, SS-04, SS-06 | [sub-spec-07-promote-sheet.md](sub-spec-07-promote-sheet.md) |
| SS-08 | `SessionLog` screen + route | SS-03, SS-04 | [sub-spec-08-session-log-screen.md](sub-spec-08-session-log-screen.md) |
| SS-09 | Hide log from grid, keep searchable | SS-01 | [sub-spec-09-notesgrid-exclusion.md](sub-spec-09-notesgrid-exclusion.md) |
| SS-10 | Exclude log from KB graph | SS-01 | [sub-spec-10-kb-exclusion.md](sub-spec-10-kb-exclusion.md) |
| SS-11 | AAR export — log as one section | SS-01 | [sub-spec-11-aar-export.md](sub-spec-11-aar-export.md) |
| SS-13 | Selection, promote entry, review sweep | SS-07, SS-08 | [sub-spec-13-selection-and-review.md](sub-spec-13-selection-and-review.md) |
| SS-14 | Wire `WritePad` into ship notes | SS-03 | [sub-spec-14-writepad-ship-notes.md](sub-spec-14-writepad-ship-notes.md) |
| SS-12 | Route FAB to log + end-to-end integration | SS-13, SS-14 | [sub-spec-12-integration.md](sub-spec-12-integration.md) |

> No integration sub-spec was auto-generated: **SS-12 already is one**, carrying the `[INTEGRATION]` criterion that crosses every sub-spec boundary.

## Requirement Traceability Matrix

| Requirement | Covered By |
|-------------|-----------|
| R1: `NOTE_TYPES` includes `'log'`, no migration | SS-01 |
| R2: `textToDoc()` / `docToText()` with `[[…]]` parsing | SS-01 |
| R3: reusable ruled writing surface | SS-03 (builds), SS-14 (proves reuse) |
| R4: session-scoped capture, no title/type/tags, edit + delete | SS-04, SS-08 |
| R5: no-active-session prompt | SS-08 |
| R6: promote to new / append to existing / tag, entries survive | SS-02, SS-07 |
| R7: link scanner with fuzzy matching + missing-record suggestions | SS-05, SS-06 |
| R8: excluded from grid and KB graph | SS-09, SS-10 |
| R9: export as one chronological section | SS-11 |
| R10: FAB opens the log | SS-12 |

No orphaned requirements. R3 and R4 are split-ownership with a clear primary owner each.

## Cross-spec dependency audit

Every producer is in an earlier wave than its consumers. No violations.

- SS-01 (wave 1) produces `textToDoc` / `docToText` → consumed by SS-04, SS-05, SS-07, SS-08 (waves 2–4) ✓
- SS-03 (wave 1) produces `WritePad` → consumed by SS-08, SS-14 (waves 2–3) ✓
- SS-05 (wave 2) produces `scanForLinks` → consumed by SS-06, SS-13 (waves 3, 5) ✓
- SS-06 (wave 3) produces `SuggestedLinksPanel` → consumed by SS-07, SS-13 (waves 4–5) ✓
- SS-07 (wave 4) produces `PromoteEntriesSheet` → consumed by SS-13 (wave 5) ✓

## Decomposition balance

No sub-spec matches 4+ cross-cutting concerns. SS-08 was already split during red-team (selection and review moved to SS-13), which dropped it from 4 concerns to 2 (persistence, state management).

## Verification note

This project has **no DOM test environment** — no `jsdom`, `happy-dom` or `@testing-library`, and vitest runs pure-logic tests only. Component behaviour is verified by `[HUMAN REVIEW]` in the running app (`npm run preview`) or via the Playwright smoke script in `forge-project.json`. Workers must **not** fabricate DOM test evidence and must **not** add a DOM harness — that is an escalation trigger.

## Execution

Run `/forge-run docs/specs/2026-07-27-session-log-note-capture.md` to execute all phase specs (point at the master spec — forge-run auto-detects linked phase specs).
Run `/forge-run docs/specs/2026-07-27-session-log-note-capture.md --sub N` to execute a single sub-spec.
