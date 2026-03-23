# Phase Spec: SS-06 — PreparedSpellsPanel

## Dependency Order
**Dependencies:** SS-01 (`spell.prepared` type), SS-02 (`computeMaxPreparedSpells`, `isMetalEquipped`)
**Blocks:** SS-09

## Objective
Create a compact dashboard panel that displays the character's prepared spells with WP cost, grayed/blocked status based on WP availability and metal equipment, and a preparation count header.

## Files to Modify
- `src/components/panels/PreparedSpellsPanel.tsx` — **new file**
- `src/theme/theme.css` — add panel-specific styles

## Acceptance Criteria
1. `[STRUCTURAL]` Panel header displays "Prepared X/Y" where X = count of spells with `prepared === true`, Y = `computeMaxPreparedSpells(character)`.
2. `[STRUCTURAL]` Each prepared spell displays: spell name, WP cost (base: 2 WP).
3. `[BEHAVIORAL]` Spells are dimmed/faded when `character.resources.wp.current < spell.wpCost` (insufficient WP).
4. `[BEHAVIORAL]` All spells show red/blocked styling when `isMetalEquipped(character)` returns `true`. Metal blocking takes visual precedence over WP dimming.
5. `[BEHAVIORAL]` Tapping a spell navigates to the Magic screen.
6. `[BEHAVIORAL]` Panel is completely hidden (not rendered) when the character has zero spells.
7. `[BEHAVIORAL]` If all spells are magic tricks, the panel shows tricks with a note "Magic tricks are always prepared" and no X/Y counter.
8. `[STRUCTURAL]` Panel uses compact styling suitable for a dashboard summary (not full spell detail).
9. `[BEHAVIORAL]` When character has spells but 0 WP: all spells are dimmed (not blocked). Metal blocking is separate from WP dimming.

## Implementation Steps
1. Create `src/components/panels/PreparedSpellsPanel.tsx`.
2. Import `computeMaxPreparedSpells` from `derivedValues.ts`, `isMetalEquipped` from `metalDetection.ts`, character type, and navigation.
3. Define props or read from context: character data.
4. Early return: if `character.spells?.length === 0` or `!character.spells`, return `null` (panel hidden).
5. Determine if all spells are magic tricks. If so, render trick-only view with "Magic tricks are always prepared" note and no X/Y counter.
6. Otherwise, compute:
   - `preparedSpells = character.spells.filter(s => s.prepared === true)`
   - `maxPrepared = computeMaxPreparedSpells(character)`
   - `metalBlocked = isMetalEquipped(character)`
   - `currentWP = character.resources?.wp?.current ?? 0`
7. Render header: "Prepared {preparedSpells.length}/{maxPrepared}".
8. Render each prepared spell:
   - Spell name + WP cost (base 2 WP for regular spells, 1 WP for magic tricks).
   - Apply CSS class `.spell-blocked` if `metalBlocked` (red/blocked styling, takes precedence).
   - Apply CSS class `.spell-dimmed` if `currentWP < wpCost` and NOT metal blocked.
9. Tapping a spell entry navigates to the Magic screen.
10. Add CSS to `theme.css`:
    - `.prepared-spells-panel` — compact card styling.
    - `.spell-blocked` — red/warning colors, themed.
    - `.spell-dimmed` — reduced opacity/faded.
    - `.spell-entry` — compact list item, tappable (≥ 44px).
    - Theme-aware via CSS custom properties.
11. Keep file under 400 lines.

## Constraints
- Read-only on the Sheet. Spell preparation toggling happens on MagicScreen only.
- Compact/summary display — not full spell detail.
- Uses `computeMaxPreparedSpells` and `isMetalEquipped` from their respective utility files.
- No new npm dependencies.
- Treat `spell.prepared === undefined` as `false` (backward compatibility).

## Verification Commands
```bash
# Type-check
npx tsc --noEmit

# Build succeeds
npx vite build
```

## Verification Checklist
- [ ] `PreparedSpellsPanel.tsx` exists in `src/components/panels/`
- [ ] Shows "Prepared X/Y" header with correct counts
- [ ] Lists prepared spells with name and WP cost
- [ ] Spells dimmed when WP insufficient
- [ ] All spells show red/blocked when metal equipped (takes precedence over dimming)
- [ ] Tapping a spell navigates to Magic screen
- [ ] Panel hidden when character has zero spells
- [ ] Magic-trick-only view shows "Magic tricks are always prepared" with no X/Y counter
- [ ] 0 WP dims spells but does not show blocked styling (unless metal)
- [ ] Compact dashboard-appropriate styling
- [ ] CSS added to `theme.css` with theme-aware properties
- [ ] File is under 400 lines
- [ ] `npx tsc --noEmit` passes
