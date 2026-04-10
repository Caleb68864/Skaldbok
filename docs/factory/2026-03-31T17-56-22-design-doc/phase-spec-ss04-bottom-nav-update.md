# Phase Spec — SS-04: Bottom Nav Update
**Sub-Spec:** SPEC-B1-4
**Issue:** #16
**Batch:** 1 — Session UX Core
**Dependency:** None (can run in parallel with SS-01, SS-02)

---

## Intent
Promote Reference to a top-level bottom nav destination (replacing Settings). Settings moves to hamburger-only access. Result: exactly 3 bottom nav tabs — Characters, Session, Reference.

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Modify | `src/components/shell/BottomNav.tsx` |
| Verify / Modify | `src/routes/index.tsx` (ensure Reference route exists) |

---

## Implementation Steps

1. **Read** `src/components/shell/BottomNav.tsx` to understand current tab configuration.
2. **Read** `src/routes/index.tsx` to confirm the Reference screen route path.
3. **Update** BottomNav to contain exactly 3 tabs in order:
   1. **Characters** — existing tab (keep as-is)
   2. **Session** — existing tab (keep as-is)
   3. **Reference** — new tab; use an appropriate icon from the existing icon set (book/scroll preferred; **human approves final icon** — default to book icon if not answered)
4. **Remove** Settings from BottomNav tab list entirely.
5. **Verify** Settings remains accessible via the hamburger menu (do not delete the Settings route or hamburger entry — only remove from bottom nav).
6. Run `tsc --noEmit` to confirm no type errors.

---

## Acceptance Criteria

- [ ] **B1-4-AC1:** Bottom nav shows exactly 3 tabs: Characters, Session, Reference.
- [ ] **B1-4-AC2:** Settings is NOT in bottom nav; accessible via hamburger menu only.
- [ ] **B1-4-AC3:** Reference tab navigates to the Reference screen.

---

## Open Question (Default Applied)

- **OQ-1:** Reference tab icon — default to book icon from existing icon set if human has not specified otherwise.

---

## Verification Commands

```bash
# TypeScript — must pass with zero errors
npx tsc --noEmit
```

---

## Cross-Cutting Constraints

- No new npm dependencies.
- All CSS via CSS variables — no hardcoded colors.
- All touch targets ≥ 44 px.
