# Phase Spec — SS-11: Console Warning Cleanup

**Run:** 2026-03-31T11-56-48-design-doc
**Tier:** 3 (Polish)
**Item:** 11 of 12
**Assigned worker:** single agent — implements ONLY this sub-spec

> **Dependency:** Tiers 1 and 2 (SS-01 through SS-08) must be complete and E2E must pass 10/10 before starting Tier 3 items. SS-09 through SS-12 may be implemented concurrently within Tier 3.
> **Note:** This is a verification-first item. No code changes are planned unless warnings are found to persist.

---

## Intent

Verify that the navigate-during-render fix (committed in `75f5130`) has eliminated all React/router console warnings. No code changes are expected unless warnings persist. If new warnings are found, identify the source and fix; escalate if the root cause is unclear.

---

## Files to Modify

**None planned.** This is a verification-only item.

If code changes are required after verification:
- Identify the exact file and line causing the warning before modifying anything.
- Escalate to human if the root cause is unclear.

---

## Implementation Steps

1. **Run the full E2E suite** and capture browser console output:
   ```bash
   python tests/e2e_full_test.py
   ```
   - Inspect the console output for any `Warning: Cannot update a component` messages.
   - Record all unhandled React errors or warnings.

2. **Manual session walkthrough** at 360px viewport:
   - Open browser DevTools console.
   - Navigate through all screens: Character Library → Character Sheet → Session → Notes → Combat.
   - Perform representative actions: create a note, start a session, log a combat event, create/switch characters.
   - Record any warnings or errors that appear.

3. **If zero warnings are found:** Mark AC11.1 and AC11.2 as passed. No code changes needed. Commit a verification note if desired, or simply proceed to SS-12.

4. **If warnings persist:**
   - Read the file(s) identified by the stack trace.
   - Implement a fix for the specific warning.
   - Re-run E2E and manual walkthrough to confirm the fix resolved the warning.
   - If the root cause is unclear or the fix would be complex: escalate to human before proceeding.
   - Run `tsc -b` after any code change.
   - Commit with a descriptive message referencing Item 11.

---

## Acceptance Criteria

- [ ] **AC11.1** — Zero `Warning: Cannot update a component` (navigate-during-render) messages in E2E console output.
- [ ] **AC11.2** — Zero unhandled React errors or warnings during a full manual session walkthrough.
- [ ] **AC11.3** — If new warnings are found, they are addressed and resolved before this item is marked complete.

---

## Verification Commands

```bash
# Run E2E suite and inspect console output
python tests/e2e_full_test.py

# Type-check (only if code changes were made)
tsc -b
```

**Manual checklist:**
- [ ] E2E console output scanned — zero `Warning: Cannot update a component` messages.
- [ ] Manual walkthrough complete — zero unhandled React errors or warnings in DevTools console.
- [ ] If warnings found: fix committed and E2E re-run confirms clean output.

---

## Escalation Triggers

- If a persistent warning's root cause is not obvious from the stack trace: **escalate to human before attempting a fix**.
- If a fix would touch more than 1–2 files or change component behavior: **escalate to human**.

---

## Constraints (Never Violate)

- No Dexie schema version bump.
- No new npm dependencies.
- No changes to existing component prop interfaces without human approval.
- All inline styles must use `var(--color-*)` CSS custom properties (no raw hex/rgb).

---

## Shortcuts

- The navigate-during-render fix is already in `75f5130` — this is a verification step, not a re-implementation.
- Commit after this item (even if no code changes were needed, for audit trail).
