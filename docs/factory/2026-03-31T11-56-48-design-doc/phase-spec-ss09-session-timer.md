# Phase Spec — SS-09: Session Timer Granularity

**Run:** 2026-03-31T11-56-48-design-doc
**Tier:** 3 (Polish)
**Item:** 9 of 12
**Assigned worker:** single agent — implements ONLY this sub-spec

> **Dependency:** Tiers 1 and 2 (SS-01 through SS-08) must be complete and E2E must pass 10/10 before starting Tier 3 items. SS-09 through SS-12 may be implemented concurrently within Tier 3.

---

## Intent

The session timer updates every 10 seconds instead of every 30 seconds, providing more accurate elapsed time display during a gaming session.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/screens/SessionScreen.tsx` | Modify — change timer interval from 30 000 ms to 10 000 ms |

> No other files should be modified. If any other file requires changes, escalate to human before proceeding.

---

## Implementation Steps

1. **Read** `src/screens/SessionScreen.tsx` in full before writing any code.
2. Locate the timer interval — look for `setInterval`, `useInterval`, or a custom timer hook.
3. Change the interval value from `30000` to `10000`.
   - If the value is a named constant, update the constant.
   - If it is a literal, replace the literal.
4. Verify the interval cleanup: ensure `clearInterval` (or equivalent cleanup) is called on component unmount to prevent memory leaks. If cleanup is missing, add it.
5. Run `tsc -b` — fix all type errors.
6. Spot-check: start a session, wait ~15 seconds, confirm the displayed time updates at least once within 10 seconds.
7. Commit with a descriptive message referencing Item 9.

---

## Acceptance Criteria

- [ ] **AC9.1** — Session timer interval is 10 seconds (10 000 ms).
- [ ] **AC9.2** — Timer display updates visibly within 10 seconds of session state changes.
- [ ] **AC9.3** — No memory leak introduced (interval is properly cleared on unmount).
- [ ] **AC9.4** — `tsc -b` reports zero new type errors after this change.

---

## Verification Commands

```bash
# Type-check
tsc -b
```

**Manual spot-check checklist:**
- [ ] Start a session → timer is visible.
- [ ] Wait 10–12 seconds → timer increments at least once.
- [ ] Navigate away from SessionScreen → no console errors about interval after unmount.
- [ ] Return to SessionScreen → timer resumes normally.

---

## Constraints (Never Violate)

- No Dexie schema version bump.
- No new npm dependencies.
- All inline styles must use `var(--color-*)` CSS custom properties (no raw hex/rgb).

---

## Shortcuts

- This is a single-line change. Keep the implementation minimal.
- Commit after this item for bisectability.
