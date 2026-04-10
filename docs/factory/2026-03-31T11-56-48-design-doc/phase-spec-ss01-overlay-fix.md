# Phase Spec — SS-01: SessionQuickActions Overlay Blocks CombatTimeline

**Run:** 2026-03-31T11-56-48-design-doc
**Tier:** 1 (Session Blockers)
**Item:** 1 of 12
**Assigned worker:** single agent — implements ONLY this sub-spec

> **Dependency:** None. This sub-spec has no prerequisites. May be implemented first in Tier 1.

---

## Intent

When `showCombatView` is true, combat owns the session screen. The Quick Log chip row must collapse so it does not overlap the `CombatTimeline`. The chip row must re-appear when combat ends.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/screens/SessionScreen.tsx` | Modify — conditional render of Quick Log chip row |

> No other files should be modified. If any other file requires changes, escalate to human before proceeding.

---

## Implementation Steps

1. **Read** `src/screens/SessionScreen.tsx` in full before writing any code.
2. Locate the `showCombatView` boolean — it comes from context or local state already present in the file.
3. Find the Quick Log chip row JSX (the row of chips rendered by or alongside `SessionQuickActions`).
4. **Edge case first:** If a Quick Log drawer is open when `showCombatView` becomes `true`, auto-close the drawer before hiding the chip row. Identify the drawer open/close state variable and reset it to `false` in the same conditional path (e.g., a `useEffect` that watches `showCombatView`).
5. Wrap the chip row render in a conditional: `{!showCombatView && <ChipRow ... />}`.
6. Verify the chip row re-appears when `showCombatView` returns to `false` — no page refresh required.
7. Do not alter `CombatTimeline`, `SessionQuickActions`, or any context shape.
8. Run `tsc -b` — fix all type errors before committing.
9. Spot-check in browser at 360px viewport: toggle combat on/off, confirm no z-index clash or overflow.
10. Commit with a descriptive message referencing Item 1.

---

## Acceptance Criteria

- [ ] **AC1.1** — When `showCombatView` is `true`, the Quick Log chip row is **not present in the DOM**.
- [ ] **AC1.2** — When `showCombatView` is `false`, the Quick Log chip row renders normally.
- [ ] **AC1.3** — Transitioning from combat back to non-combat re-renders the chip row without a page refresh.
- [ ] **AC1.4** — No layout overflow or z-index clash between chip row and `CombatTimeline` at 360px viewport.
- [ ] **AC1.5** — `tsc -b` reports zero new type errors after this change.

**Edge case — drawer auto-close:**
- If the Quick Log drawer is open when combat starts, it must be closed automatically before the chip row is hidden.

---

## Verification Commands

```bash
# Type-check only (no shell execution on target machine — run mentally or via IDE)
tsc -b

# E2E smoke (run as part of Tier 1 gate, not this item alone)
# python tests/e2e_full_test.py
```

**Manual spot-check checklist (360px viewport):**
- [ ] Open session → Quick Log chip row visible.
- [ ] Activate combat → chip row disappears, `CombatTimeline` visible, no overlap.
- [ ] Open Quick Log drawer → then activate combat → drawer closes, chip row hides.
- [ ] End combat → chip row reappears with no stale state.

---

## Constraints (Never Violate)

- No Dexie schema version bump.
- No new npm dependencies.
- No changes to `SessionQuickActions` component prop interface.
- All inline styles must use `var(--color-*)` CSS custom properties (no raw hex/rgb).
- Touch targets remain ≥ 44×44px.

---

## Shortcuts

- Use existing `showCombatView` boolean already present in `SessionScreen.tsx`.
- Use existing `chipStyle` pattern from `SessionQuickActions.tsx` for any chip UI (read-only reference).
- Commit after this item is complete for bisectability before moving to SS-02.
