# Phase Spec — SS-01: PartyPicker "For Who?" Fix
**Sub-Spec:** SPEC-B1-1
**Issue:** #2
**Batch:** 1 — Session UX Core
**Dependency:** None — implement first in Batch 1

---

## Intent
The multiSelect behavior exists in code but is not wired correctly in all quick-action contexts. Fix the wiring, not the component logic. Extract PartyPicker so it can be reused by the FAB action drawers (SS-03).

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Read & fix | `src/features/session/SessionQuickActions.tsx` |
| Create (extract) | `src/components/fields/PartyPicker.tsx` |

---

## Implementation Steps

1. **Read** `src/features/session/SessionQuickActions.tsx` (lines 91–184 per spec); trace the PartyPicker `multiSelect` prop and the "Party" button `onClick` handler to find the bug.
2. **Fix** the "Party" button toggle-all logic:
   - If **any** chip is unselected → select all party members
   - If **all** chips are selected → deselect all party members
3. **Verify** `multiSelect={true}` is passed for every quick action that has a "For Who?" step: Skill Check, Shopping, Damage, and any others present.
4. **Extract** PartyPicker into `src/components/fields/PartyPicker.tsx` (component, types, and any helper functions it needs).
5. **Update** the import in `SessionQuickActions.tsx` to point to the new location.
6. **Export** PartyPicker as a named export so SS-03 (QuickActionFAB) can import it.

---

## Acceptance Criteria

- [ ] **B1-1-AC1:** Tapping "Party" in PartyPicker selects all party member chips; tapping again deselects all.
- [ ] **B1-1-AC2:** Individual character chips are toggleable independently (multi-select, not radio behavior).
- [ ] **B1-1-AC3:** PartyPicker with `multiSelect` works in Skill Check, Shopping, and all quick actions with a "For Who?" step.
- [ ] **B1-1-AC4:** PartyPicker lives at `src/components/fields/PartyPicker.tsx` and is importable by other features.

---

## Verification Commands

```bash
# TypeScript — must pass with zero errors
npx tsc --noEmit

# Confirm extraction file exists
# (manual check: src/components/fields/PartyPicker.tsx exists and exports PartyPicker)
```

---

## Cross-Cutting Constraints (apply to all SS)

- No new npm dependencies.
- No Dexie schema version bump.
- All CSS via `var(--color-*)`, `var(--font-*)`, `var(--space-*)`, `var(--radius-*)` — no hardcoded colors.
- All touch targets ≥ 44 px (`var(--touch-target-min)`).

---

## Escalation Triggers

Pause and request human input if:
- PartyPicker exceeds 500 lines after extraction.
- The bug is in a shared primitive that would affect other features beyond PartyPicker.
