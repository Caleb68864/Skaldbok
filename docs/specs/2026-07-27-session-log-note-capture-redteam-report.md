---
type: redteam-report
generated: 2026-07-27
target: docs/specs/2026-07-27-session-log-note-capture.md
findings_count: 9
critical: 3
advisory: 6
patched: 9
---

# Red Team Review: 2026-07-27-session-log-note-capture.md

9-role adversarial review of a 12-sub-spec master spec (now 14 after patching).
All findings were patched into the spec.

## CRITICAL Findings (3)

### C-1: `WritePad` is an orphan — the reuse promise is never delivered
- **Roles:** Developer Implementer, Integration Architect
- **Location:** Requirement 3; SS-03
- **Issue:** Requirement 3 and design §3.1 promise a surface "any text field can
  expand into… ship notes, finance notes, character background." SS-03 built it,
  but no sub-spec added an expand affordance to any existing field. The only
  consumer was `SessionLog` — the construction-site-without-caller pattern.
- **Evidence:** No sub-spec declared `(modify)` on any screen with a long-text
  field other than the new `SessionLog`.
- **Fix applied:** Added **SS-14** wiring the expand affordance into the ship
  notes textarea (`src/screens/ShipsScreen.tsx`), gated to edit mode so it
  inherits the play-mode lockdown. SS-12 now depends on it.

### C-2: ~12 `[BEHAVIORAL]` criteria are unverifiable in this project
- **Role:** QA Tester
- **Location:** SS-03, SS-06, SS-07, SS-08, SS-09
- **Issue:** Criteria asserting DOM state (`document.activeElement`, "renders
  visibly distinct", "reveals an action bar") require a DOM test environment
  that does not exist. A factory worker facing an unverifiable criterion either
  fabricates evidence or defers the sub-spec.
- **Evidence:** No `jsdom`, `happy-dom`, or `@testing-library` in
  `package.json`; no vitest `environment` configured; CLAUDE.md states
  "There is no component/DOM test setup."
- **Fix applied:** Retagged DOM-dependent criteria as `[HUMAN REVIEW]`, kept
  `[BEHAVIORAL]` only for repository- and logic-level assertions, and added a
  verification note to SS-03 forbidding both evidence fabrication and adding a
  DOM harness (out of scope, escalation trigger).

### C-3: The "Review" sweep had no acceptance criterion
- **Roles:** QA Tester, Integration Architect
- **Location:** SS-08 scope
- **Issue:** The review sweep is one of the two placements the design specifies
  for `LinkScanner` and is the after-action pass, but no criterion covered it —
  nothing verified it existed.
- **Fix applied:** Moved selection and review into the new **SS-13**, with an
  explicit criterion that Review calls `scanForLinks` with **all** session
  entries, not only selected ones.

## ADVISORY Findings (6)

### A-1: Promote was a multi-write with no transaction
- **Role:** SRE / Operator
- **Fix applied:** SS-07 now requires the whole promote — note write plus every
  `promoted_into` link — inside one `db.transaction('rw', …)`, with a
  `[STRUCTURAL]` criterion asserting it.

### A-2: No write-failure handling on commit
- **Roles:** End User, SRE / Operator
- **Fix applied:** SS-03 and SS-08 now require try/catch on commit that retains
  the draft text and toasts. Added to Edge Cases.

### A-3: Session soft-delete does not cascade to notes
- **Role:** Data / Migration Steward
- **Evidence:** `sessionRepository.softDelete` (line 193) updates only the
  session row.
- **Fix applied:** Documented in Edge Cases as an accepted known limitation,
  noting the log amplifies it from a handful of notes to ~80 per session.
  Tracked for a follow-up cascade pass; explicitly out of scope here.

### A-4: SS-08 was the largest sub-spec (highest defer risk)
- **Role:** Scope Realist
- **Fix applied:** Split. SS-08 is now capture and correction only; selection,
  promotion entry point and review moved to SS-13. SS-08's dependency on SS-07
  was dropped so it can run earlier in parallel.

### A-5: No success metric
- **Role:** Product / Business
- **Fix applied:** Outcome now states: capture takes **at most 2 taps** from the
  session screen versus today's minimum of 5; any change raising that count is a
  regression.

### A-6: Empty titles render as blank rows
- **Role:** End User
- **Fix applied:** SS-09 requires a title fallback of the first ~40 characters
  of body text.

## Security

**0 findings.** Local-first PWA, no backend, no auth surface, no PII/PCI
handling. `textToDoc` parses `[[…]]` into ProseMirror data nodes rendered by
React, which escapes them — no injection surface.

## Role Scorecards

Developer: 1 | QA: 2 | End User: 2 | Architect: 2 | Scope Realist: 1 | Security: 0 | SRE: 2 | Data: 1 | Product: 1

## Post-patch validation

- `validate-spec-paths --require-tracked` → 14 sub-specs, 22 files, all paths
  resolve cleanly, exit 0.
- No dependency cycles; no backward phase references.
