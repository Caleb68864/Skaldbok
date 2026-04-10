# Phase Spec — SS-07: Tiptap Quick Note Fix
**Sub-Spec:** SPEC-B2-3
**Issue:** #11
**Batch:** 2 — Notes Overhaul
**Dependency:** None — implement FIRST within Batch 2 as a canary for Tiptap/React 19 compatibility.

> ⚠️ **IMPLEMENT THIS SPEC FIRST IN BATCH 2.** It is the canary test for Tiptap + React 19 compatibility. If this spec fails, escalate before proceeding with other Batch 2 specs.

---

## Intent
Fix the Quick Note drawer body field so it renders as a proper multi-line editor (≥200 px height) with a visible Tiptap toolbar. Add a plain `<textarea>` fallback if Tiptap fails to mount.

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Read & fix | `src/components/notes/TiptapNoteEditor.tsx` |
| Read & fix | `src/features/session/QuickNoteDrawer.tsx` (or the file containing the Quick Note drawer — search for "QuickNote" if path differs) |

---

## Implementation Steps

1. **Read** `src/components/notes/TiptapNoteEditor.tsx` in full.
2. **Identify** why the editor renders single-line in the Quick Note context. Common causes:
   - Missing `min-height` CSS on the editor container or the ProseMirror root element.
   - Editor config that enables a single-line mode.
   - Wrapper element with `overflow: hidden` and no height set.
3. **Fix** by adding `min-height: 200px` (or equivalent using `var(--space-*)` — prefer `var(--space-48)` or similar) to the editor container styles.
4. **Verify** the Tiptap **toolbar is visible** in the Quick Note drawer context (check z-index, overflow, and parent container clip rules).
5. **Add** a fallback: wrap the Tiptap editor in an `ErrorBoundary`. If Tiptap fails to mount (error boundary catches), render a plain `<textarea>` with the same `min-height: 200px` styling as a fallback.
6. Run `tsc --noEmit` — confirm no type errors.

---

## Acceptance Criteria

- [ ] **B2-3-AC1:** Quick Note drawer body field renders with min-height ~200 px.
- [ ] **B2-3-AC2:** Tiptap toolbar is visible in the Quick Note drawer.
- [ ] **B2-3-AC3:** If Tiptap fails to mount, a plain textarea fallback is shown.

---

## Verification Commands

```bash
# TypeScript — must pass with zero errors
npx tsc --noEmit
```

---

## Cross-Cutting Constraints

- Do NOT rebuild TiptapNoteEditor from scratch — fix in place.
- No new npm dependencies.
- All CSS via CSS variables — no hardcoded colors.

---

## Escalation Triggers

Pause and request human input if:
- Tiptap throws errors at runtime that cannot be resolved without updating the Tiptap package.
- The fix causes regressions in other places TiptapNoteEditor is used (full Note Editor, session notes, etc.).
