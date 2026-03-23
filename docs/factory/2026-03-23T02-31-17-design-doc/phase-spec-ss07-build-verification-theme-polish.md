# Phase Spec: SS-07 — Build Verification and Theme Polish

## Dependency Order
**Dependencies:** SS-02 (WeaponRackPanel), SS-03 (HeroicAbilityPanel), SS-04 (CombatScreen dashboard), SS-05 (Settings toggles), SS-06 (Gear editor fields)
**Depended on by:** None (final verification phase)

## Scope
Verify all new panels and features render correctly across all three themes. Ensure the app builds cleanly with `vite build`. Final touch-target audit. Fix any theme or build issues found.

## Files to Modify
- `src/theme/theme.css` (theme adjustments as needed)
- Any component files needing theme fixes (discovered during verification)

## Implementation Steps

1. Run `npx vite build` and verify zero errors.
2. Audit WeaponRackPanel in all three themes (dark, parchment, light):
   - Damage type badges are legible.
   - STR requirement badges (green/yellow/red) are distinguishable.
   - Damaged indicators are visible.
   - Fix any contrast or color issues in `theme.css`.
3. Audit HeroicAbilityPanel in all three themes:
   - Disabled/grayed Activate buttons are distinguishable from active buttons.
   - Requirement badges (green/red) are legible.
   - Fix any issues.
4. Audit Combat panel drag handles in all themes:
   - Handles are visible and distinguishable.
5. Audit Settings "Combat Panels" toggles in all themes:
   - Toggle states are clear.
6. Touch target audit:
   - Verify all new interactive elements (drag handles, Activate buttons, Mark Damaged/Repair buttons, editor controls, toggles) have >= 44px effective touch area.
   - Fix any undersized targets by adjusting padding/min-height in CSS.
7. Test portrait and landscape orientations:
   - Verify no panel layouts break on rotation.
   - Fix any overflow or wrapping issues.

## Acceptance Criteria

| # | Type | Criterion | REQ |
|---|------|-----------|-----|
| 1 | MECHANICAL | `vite build` succeeds with zero errors. | REQ-027 |
| 2 | BEHAVIORAL | WeaponRackPanel renders correctly in dark, parchment, and light themes — damage type badges, STR requirement badges, and damaged indicators are legible in all themes. | REQ-029 |
| 3 | BEHAVIORAL | HeroicAbilityPanel renders correctly in all three themes — disabled/grayed buttons are distinguishable from active buttons. | REQ-029 |
| 4 | BEHAVIORAL | Combat panel drag handles render correctly in all themes. | REQ-029 |
| 5 | BEHAVIORAL | Settings "Combat Panels" toggles render correctly in all themes. | REQ-029 |
| 6 | STRUCTURAL | All new interactive elements verified at >= 44px effective touch area. | REQ-028 |
| 7 | BEHAVIORAL | Rotating between portrait and landscape does not break any new panel layouts. | REQ-028 |

## Verification Commands
```bash
# Full build verification
npx vite build

# Type-check
npx tsc --noEmit

# Verify touch target minimums in CSS (search for min-height/min-width/padding patterns)
grep -n "min-height.*44\|min-width.*44\|touch-target" src/theme/theme.css

# Check no 'any' types were introduced
grep -rn ": any" src/components/panels/WeaponRackPanel.tsx src/components/panels/HeroicAbilityPanel.tsx src/components/fields/ShieldCard.tsx src/screens/CombatScreen.tsx src/screens/SettingsScreen.tsx src/screens/GearScreen.tsx
```

## Constraints
- This is a verification and polish phase — only fix issues found, don't add new features.
- No new npm dependencies.
- No `any` type.
- Cross-platform: works in Chrome, Safari, Firefox (mobile and desktop).
