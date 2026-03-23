# Retrospective: 2026-03-22T21-04-17-design-doc

## Run Summary

| Field | Value |
|-------|-------|
| Run ID | 2026-03-22T21-04-17-design-doc |
| Input Type | design-doc |
| Task | Dragonbane PWA Theme Foundation |
| Spec Score | null (not populated) |
| Sub-Specs | 5 (SS-1 Design Tokens, SS-2 Fantasy Themes, SS-3 Font Pairing, SS-4 Component Styling, SS-5 Interaction & A11y) |
| Phases Completed | 3/8 (forge, prep, preflight) |
| Phases Reached | 0 beyond preflight |
| Total Duration | ~10m 32s (21:04:17 → 21:14:49 preflight end, then abort) |
| Tokens Used | 0 (tracking not wired) |
| Doom Loop | 3 consecutive non-productive waves / 6 total waves |
| Implementation Result | **0/73 points scored — zero implementation** |

## Verdict: FAILED — Aborted Before Run Phase

The pipeline completed forge, prep, and preflight phases successfully on their first attempt, producing a high-quality spec with 5 sub-specs and 73 acceptance criteria points. However, the **run phase was never started** — it remains `pending` with 0 attempts. The pipeline entered `abort` status after 3 global attempts, with the doom loop detecting 3 consecutive non-productive waves across 6 total waves.

This is distinct from the previous forge-factory failure (2026-03-22T08-13-11) where the run phase "completed" in 7 seconds with no output. Here, the pipeline correctly did NOT start the run phase but was unable to recover from whatever blocked the transition.

---

## Phase Timing Analysis

| Phase | Duration | Attempts | Assessment |
|-------|----------|----------|------------|
| triage | skipped | 0 | Normal for design-doc input |
| forge | 2m 50s | 1 | Normal — produced 5-sub-spec theme foundation spec |
| prep | 5m 35s | 1 | Normal — produced 5 phase-spec files |
| preflight | 2m 07s | 1 | Normal — pre-flight checks passed |
| **run** | **never started** | **0** | **CRITICAL — pipeline aborted before invocation** |
| verify | never started | 0 | Blocked by run |
| completeness | never started | 0 | Blocked by verify |
| outcomes | never started | 0 | Blocked by completeness |

**Total pipeline active time**: ~10m 32s (all in planning phases)

---

## Root Cause Analysis

### Primary Failure: Pipeline Abort Before Run Phase

The manifest shows:
- `current_phase: "abort"`, `phase_status: "failed"`, `attempts: 3`
- `run.status: "pending"`, `run.started: null`, `run.attempts: 0`
- `doom_loop.consecutive_non_productive_waves: 3`, `doom_loop.total_waves: 6`

**Hypothesis 1 — Doom Loop Circuit Breaker Triggered Prematurely**: The doom loop detected 3 consecutive non-productive waves and triggered abort. However, with 0 tokens used, these "waves" may have been empty iterations where the pipeline loop spun without actually invoking any agents. The circuit breaker fired on non-productive waves that were non-productive because they never executed work — a self-fulfilling abort.

**Hypothesis 2 — Phase Transition Failure (preflight → run)**: The global `attempts: 3` suggests the pipeline tried 3 times to advance past some point. The preflight completed successfully, but the transition to run may have failed due to:
- A missing evidence gate condition (e.g., `spec_score` is null)
- A dirty git state check blocking run phase entry
- An error in the phase handler dispatch that doesn't surface in the manifest

**Hypothesis 3 — Uncommitted Changes Blocking**: The manifest shows `git.dirty: true` with uncommitted changes in `TopBar.tsx` and `theme.css`. If the run phase requires a clean working tree, this would block entry. These changes (57 insertions) may be artifacts from a prior manual edit or a previous factory run that wasn't committed.

### Most Likely Root Cause

The combination of `attempts: 3` at the pipeline level with `run.attempts: 0` strongly suggests the **pipeline loop itself retried 3 times and hit the abort threshold, but each retry failed before the run handler was invoked**. The doom loop's 6 total waves with 3 non-productive waves corroborates this — each retry counted as 2 waves (one productive for prep/preflight re-evaluation, one non-productive for the blocked run entry).

---

## What Worked

1. **Spec Quality**: The forge phase produced an excellent, detailed spec with 5 sub-specs, 73 total acceptance criteria points, clear pass thresholds (90%/75%/fail), critical-path gates, implementation guidance, and a file map.
2. **Sub-Spec Decomposition**: 5 well-scoped sub-specs organized by concern (tokens → themes → fonts → components → interaction). Weights correctly assign SS-1 and SS-2 as Critical (3), others as Important (2).
3. **Phase Planning**: Prep phase produced 5 phase-spec files with clear boundaries. This is an improvement over the prior run (19-41-57) that grouped too many sub-specs into Phase 4.
4. **Preflight**: Completed quickly (2m 07s), suggesting pre-flight validation was effective.
5. **Input Document Quality**: The forge-input was exceptionally detailed with exact color hex values, font specifications, spacing scales, and component styling guidelines.

## What Failed

1. **Run phase never invoked**: The core implementation phase was never started. All planning work was wasted.
2. **Abort without diagnostic**: The manifest provides no error message, stack trace, or phase-level failure reason. The `abort` status is opaque.
3. **Token tracking at 0**: Either no agents were spawned or the tracker is disconnected. This is a recurring issue (also seen in runs 08-13-11 and 19-41-57).
4. **spec_score not populated**: Despite the forge phase completing and producing a quality spec, `spec_score` remains null. This may be related to the abort trigger.
5. **Uncommitted changes from prior work**: Dirty git state (TopBar.tsx, theme.css changes) may have contributed to the abort. The pipeline should either handle dirty state gracefully or commit/stash before proceeding.
6. **Run churn on this project**: This is the **7th factory run** on Skaldmark today (14-15-55, 17-15-37, 17-55-04, 18-57-06, 19-37-42, 19-39-31, 19-41-57), plus 2 quick aborts. Only one (19-41-57) completed successfully. This suggests systemic instability.

---

## Comparison to Same-Day Runs

| Metric | 19-41-57 (Success) | 21-04-17 (This Run) |
|--------|-------------------|---------------------|
| Input Type | design-doc | design-doc |
| Sub-Specs | 4 phases (9 SS) | 5 sub-specs |
| Forge Duration | 4m 02s | 2m 50s |
| Prep Duration | 4m 48s | 5m 35s |
| Preflight Duration | 6m 59s | 2m 07s |
| Run Phase | Complete (13m 26s) | **Never started** |
| Overall Status | Complete | **Abort** |
| Git Dirty | false | **true** |
| Prior Aborted Runs | 4 | 0 on this branch |

Key difference: The successful run (19-41-57) had a clean git state (`uncommitted_diff_stat: ""`). This run had dirty state (57 lines changed). This strengthens the hypothesis that dirty git state may be the blocking factor.

---

## Quality Scores

| Area | Score (0-10) | Rationale |
|------|-------------|-----------|
| spec-quality | 9 | Excellent 5-sub-spec decomposition, 73-point scoring rubric, exact token values, critical-path gates, implementation file map |
| input-quality | 10 | Detailed design-doc with exact hex values, font specs, component guidelines, accessibility requirements |
| phase-planning | 8 | 5 phase-specs produced, good scoping (learned from 19-41-57 Phase 4 overload) |
| pipeline-execution | 0 | Run phase never invoked — total execution failure |
| error-diagnostics | 1 | Abort with no error message, no stack trace, no failure reason in manifest |
| artifact-persistence | 4 | Spec, phase-specs, manifest persisted; no run/verify/outcomes artifacts |
| token-tracking | 0 | Reports 0 tokens despite 6 waves — tracking completely non-functional |
| manifest-integrity | 3 | Phases tracked, sub_spec_count correctly set to 5, but spec_score null, timing incomplete |

**Overall Score: 35/80 (44%) — Grade: F**

The pipeline's planning phases are maturing (spec quality, decomposition, phase planning all strong), but execution reliability is critically broken. Two consecutive days of factory runs have produced zero implementation from the run phase.

---

## Learnings

1. **[pipeline-abort-diagnostics]** When the pipeline enters `abort` status, there must be an `abort_reason` field in the manifest explaining *why* the abort occurred. Current abort is completely opaque — no error, no phase-level reason, no stack trace.

2. **[dirty-git-gate]** If the pipeline blocks on dirty git state, it should either: (a) auto-stash before run phase, (b) clearly log that dirty state is the blocking reason, or (c) have a configurable policy (`allow_dirty: true`). Silent blocking is the worst outcome.

3. **[doom-loop-false-positive]** The doom loop's "non-productive waves" counter can trigger a false-positive abort when the pipeline loop spins without actually invoking workers. The circuit breaker should distinguish between "workers were invoked and produced nothing" vs "workers were never invoked due to a gating failure."

4. **[spec-score-population]** `spec_score` should be populated during the forge phase when the spec is generated. It being null after forge completes suggests the scoring step is either not implemented or its result isn't persisted.

5. **[run-churn-detection]** 7+ factory runs on the same project in one day with only 1 success indicates systemic issues. The pipeline should track cross-run statistics and warn the operator when success rate drops below a threshold.

---

## Amendment Proposals

### 1. Add abort_reason to Manifest on Abort

- **Area:** error-diagnostics
- **Priority:** CRITICAL
- **Confidence:** 0.98
- **Impact:** 0.95
- **Proposal:** When the pipeline enters abort status, write an `abort_reason` string to the manifest with the specific condition that triggered the abort (e.g., "doom_loop: 3 consecutive non-productive waves", "max_attempts exceeded at preflight→run transition", "git dirty state blocked run entry"). This is the single highest-leverage improvement — every debugging session starts with "why did it abort?"
- **Location:** Pipeline loop abort handler

### 2. Distinguish Doom Loop Causes

- **Area:** pipeline-execution
- **Priority:** HIGH
- **Confidence:** 0.90
- **Impact:** 0.85
- **Proposal:** The doom loop circuit breaker should track two distinct counters: (a) `waves_with_zero_output` — workers invoked but produced no files, and (b) `waves_with_zero_invocations` — loop iterated but no workers were spawned. Counter (b) should trigger a diagnostic log and early abort with a specific reason ("pipeline loop spinning without invoking workers — likely a gate/transition failure"), not just a generic non-productive wave count.
- **Location:** Doom loop tracker / pipeline loop

### 3. Handle Dirty Git State Gracefully

- **Area:** pipeline-execution
- **Priority:** HIGH
- **Confidence:** 0.85
- **Impact:** 0.80
- **Proposal:** Before the run phase, if `git.dirty` is true, the pipeline should: (1) log a warning listing the dirty files, (2) check if dirty files overlap with phase-spec target files (conflict risk), (3) if no conflict, proceed with a warning; if conflict, auto-stash and restore after run. Never silently block.
- **Location:** Preflight or run phase entry gate

### 4. Populate spec_score After Forge

- **Area:** manifest-integrity
- **Priority:** MEDIUM
- **Confidence:** 0.85
- **Impact:** 0.60
- **Proposal:** The forge phase should compute and persist a spec quality score (e.g., based on AC count, sub-spec coverage, constraint presence) to `manifest.spec_score`. If downstream gates depend on this value being non-null, its absence could silently block progression.
- **Location:** Forge phase handler, post-spec-generation

### 5. Cross-Run Success Rate Tracking

- **Area:** process
- **Priority:** MEDIUM
- **Confidence:** 0.80
- **Impact:** 0.70
- **Proposal:** Maintain a lightweight `factory-runs.json` ledger per project that tracks run_id, status, duration, and sub-spec count across all runs. When the abort rate exceeds 50% in the last 5 runs, emit a warning suggesting the operator review input quality, pipeline configuration, or environmental factors (dirty git, branch conflicts) before launching another run.
- **Location:** Pipeline entry point / outcomes phase

---

## Recommended Next Steps

1. **Immediate**: Investigate what blocks the preflight→run transition. Check pipeline logs (if any exist outside the manifest) for errors during the 3 retry attempts.
2. **Immediate**: Resolve uncommitted changes — either commit TopBar.tsx / theme.css edits or stash them before re-running.
3. **Short-term**: Implement Amendment 1 (abort_reason in manifest) to make future debugging tractable.
4. **Re-run**: Re-attempt this exact spec (theme foundation) with clean git state. The spec and phase-specs are excellent — only execution failed.
5. **Process**: Consider whether the `doom_loop.consecutive_non_productive_waves` threshold of 3 is too aggressive for a 5-sub-spec run.
