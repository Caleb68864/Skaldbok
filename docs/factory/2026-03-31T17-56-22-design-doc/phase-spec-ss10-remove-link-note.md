# Phase Spec — SS-10: Remove Link Note Feature
**Sub-Spec:** SPEC-B2-6
**Issue:** #14
**Batch:** 2 — Notes Overhaul
**Dependency:** SS-05 (Notes Grid in Session Screen) should be complete so there is a replacement for the navigation need that Link Note served.

> ⚠️ **OPEN QUESTION — HUMAN DECISION REQUIRED BEFORE FULL IMPLEMENTATION**
> **OQ-5:** What to do with existing `linked_to` data in Dexie.
> **Default if not answered:** Leave as orphaned data — do NOT delete or migrate.
> If the human provides a different migration decision, follow that instead.

---

## Intent
Remove all Link Note UI entry points from the application. The Notes Grid (SS-05) with session filtering replaces the functional need. Existing `linked_to` data in Dexie must NOT be deleted.

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Search & remove | All files containing Link Note UI entry points (search for `"LinkNote"`, `"link_note"`, `"linked_to"` UI rendering, "Link Note" strings in components) |
| Modify | `src/routes/index.tsx` — remove any Link Note route |
| **DO NOT TOUCH** | Dexie data layer — `linked_to` field in note records must be preserved |

---

## Implementation Steps

1. **Search** the codebase for all Link Note UI entry points using these patterns:
   - `LinkNote`
   - `link_note`
   - `"Link Note"` (string literal in JSX / UI text)
   - Any route path containing `link-note` or `linknote`
2. **Remove** each UI entry point found (buttons, menu items, drawer options, modal triggers).
3. **Remove** any Link Note route from `src/routes/index.tsx`.
4. **Do NOT delete** the `linked_to` field from any Dexie table, schema, or data access layer — only remove the UI. The underlying data must remain intact.
5. **Do NOT migrate** existing entity links unless human explicitly approves a migration strategy (see Open Question above).
6. Run `tsc --noEmit` to confirm no broken imports remain from removed UI components.

---

## Acceptance Criteria

- [ ] **B2-6-AC1:** Link Note feature is not accessible from any screen or menu.
- [ ] **B2-6-AC2:** Existing note data (including `linked_to` fields) is not deleted.

---

## Verification Commands

```bash
# TypeScript — must pass with zero errors
npx tsc --noEmit

# Confirm no Link Note UI text remains in rendered components
# (manual grep check): search for "Link Note" in src/ — should return 0 UI-facing results
```

---

## Cross-Cutting Constraints

- No new npm dependencies.
- **No Dexie schema changes** — data preservation is mandatory.
- Existing notes, sessions, campaigns, and characters must remain accessible.

---

## Escalation Triggers

Pause and request human input if:
- The Link Note data migration decision is needed before removing the UI (e.g., UI removal would orphan data in a way that breaks data integrity constraints).
- Removing Link Note UI causes TypeScript errors in the data/repository layer that would require schema changes to fix.
