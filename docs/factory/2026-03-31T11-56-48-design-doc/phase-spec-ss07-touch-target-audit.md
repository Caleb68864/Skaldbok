# Phase Spec — SS-07: Touch Target Audit

**Run:** 2026-03-31T11-56-48-design-doc
**Tier:** 2 (Features + Key UX)
**Item:** 7 of 12
**Assigned worker:** single agent — implements ONLY this sub-spec

> **Dependency:** Tier 1 items (SS-01 through SS-04) should be complete before starting Tier 2 items. SS-05 through SS-08 may be implemented concurrently within Tier 2.
> **Note:** SS-02 already audits touch targets inside the PartyPicker drawer. This item covers the remainder of the app. Coordinate to avoid double-patching the same elements.

---

## Intent

Every interactive element in the app meets the 44×44px minimum touch target requirement. This is a scan-driven audit — read all component files to identify violations, then fix them. Known violators: NoteItem action menu buttons, drawer open/close buttons, chip elements in `SessionQuickActions`.

---

## Files to Modify

Scan-driven. At minimum, audit and fix:

| File | Known Violation Area |
|------|---------------------|
| `src/features/notes/NoteItem.tsx` | Action menu buttons |
| `src/features/session/SessionQuickActions.tsx` | Chip elements (non-PartyPicker-drawer scope) |
| Any drawer open/close control components | Drawer toggle buttons |

Additional files may be identified during the audit. **If a fix requires modifying a file outside the known list, note it but proceed — this item is explicitly scan-driven.**

> If a fix would require changing a prop interface on `NoteItem`, `TiptapNoteEditor`, or `SessionQuickActions`: escalate to human before proceeding.

---

## Implementation Steps

1. **Audit phase — read files:**
   - Read `src/features/notes/NoteItem.tsx`.
   - Read `src/features/session/SessionQuickActions.tsx` (chip elements outside the PartyPicker drawer).
   - Read any shared drawer open/close button components.
   - Search for all `button` elements and `[role="button"]` patterns across `src/` to find additional violators.
   - Note: SS-02 already handles PartyPicker drawer internals — do not re-patch those elements.

2. **Fix phase — per violation:**
   - Add `minHeight: 44, minWidth: 44` as inline styles (or equivalent using `var(--spacing-*)` if defined, otherwise explicit `44` px values).
   - Do not alter layout flow — use `display: 'flex', alignItems: 'center', justifyContent: 'center'` if needed to prevent the element from shrinking below its min size.
   - Spot-check each fix at 360px: confirm no layout overflow or collapse.

3. **Known fixes (implement all):**
   - **NoteItem action menu buttons:** Add `minHeight: 44, minWidth: 44` to each action button (`edit`, `delete`, etc.).
   - **Chip elements in `SessionQuickActions`** (outside PartyPicker drawer): Ensure chips have `minHeight: 44`.
   - **Drawer open/close controls:** Any `button` that opens or closes a drawer must meet 44×44px.

4. Run `tsc -b` — fix all type errors before committing.
5. Spot-check every fixed element at 360px viewport.
6. Commit with a descriptive message referencing Item 7.

---

## Acceptance Criteria

- [ ] **AC7.1** — All `button` and `[role="button"]` elements have a rendered hit area ≥ 44×44px on a 360px viewport.
- [ ] **AC7.2** — NoteItem action menu buttons meet the ≥ 44×44px minimum.
- [ ] **AC7.3** — Drawer open/close controls meet the ≥ 44×44px minimum.
- [ ] **AC7.4** — Chip elements in `SessionQuickActions` (outside the PartyPicker drawer) meet the ≥ 44×44px minimum.
- [ ] **AC7.5** — No existing layouts overflow or collapse at 360px after touch target fixes.
- [ ] **AC7.6** — `tsc -b` reports zero new type errors after this change.

---

## Verification Commands

```bash
# Type-check
tsc -b
```

**Manual spot-check checklist (360px viewport):**
- [ ] Tap each NoteItem action button (edit/delete/etc.) → responds on first tap, no mis-taps.
- [ ] Tap drawer open/close buttons → open/close works reliably.
- [ ] Tap chips in SessionQuickActions → responds reliably.
- [ ] Inspect computed styles for each fixed element → `height` ≥ 44px, `width` ≥ 44px.
- [ ] Scroll through all screens at 360px → no layout overflow introduced.

---

## Constraints (Never Violate)

- No Dexie schema version bump.
- No new npm dependencies.
- All inline styles must use `var(--color-*)` / `var(--spacing-*)` CSS custom properties or explicit pixel values (no raw hex/rgb).
- Do not change prop interfaces on `NoteItem`, `TiptapNoteEditor`, or `SessionQuickActions` — escalate if needed.
- Do not re-patch elements already fixed by SS-02 (PartyPicker drawer internals).

---

## Shortcuts

- Use `minHeight: 44, minWidth: 44` as the standard fix pattern.
- Commit after this item for bisectability.
