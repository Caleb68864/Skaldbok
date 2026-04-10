# Phase Spec — SS-06: Link Note — Hide When No Active Session

**Run:** 2026-03-31T11-56-48-design-doc
**Tier:** 2 (Features + Key UX)
**Item:** 6 of 12
**Assigned worker:** single agent — implements ONLY this sub-spec

> **Dependency:** Tier 1 items (SS-01 through SS-04) should be complete before starting Tier 2 items. SS-05 through SS-08 may be implemented concurrently within Tier 2.

---

## Intent

The "Link Note" button in `NotesScreen` is only meaningful when an active session exists. Render it conditionally: show only when an active session is active, and display muted explanation text when no session exists. If the session ends while the link-note drawer is open, close the drawer gracefully.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/screens/NotesScreen.tsx` | Modify — conditional render of "Link Note" button + muted explanation |

> No other files should be modified. If any other file requires changes, escalate to human before proceeding.

---

## Implementation Steps

1. **Read** `src/screens/NotesScreen.tsx` in full before writing any code.
2. Locate where `activeSession` is read from context. If not already read, add `const { activeSession } = useSessionContext()` (or equivalent).
3. **Conditional render:**
   - When `activeSession` is truthy: render the "Link Note" button as it currently exists.
   - When `activeSession` is falsy: do **not** render the "Link Note" button. Instead render muted explanation text (e.g., `"Start a session to link notes"`).
4. **Muted explanation styling:**
   - Use `color: 'var(--color-text-muted)'` (or equivalent CSS custom property) as an inline style.
   - Font size and spacing should match the surrounding UI — do not introduce new spacing variables.
5. **Drawer auto-close on session end:**
   - If the link-note drawer has local open/close state, add a `useEffect` that watches `activeSession`:
     - When `activeSession` becomes falsy (session ends), set the drawer open state to `false`.
   - This prevents the user from being stuck in an open drawer with no active session.
6. Run `tsc -b` — fix all type errors before committing.
7. Spot-check at 360px viewport: no active session → button absent, text visible. Start session → button appears.
8. Commit with a descriptive message referencing Item 6.

---

## Acceptance Criteria

- [ ] **AC6.1** — "Link Note" button is **absent from the DOM** when no active session exists.
- [ ] **AC6.2** — "Link Note" button is **present and functional** when an active session exists.
- [ ] **AC6.3** — Muted explanation text (e.g., `"Start a session to link notes"`) is visible when no active session exists.
- [ ] **AC6.4** — Drawer closes gracefully if the session ends while the link-note drawer is open.
- [ ] **AC6.5** — `tsc -b` reports zero new type errors after this change.

---

## Verification Commands

```bash
# Type-check
tsc -b
```

**Manual spot-check checklist (360px viewport):**
- [ ] No active session → "Link Note" button not in DOM, muted text visible.
- [ ] Start a session → "Link Note" button appears.
- [ ] Open link-note drawer while session is active → drawer opens normally.
- [ ] End session while drawer is open → drawer closes automatically, no error.
- [ ] No layout issues at 360px in either state (button present or absent).

---

## Constraints (Never Violate)

- No Dexie schema version bump.
- No new npm dependencies.
- No changes to `NotesScreen` prop interface.
- All inline styles must use `var(--color-*)` CSS custom properties (no raw hex/rgb).
- Touch targets ≥ 44×44px on all interactive elements.

---

## Shortcuts

- Use existing session context hook (already present in `NotesScreen.tsx` or its imports).
- Use `useToast()` from `context/ToastContext` for any error notifications (if needed).
- Commit after this item for bisectability.
