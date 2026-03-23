# Phase Spec: SS-09 — SheetScreen Dashboard Integration and Settings Panel Toggles

## Dependency Order
**Dependencies:** SS-03 (DraggableCardContainer), SS-04 (EquippedGearPanel), SS-05 (PinnedSkillsPanel), SS-06 (PreparedSpellsPanel), SS-07 (CustomNoteCard)
**Blocks:** None (this is the final integration sub-spec)

## Objective
Integrate all new panels into SheetScreen via DraggableCardContainer. Add "Sheet Panels" toggle section to SettingsScreen. Wire up panel order, visibility, and custom card management.

## Files to Modify
- `src/screens/SheetScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/theme/theme.css` — add integration styles if needed

## Acceptance Criteria
1. `[STRUCTURAL]` SheetScreen renders all core panels (Identity, Attributes, Conditions, Resources, Derived Values) at the top, followed by optional panels in the order specified by `character.uiState.sheetCardOrder`.
2. `[STRUCTURAL]` All panels are wrapped in `DraggableCardContainer`.
3. `[BEHAVIORAL]` Optional panels respect `character.uiState.sheetPanelVisibility` — hidden panels are not rendered but retain order position.
4. `[BEHAVIORAL]` Core panels cannot be hidden (they are always rendered regardless of visibility settings).
5. `[STRUCTURAL]` SettingsScreen gains a "Sheet Panels" section with toggle switches for: Equipped Gear, Pinned Skills, Prepared Spells.
6. `[BEHAVIORAL]` Toggling a panel off in Settings sets `sheetPanelVisibility[panelKey] = false` for the active character and persists.
7. `[BEHAVIORAL]` Toggling a panel on restores it to its previous position in the card order.
8. `[BEHAVIORAL]` Default visibility for new characters: all optional panels ON.
9. `[BEHAVIORAL]` When a new panel type first becomes relevant (e.g., first spell learned), it appears at the end of the card order.
10. `[STRUCTURAL]` Custom Note Cards are not in the Settings toggles (they are managed individually via add/delete on SheetScreen).
11. `[STRUCTURAL]` Settings toggles have ≥ 44px touch targets.

## Implementation Steps

### SheetScreen Integration
1. Open `src/screens/SheetScreen.tsx`.
2. Import all new panel components: `EquippedGearPanel`, `PinnedSkillsPanel`, `PreparedSpellsPanel`, `CustomNoteCard`, `AddNoteCardButton`, `DraggableCardContainer`.
3. Define the default panel order constant:
   ```ts
   const CORE_PANELS = ['identity', 'attributes', 'conditions', 'resources', 'derived-values'];
   const DEFAULT_OPTIONAL_ORDER = ['equipped-gear', 'pinned-skills', 'prepared-spells'];
   ```
4. Read `character.uiState?.sheetCardOrder` and `character.uiState?.sheetPanelVisibility`.
5. Build the panel list:
   - Core panels always come first in fixed order.
   - Optional panels are ordered by `sheetCardOrder`. Panels not in the array are appended at the end in default order.
   - Custom cards (`'custom-{id}'`) are included in their ordered position.
   - Panels with `sheetPanelVisibility[key] === false` are excluded from rendering.
   - Unknown keys in `sheetCardOrder` are silently skipped.
6. Map each panel key to its component:
   - `'identity'` → existing Identity section
   - `'attributes'` → existing Attributes section
   - `'conditions'` → existing Conditions section
   - `'resources'` → existing Resources section
   - `'derived-values'` → existing Derived Values section
   - `'equipped-gear'` → `<EquippedGearPanel />`
   - `'pinned-skills'` → `<PinnedSkillsPanel />`
   - `'prepared-spells'` → `<PreparedSpellsPanel />`
   - `'custom-{id}'` → `<CustomNoteCard card={...} />`
7. Wrap all panels in `<DraggableCardContainer>` with:
   - `panels` — the ordered panel list
   - `cardOrder` — current order from uiState
   - `panelVisibility` — current visibility from uiState
   - `isEditMode` — from app context
   - `onOrderChange` — handler that calls `updateCharacter({ uiState: { sheetCardOrder: newOrder } })`
8. Add custom card management handlers:
   - `handleAddCard` — creates new card, appends to `sheetCustomCards` and `sheetCardOrder`, persists.
   - `handleUpdateCard` — updates card in `sheetCustomCards`, persists.
   - `handleDeleteCard` — removes from `sheetCustomCards` and `sheetCardOrder`, persists.
9. In edit mode, render `<AddNoteCardButton onAdd={handleAddCard} />` at the bottom.
10. Ensure SheetScreen stays under 400 lines by delegating rendering to child panel components.

### SettingsScreen Integration
11. Open `src/screens/SettingsScreen.tsx`.
12. Add a "Sheet Panels" section with a heading/label.
13. Render toggle switches for:
    - "Equipped Gear" → controls `sheetPanelVisibility['equipped-gear']`
    - "Pinned Skills" → controls `sheetPanelVisibility['pinned-skills']`
    - "Prepared Spells" → controls `sheetPanelVisibility['prepared-spells']`
14. Toggle handler:
    - On toggle, update `character.uiState.sheetPanelVisibility[key]` and persist via `updateCharacter`.
    - Default state: ON (if `sheetPanelVisibility` is undefined or key is missing, treat as visible).
15. Use existing toggle/switch component pattern from Settings.
16. Ensure toggles have ≥ 44px touch targets.
17. Custom Note Cards are NOT listed here — they are managed on SheetScreen.

### Styling
18. Add any integration CSS to `theme.css` if needed (e.g., spacing between panels, add-card button positioning).
19. Ensure all three themes render correctly.

## Constraints
- SheetScreen must remain under 400 lines by delegating to child components.
- Settings uses existing toggle/card patterns.
- Core panels cannot be hidden or reordered relative to each other.
- Default visibility for all optional panels is ON.
- No new npm dependencies.
- Touch targets ≥ 44px on all Settings toggles.
- Persist all changes via `updateCharacter` through ActiveCharacterContext.

## Verification Commands
```bash
# Type-check
npx tsc --noEmit

# Build succeeds
npx vite build
```

## Verification Checklist
- [ ] SheetScreen renders core panels (Identity, Attributes, Conditions, Resources, Derived Values)
- [ ] Core panels cannot be toggled off
- [ ] Optional panels render in order from `sheetCardOrder`
- [ ] Optional panels respect `sheetPanelVisibility`
- [ ] All panels wrapped in `DraggableCardContainer`
- [ ] Drag reordering works in edit mode and persists
- [ ] Settings has "Sheet Panels" section
- [ ] Settings has toggles for Equipped Gear, Pinned Skills, Prepared Spells
- [ ] Toggling off hides panel but retains order position
- [ ] Toggling on restores previous position
- [ ] Default visibility is ON for new characters
- [ ] New panel types appear at end of order
- [ ] Custom Note Cards managed via add/delete on SheetScreen (not in Settings)
- [ ] Custom card add/update/delete handlers work correctly
- [ ] Unknown keys in `sheetCardOrder` silently skipped
- [ ] Settings toggles ≥ 44px touch targets
- [ ] SheetScreen under 400 lines
- [ ] All three themes render correctly
- [ ] `npx tsc --noEmit` passes
- [ ] `vite build` succeeds
