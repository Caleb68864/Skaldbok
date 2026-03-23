# Phase Spec: SS-04 — CombatScreen Dashboard Integration — DraggableCardContainer and Panel Wiring

## Dependency Order
**Dependencies:** SS-01 (uiState fields), SS-02 (WeaponRackPanel), SS-03 (HeroicAbilityPanel)
**Depended on by:** SS-05, SS-07

## Scope
Refactor CombatScreen to wrap all panels (Resources, Weapon Rack, Heroic Abilities, Conditions, Death Rolls, Rest & Recovery) in the existing DraggableCardContainer component. Wire up per-character card order and visibility persistence.

## Files to Modify
- `src/screens/CombatScreen.tsx`
- `src/theme/theme.css` (if needed for dashboard layout adjustments)

## Implementation Steps

1. Open `src/screens/CombatScreen.tsx`.
2. Import `DraggableCardContainer` from `src/components/panels/DraggableCardContainer.tsx`.
3. Import `WeaponRackPanel` and `HeroicAbilityPanel`.
4. Define panel keys and default order:
   ```
   const DEFAULT_COMBAT_PANEL_ORDER = ['resources', 'weaponRack', 'heroicAbilities', 'conditions', 'deathRolls', 'restRecovery'];
   ```
5. Read `character.uiState.combatCardOrder` (fallback to default order if undefined).
6. Read `character.uiState.combatPanelVisibility` (fallback to all-visible if undefined).
7. Build a panel map: each key maps to its React component (existing panels for resources, conditions, deathRolls, restRecovery; new panels for weaponRack, heroicAbilities).
8. Wrap all panels in `DraggableCardContainer`:
   - Pass `cardOrder`, `onOrderChange` (writes to `character.uiState.combatCardOrder` via `updateCharacter`).
   - Filter out hidden panels based on `combatPanelVisibility`, but always include `'resources'`.
   - Panels not in `combatCardOrder` are appended at end in default order.
   - Panel keys in order with no matching component are silently skipped.
9. In edit mode, show drag handles on each panel.
10. Ensure Resources panel is always rendered regardless of visibility settings.
11. Delegate rendering to child components — CombatScreen must stay under 400 lines.
12. Verify existing functionality (HP/WP counters, condition toggles, death rolls, rest modals) continues to work.

## Acceptance Criteria

| # | Type | Criterion | REQ |
|---|------|-----------|-----|
| 1 | STRUCTURAL | CombatScreen renders all six panels wrapped in `DraggableCardContainer` with panel keys: `'resources'`, `'weaponRack'`, `'heroicAbilities'`, `'conditions'`, `'deathRolls'`, `'restRecovery'`. | REQ-001 |
| 2 | BEHAVIORAL | In edit mode, drag handles appear on each panel. Dragging reorders panels and writes new order to `character.uiState.combatCardOrder` via `updateCharacter()`. | REQ-001, REQ-002 |
| 3 | BEHAVIORAL | Panel order persists to IndexedDB and is restored on next load. | REQ-002 |
| 4 | BEHAVIORAL | Panel visibility respects `character.uiState.combatPanelVisibility` — hidden panels are not rendered but retain order position. | REQ-003 |
| 5 | BEHAVIORAL | The Resources panel (`'resources'` key) cannot be toggled off and is always rendered regardless of visibility settings. | REQ-023 |
| 6 | BEHAVIORAL | Default visibility for new characters (when `combatPanelVisibility` is undefined): all panels ON. | REQ-024 |
| 7 | BEHAVIORAL | Panels not present in the `combatCardOrder` array are appended at the end in default order. | REQ-001 |
| 8 | STRUCTURAL | CombatScreen delegates panel rendering to child components to stay under 400 lines. | — |
| 9 | STRUCTURAL | Drag handles have >= 44px touch targets. | REQ-028 |
| 10 | BEHAVIORAL | Existing Combat screen functionality (HP/WP counters, condition toggles, death rolls, rest modals) continues to work unchanged. | REQ-001 |

## Verification Commands
```bash
# Type-check
npx tsc --noEmit

# Verify CombatScreen stays under 400 lines
wc -l src/screens/CombatScreen.tsx

# Build check
npx vite build

# Verify DraggableCardContainer is imported
grep -n "DraggableCardContainer" src/screens/CombatScreen.tsx
```

## Edge Cases
- `combatCardOrder` undefined → all panels in default order.
- `combatPanelVisibility` undefined → all panels visible.
- Panel key in order array has no matching panel → silently skipped.
- New panel added in future → appears at end of card order if not in array.
- Resources panel forced off via direct data edit → code enforces always visible.
- DraggableCardContainer shared with Sheet → same component, different order/visibility arrays, no conflict.

## Constraints
- Reuses the existing DraggableCardContainer component — same as SheetScreen with a different order array.
- No external drag library.
- Must not break existing CombatScreen features.
- No new npm dependencies.
- No `any` type.
