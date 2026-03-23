# Phase Spec: SS-05 — Settings Screen — Combat Panels Toggle Section

## Dependency Order
**Dependencies:** SS-01 (uiState fields), SS-04 (CombatScreen reads visibility)
**Depended on by:** SS-07

## Scope
Add a "Combat Panels" section to the Settings screen with toggles for each optional combat panel. Toggling writes to the active character's `combatPanelVisibility`.

## Files to Modify
- `src/screens/SettingsScreen.tsx`
- `src/theme/theme.css` (if needed for toggle section styling)

## Implementation Steps

1. Open `src/screens/SettingsScreen.tsx`.
2. Add a "Combat Panels" section (similar to existing "Sheet Panels" section from prior factory run).
3. Define the list of toggleable combat panels:
   - Weapon Rack (`weaponRack`)
   - Heroic Abilities (`heroicAbilities`)
   - Conditions (`conditions`)
   - Death Rolls (`deathRolls`)
   - Rest & Recovery (`restRecovery`)
   - NOTE: Resources is NOT in this list (always visible).
4. For each panel, render a toggle switch:
   - Read current state from `character.uiState.combatPanelVisibility[panelKey]` (default `true` if undefined).
   - On toggle off: set `combatPanelVisibility[panelKey] = false` via `updateCharacter()`.
   - On toggle on: set `combatPanelVisibility[panelKey] = true` via `updateCharacter()`.
5. If no character is active, hide or disable the "Combat Panels" section with a message like "Select a character to configure combat panels."
6. Ensure toggle switches have >= 44px touch targets.
7. Add any needed CSS to `src/theme/theme.css` for the section — should follow existing toggle/card patterns.

## Acceptance Criteria

| # | Type | Criterion | REQ |
|---|------|-----------|-----|
| 1 | STRUCTURAL | SettingsScreen gains a "Combat Panels" section with toggle switches for: Weapon Rack, Heroic Abilities, Conditions, Death Rolls, Rest & Recovery. | REQ-022 |
| 2 | BEHAVIORAL | Toggling a panel off sets `combatPanelVisibility[panelKey] = false` for the active character and persists via `updateCharacter()`. | REQ-003, REQ-022 |
| 3 | BEHAVIORAL | Toggling a panel on sets `combatPanelVisibility[panelKey] = true`. Panel restores to its previous position in the card order. | REQ-003 |
| 4 | STRUCTURAL | Resources panel is NOT in the toggle list (it cannot be hidden). | REQ-023 |
| 5 | BEHAVIORAL | Default state: all toggles ON for characters without existing `combatPanelVisibility`. | REQ-024 |
| 6 | STRUCTURAL | Toggle switches have >= 44px touch targets. | REQ-028 |
| 7 | BEHAVIORAL | If no character is active, the "Combat Panels" section is hidden or disabled with a message. | REQ-022 |

## Verification Commands
```bash
# Type-check
npx tsc --noEmit

# Verify the section exists
grep -n "Combat Panels" src/screens/SettingsScreen.tsx

# Verify panel keys are referenced
grep -n "combatPanelVisibility" src/screens/SettingsScreen.tsx

# Build check
npx vite build
```

## Constraints
- Uses existing toggle/card patterns from Settings.
- Follows the same pattern as "Sheet Panels" section from the prior factory run.
- No new npm dependencies.
- No `any` type.
