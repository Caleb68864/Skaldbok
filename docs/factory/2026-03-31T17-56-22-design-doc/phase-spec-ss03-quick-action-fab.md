# Phase Spec — SS-03: Global Quick-Action FAB
**Sub-Spec:** SPEC-B1-3
**Issue:** #10
**Batch:** 1 — Session UX Core
**Dependency:** SS-01 (PartyPicker extraction) should be complete first so FAB drawers can import PartyPicker.

---

## Intent
A floating dice button, visible on all screens, that opens the full quick-action menu when a session is active. When no session is active, it shows a warning toast instead.

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Read & refactor | `src/features/session/SessionQuickActions.tsx` |
| Create (extracted drawers) | `src/features/session/actions/SkillCheckDrawer.tsx` |
| Create (extracted drawers) | `src/features/session/actions/ShoppingDrawer.tsx` |
| Create (extracted drawers) | `src/features/session/actions/DamageDrawer.tsx` |
| Create (additional drawers) | `src/features/session/actions/{OtherDrawer}.tsx` (one file per remaining action type) |
| Create (new FAB) | `src/components/shell/QuickActionFAB.tsx` |
| Modify (mount FAB) | Root layout file (e.g., `src/App.tsx` or `src/components/shell/AppShell.tsx`) |
| Reference | `src/context/ToastContext.tsx` — `useToast().showToast(message, variant)` |
| Reference | `src/features/campaign/CampaignContext.tsx` — `useCampaign().activeSession` |
| Reference | `src/components/fields/PartyPicker.tsx` (from SS-01) |

---

## Implementation Steps

1. **Read** `src/features/session/SessionQuickActions.tsx` in full to identify all action drawer types present.
2. **Extract** each action drawer into its own file under `src/features/session/actions/`:
   - One file per drawer type.
   - Extract one drawer at a time; run `tsc --noEmit` after each extraction before proceeding.
   - Preserve all existing props and behavior exactly.
3. **Refactor** `SessionQuickActions.tsx` to compose the extracted drawers — session screen behavior must be unchanged.
4. **Create** `src/components/shell/QuickActionFAB.tsx`:
   - Fixed position, lower-left: `position: fixed; bottom: calc(var(--space-4) + 56px); left: var(--space-4)`
   - Dice icon button, minimum 44 px touch target (`var(--touch-target-min)`)
   - On press **with** active session: open quick-action menu/drawer listing all event types (reuse extracted drawers)
   - On press **without** active session: `showToast("Start a session first", "warning")`
5. **Mount** `<QuickActionFAB />` in the root layout (outside the route outlet) so it persists across all navigation routes. Do not mount it inside any single page component.
6. Verify FAB does not overlap critical UI on 375 px wide viewport — adjust `bottom` offset if needed.

---

## Acceptance Criteria

- [ ] **B1-3-AC1:** Dice FAB is visible on all screens (Characters, Session, Reference, character detail, etc.).
- [ ] **B1-3-AC2:** Tapping FAB with an active session opens the quick-action menu/drawer.
- [ ] **B1-3-AC3:** Tapping FAB with no active session shows toast `"Start a session first"` (warning variant).
- [ ] **B1-3-AC4:** All action drawers remain fully functional via Session screen (no regression).
- [ ] **B1-3-AC5:** FAB does not obscure critical UI elements at 375 px width.

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

---

## Escalation Triggers

Pause and request human input if:
- `SessionQuickActions.tsx` exceeds 500 lines and extraction of even one drawer risks breaking existing functionality — extract one drawer at a time and verify with tsc before continuing.
- Any drawer has undocumented dependencies that are difficult to isolate.
