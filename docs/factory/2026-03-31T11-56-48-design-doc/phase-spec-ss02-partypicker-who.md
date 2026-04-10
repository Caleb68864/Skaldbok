# Phase Spec — SS-02: PartyPicker "Who?" Selection

**Run:** 2026-03-31T11-56-48-design-doc
**Tier:** 1 (Session Blockers)
**Item:** 2 of 12
**Assigned worker:** single agent — implements ONLY this sub-spec

> **Dependency:** None. This sub-spec has no prerequisites. May be implemented concurrently with other Tier 1 items.

---

## Intent

The "Who?" section of the PartyPicker drawer must be sticky at the top of the scroll container, pre-select the active character on open, and have correctly sized touch targets (≥ 44×44px) on all interactive elements.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/features/session/SessionQuickActions.tsx` | Modify — sticky "Who?" section, active character pre-selection, touch target fixes |

> No other files should be modified. If any other file requires changes, escalate to human before proceeding.

---

## Implementation Steps

1. **Read** `src/features/session/SessionQuickActions.tsx` in full before writing any code.
2. **Sticky "Who?" section:**
   - Locate the "Who?" section JSX inside the PartyPicker drawer scroll container.
   - Apply `position: 'sticky', top: 0` as inline styles to the "Who?" section wrapper element.
   - Ensure the scroll container (`overflow: 'auto'` or `overflow: 'scroll'`) is the scroll parent, not the viewport — sticky requires a scrolling ancestor.
3. **Pre-select active character:**
   - Read the active character ID from context (likely `ActiveCharacterContext` or equivalent).
   - On drawer open, initialize the selected member state to the active character's ID.
   - If no active character is set, fall back to `__self__` (the active character slot).
4. **Touch target audit (drawer scope only):**
   - Audit every `button`, `[role="button"]`, and tappable chip inside the PartyPicker drawer.
   - For each element with rendered size < 44×44px: add `minHeight: 44, minWidth: 44` (or equivalent using `var(--spacing-*)`) as inline styles.
5. **Edge cases:**
   - 0 party members: fall back to `__self__` — do not error or render an empty selection.
   - Duplicate names: append a subtle index suffix (e.g., `"Arin (2)"`) to distinguish members with the same display name.
6. Run `tsc -b` — fix all type errors before committing.
7. Spot-check on 360px viewport: open drawer, scroll, confirm "Who?" section stays pinned.
8. Commit with a descriptive message referencing Item 2.

---

## Acceptance Criteria

- [ ] **AC2.1** — "Who?" section remains visible when scrolling the PartyPicker drawer on a 360px viewport (sticky positioning works).
- [ ] **AC2.2** — Active character is pre-selected when the drawer opens.
- [ ] **AC2.3** — Every tappable element in the PartyPicker drawer meets the ≥ 44×44px minimum touch target.
- [ ] **AC2.4** — No data model changes introduced (no Dexie schema bump, no context shape change).
- [ ] **AC2.5** — `tsc -b` reports zero new type errors after this change.

**Edge cases:**
- 0 party members → falls back to `__self__`, no crash.
- Duplicate party member names → index suffix appended for disambiguation.

---

## Verification Commands

```bash
# Type-check
tsc -b
```

**Manual spot-check checklist (360px viewport):**
- [ ] Open PartyPicker drawer → "Who?" section is at the top.
- [ ] Scroll the drawer list downward → "Who?" section stays pinned at top.
- [ ] Drawer opens with active character already selected.
- [ ] Tap each button/chip inside drawer → hit areas feel responsive, ≥ 44px tall.
- [ ] Test with 0 party members → drawer renders without error.

---

## Constraints (Never Violate)

- No Dexie schema version bump.
- No new npm dependencies.
- No changes to `SessionQuickActions` prop interface (escalate if needed).
- All inline styles must use `var(--color-*)` / `var(--spacing-*)` CSS custom properties or explicit pixel values.
- Touch targets ≥ 44×44px.

---

## Shortcuts

- Use existing `chipStyle` pattern from `SessionQuickActions.tsx` for any chip UI.
- Use existing `Drawer` component from `components/primitives/Drawer` if a new drawer is needed.
- Commit after this item is complete for bisectability.
