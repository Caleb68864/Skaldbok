# Phase Spec — SS-10: Character Sub-Nav Active Detection

**Run:** 2026-03-31T11-56-48-design-doc
**Tier:** 3 (Polish)
**Item:** 10 of 12
**Assigned worker:** single agent — implements ONLY this sub-spec

> **Dependency:** Tiers 1 and 2 (SS-01 through SS-08) must be complete and E2E must pass 10/10 before starting Tier 3 items. SS-09 through SS-12 may be implemented concurrently within Tier 3.

---

## Intent

The active state detection in `CharacterSubNav` should use `startsWith` matching so that nested routes (e.g., `/character/123/skills`) are correctly highlighted against their parent nav item (e.g., `/character/123`). The root path `/` must not false-positive match all routes.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/components/shell/CharacterSubNav.tsx` | **VERIFICATION ONLY** — already uses `startsWith(to + '/')` guard at line 27. Confirm correct behavior; no code changes expected. |

> No other files should be modified. If any other file requires changes, escalate to human before proceeding.

---

## Implementation Steps

1. **Read** `src/components/shell/CharacterSubNav.tsx` in full before writing any code.
2. Locate the active state determination logic — look for a comparison like `pathname === navItem.path` or `location.pathname === item.href`.
3. Replace the exact equality check with `pathname.startsWith(navItem.path)`.
4. **Guard against false-positive root match:**
   - If any nav item has `path === '/'`, the `startsWith` check would match all routes.
   - Add a guard: if `navItem.path === '/'`, use exact equality (`pathname === '/'`) instead of `startsWith`.
   - Alternatively, sort nav items by path length descending before matching (longest path wins).
   - Choose the simplest approach that correctly handles the existing nav item set.
5. Run `tsc -b` — fix all type errors.
6. Spot-check: navigate to a nested route → correct parent nav item is highlighted. Navigate to `/` → only the home item (if any) is highlighted, not all items.
7. Commit with a descriptive message referencing Item 10.

---

## Acceptance Criteria

- [ ] **AC10.1** — Active sub-nav item is highlighted correctly when on a nested route under a nav item's path.
- [ ] **AC10.2** — No false-positive active states (e.g., `/` does not match all routes).
- [ ] **AC10.3** — `tsc -b` reports zero new type errors after this change.

---

## Verification Commands

```bash
# Type-check
tsc -b
```

**Manual spot-check checklist:**
- [ ] Navigate to `/character/123/skills` → the "Skills" (or parent) nav item is highlighted.
- [ ] Navigate to `/character/123/inventory` → the "Inventory" nav item is highlighted.
- [ ] Navigate to `/` → only the root nav item (if any) is highlighted; no others falsely active.
- [ ] Navigate between character sub-pages → active state transitions correctly with each route change.

---

## Constraints (Never Violate)

- No Dexie schema version bump.
- No new npm dependencies.
- No changes to `CharacterSubNav` prop interface (escalate if needed).
- All inline styles must use `var(--color-*)` CSS custom properties (no raw hex/rgb).

---

## Shortcuts

- This is a targeted logic change. Keep implementation minimal — replace the comparison, add the root guard, done.
- Commit after this item for bisectability.
