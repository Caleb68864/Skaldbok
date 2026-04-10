# Phase Spec: SS-04 — EquippedGearPanel

## Dependency Order
**Dependencies:** SS-01 (metal type fields), SS-02 (`isMetalEquipped` utility)
**Blocks:** SS-09

## Objective
Create a read-only panel component that summarizes equipped weapons, armor, and helmet with damage/rating info and a conditional metal warning banner for the Sheet dashboard.

## Files to Modify
- `src/components/panels/EquippedGearPanel.tsx` — **new file**
- `src/theme/theme.css` — add panel-specific styles

## Acceptance Criteria
1. `[STRUCTURAL]` Panel displays each equipped weapon as: weapon name + damage die (e.g., "Sword: D8 slash").
2. `[STRUCTURAL]` Panel displays equipped armor as: armor name + armor rating (e.g., "Leather: AR 2").
3. `[STRUCTURAL]` Panel displays equipped helmet as: helmet name + AR (e.g., "Iron Helm: AR 1").
4. `[BEHAVIORAL]` If no weapons/armor/helmet are equipped, the corresponding row is omitted (not shown as empty).
5. `[STRUCTURAL]` A metal warning banner ("⚠ Metal equipped — spells blocked!") is displayed when `isMetalEquipped(character)` returns `true` AND the character has at least one spell.
6. `[BEHAVIORAL]` Metal warning banner is NOT shown if character has no spells (metal is irrelevant for non-casters).
7. `[BEHAVIORAL]` Tapping the panel (or a "View Gear" link) navigates to the Gear screen.
8. `[STRUCTURAL]` Panel is read-only in both play and edit mode (gear changes happen on the Gear screen).
9. `[STRUCTURAL]` Panel uses the existing `SectionPanel` or card styling pattern for visual consistency.

## Implementation Steps
1. Create `src/components/panels/EquippedGearPanel.tsx`.
2. Import `CharacterRecord` type, `isMetalEquipped` from `metalDetection.ts`, and the app's navigation mechanism (e.g., router link or navigation function).
3. Define props: `{ character: CharacterRecord }` (or read from context).
4. Render logic:
   - Filter weapons where `equipped === true`. For each, display `name: damageDie damageType`.
   - If armor is equipped, display `name: AR armorRating`.
   - If helmet is equipped, display `name: AR armorRating`.
   - Omit rows for unequipped categories.
5. Metal warning logic:
   - If `isMetalEquipped(character) && character.spells?.length > 0`, render a warning banner with "⚠ Metal equipped — spells blocked!" using a warning/alert style.
6. Navigation:
   - Add a tappable area or "View Gear" link that navigates to the Gear screen.
7. Use existing `SectionPanel` or card component wrapper for consistent styling.
8. Add CSS to `theme.css`:
   - `.metal-warning-banner` — warning colors (amber/red), themed via custom properties.
   - `.equipped-gear-panel` — consistent card styling.
   - Ensure all three themes look correct.
9. Panel is read-only — no edit affordances in either mode.

## Constraints
- Display-only component. No inline editing of equipment.
- Must use `isMetalEquipped` from `metalDetection.ts` (not inline checks).
- Uses existing card/SectionPanel styling pattern.
- No new npm dependencies.
- Touch target for "View Gear" link ≥ 44px.

## Verification Commands
```bash
# Type-check
npx tsc --noEmit

# Build succeeds
npx vite build
```

## Verification Checklist
- [ ] `EquippedGearPanel.tsx` exists in `src/components/panels/`
- [ ] Displays equipped weapon name + damage die
- [ ] Displays equipped armor name + AR
- [ ] Displays equipped helmet name + AR
- [ ] Omits rows for unequipped categories
- [ ] Shows metal warning when `isMetalEquipped` is true AND character has spells
- [ ] Hides metal warning when character has no spells
- [ ] Has navigation to Gear screen
- [ ] Read-only in both play and edit mode
- [ ] Uses existing card/SectionPanel styling
- [ ] CSS added to `theme.css` with theme-aware custom properties
- [ ] File is under 400 lines
- [ ] `npx tsc --noEmit` passes
