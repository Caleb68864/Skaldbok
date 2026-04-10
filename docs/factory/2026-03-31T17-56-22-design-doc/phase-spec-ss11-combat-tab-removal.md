# Phase Spec — SS-11: Combat Tab Removal
**Sub-Spec:** SPEC-B3-1
**Issue:** #6
**Batch:** 3 — Character Sheet Cleanup
**Dependency:** None within Batch 3 (can run in parallel with SS-12). Complete Batch 1 and Batch 2 before starting Batch 3.

---

## Intent
Simplify the character sheet by removing the Combat tab. Redistribute its content (death rolls, rest actions) to the Sheet tab. HP/WP, conditions, and equipment that are already on Sheet/Gear do not need to move.

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Modify | `src/routes/index.tsx` — remove `/character/combat` route (add redirect or 404) |
| Modify | Character sub-nav component (search for the component rendering character tab navigation) |
| Modify | `src/features/character/SheetPage.tsx` (or equivalent) — add death rolls and rest actions |
| Identify & read | Current Combat tab content component (search for "CombatTab", "CombatPage", or the component for the `/character/combat` route) |

---

## Implementation Steps

1. **Read** the current Combat tab component to inventory all UI sections it contains.
2. **Identify** which content needs to move and where:
   - **Death Rolls UI** → move to `SheetPage.tsx`; render **conditionally** when character HP = 0.
   - **Rest Actions (Round/Stretch/Shift)** → move to `SheetPage.tsx` as a collapsible section (agent recommends placement above HP/WP section; **human approves final placement** — default: collapsible "Rest" section above HP/WP).
   - **HP/WP, conditions, equipment** → verify already present on Sheet or Gear; no move needed.
3. **Add** death rolls UI to `SheetPage.tsx` with a conditional render: `{character.hp === 0 && <DeathRolls />}`.
4. **Add** rest actions to `SheetPage.tsx` as a collapsible section using existing collapsible/accordion primitive.
5. **Remove** the Combat tab from the character sub-nav component.
6. **Remove** `/character/combat` route from `src/routes/index.tsx`; add a redirect to `/character` (sheet) or a 404 as appropriate.
7. Run `tsc --noEmit` to confirm no broken imports.

---

## Acceptance Criteria

- [ ] **B3-1-AC1:** `/character/combat` route returns 404 or redirects; Combat tab is absent from character sub-nav.
- [ ] **B3-1-AC2:** Rest actions (Round/Stretch/Shift) are accessible from the main Sheet screen.
- [ ] **B3-1-AC3:** Death rolls UI is visible on Sheet when character HP is 0.

---

## Open Question (Default Applied)

- **OQ-3:** Rest action placement defaults to a collapsible "Rest" section above HP/WP if human has not specified otherwise.

---

## Verification Commands

```bash
# TypeScript — must pass with zero errors
npx tsc --noEmit
```

---

## Cross-Cutting Constraints

- No new npm dependencies.
- No Dexie schema version bump.
- All CSS via CSS variables — no hardcoded colors.
- All touch targets ≥ 44 px.
- Existing character data must remain intact.

---

## Escalation Triggers

Pause and request human input if:
- The Combat tab component is >500 lines and redistribution of content risks breaking existing functionality.
- HP = 0 check depends on a field that is not currently stored in the character model.
