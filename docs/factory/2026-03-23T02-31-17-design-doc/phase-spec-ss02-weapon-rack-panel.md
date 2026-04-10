# Phase Spec: SS-02 — WeaponRackPanel — Rich Weapon Display with STR Checks and Damage Combos

## Dependency Order
**Dependencies:** SS-01 (type fields for damageType, strRequirement, damaged, isShield)
**Depended on by:** SS-04, SS-07

## Scope
Create a new panel component that reads equipped weapons from character data and displays rich weapon cards with combined damage + bonus, STR requirement validation, durability tracking, damage type badges, and shield sub-cards.

## Files to Modify
- `src/components/panels/WeaponRackPanel.tsx` (NEW)
- `src/components/fields/ShieldCard.tsx` (NEW)
- `src/theme/theme.css` (add styles for weapon rack, badges, shield cards)

## Implementation Steps

1. Create `src/components/panels/WeaponRackPanel.tsx`:
   - Import character context, `computeDamageBonus`, `computeAGLDamageBonus` from `src/utils/derivedValues.ts`.
   - Read `character.weapons.filter(w => w.equipped)` to get equipped weapons.
   - Separate shields (`isShield === true`) from regular weapons.
   - For each regular weapon, render a card with:
     - Name, weapon type
     - Damage dice + computed damage bonus combined (e.g., "D8 + D4"). Use `computeDamageBonus` for melee, `computeAGLDamageBonus` for ranged. Omit bonus if "+0".
     - Grip (1H/2H), range, features list
     - Damage type badge (bludgeoning/slashing/piercing) — only if `damageType` is set
     - Durability rating + damaged status — only if `durability` is set. Green checkmark when OK, red "DAMAGED" badge when `damaged === true`.
     - STR requirement check — only if `strRequirement` is set:
       - Green checkmark: `STR >= requirement`
       - Yellow "Bane on attacks & parries": `STR < requirement && STR >= Math.ceil(requirement / 2)`
       - Red "Cannot use": `STR < Math.ceil(requirement / 2)`
   - In play mode, render "Mark Damaged" / "Repair" toggle buttons for weapons with durability.
   - Handle `damaged === undefined` as `false`.
   - Handle `isShield === undefined` as `false`.
   - Empty state: "No weapons equipped. Equip weapons on the Gear screen." with navigation affordance.

2. Create `src/components/fields/ShieldCard.tsx`:
   - Render shield-specific sub-card: name, durability, damaged status.
   - Include "Mark Damaged" / "Repair" buttons in play mode.
   - Visually distinct from regular weapon cards.

3. Wire up "Mark Damaged" / "Repair" actions:
   - "Mark Damaged" sets `weapon.damaged = true` via `updateCharacter()`.
   - "Repair" sets `weapon.damaged = false` via `updateCharacter()`.
   - Changes persist via ActiveCharacterContext autosave.

4. Add styles to `src/theme/theme.css`:
   - Weapon card layout, badge colors for damage types, STR check status colors (green/yellow/red).
   - Shield sub-card distinct styling.
   - Ensure all themes (dark, parchment, light) have legible badge colors.
   - All interactive elements >= 44px touch targets.

## Acceptance Criteria

| # | Type | Criterion | REQ |
|---|------|-----------|-----|
| 1 | STRUCTURAL | Panel reads `character.weapons.filter(w => w.equipped)` and renders a card for each equipped weapon. | REQ-008 |
| 2 | STRUCTURAL | Each weapon card displays: name, damage dice, combined damage bonus (e.g., "D8 + D4"), grip (1H/2H), range, and features list. | REQ-008 |
| 3 | BEHAVIORAL | Melee weapons show damage bonus from `computeDamageBonus(character)` (STR-based). Ranged weapons show bonus from `computeAGLDamageBonus(character)` (AGL-based). Bonus of "+0" is not displayed. | REQ-025 |
| 4 | STRUCTURAL | Damage type badge (bludgeoning/slashing/piercing) is shown only when `weapon.damageType` is set (not null/undefined). | REQ-009 |
| 5 | STRUCTURAL | Durability rating and damaged status are shown only when `weapon.durability` is set. Green checkmark for OK, red "DAMAGED" badge when `weapon.damaged === true`. | REQ-010 |
| 6 | BEHAVIORAL | STR requirement check: when `weapon.strRequirement` is set, compares against character's STR. Green if STR >= requirement. Yellow "Bane" if STR < requirement but >= Math.ceil(requirement/2). Red "Cannot use" if STR < Math.ceil(requirement/2). | REQ-011 |
| 7 | BEHAVIORAL | STR requirement display is skipped entirely when `weapon.strRequirement` is null or undefined. | REQ-012 |
| 8 | STRUCTURAL | Weapons with `isShield === true` render as distinct shield sub-cards showing name, durability, and damaged status — not as full weapon cards. | REQ-013 |
| 9 | BEHAVIORAL | In play mode, each non-shield weapon with durability has "Mark Damaged" / "Repair" toggle buttons. Shields also have these buttons. | REQ-014 |
| 10 | BEHAVIORAL | "Mark Damaged" sets `weapon.damaged = true`; "Repair" sets `weapon.damaged = false`. Changes persist via `updateCharacter()`. | REQ-031 |
| 11 | STRUCTURAL | When no weapons are equipped, shows empty state: "No weapons equipped. Equip weapons on the Gear screen." with tap-to-navigate. | REQ-032 |
| 12 | STRUCTURAL | Panel uses the existing SectionPanel or card styling pattern for visual consistency. | REQ-029 |
| 13 | STRUCTURAL | All interactive elements (damage/repair buttons) have >= 44px touch targets. | REQ-028 |

## Verification Commands
```bash
# Type-check
npx tsc --noEmit

# Verify files exist
ls src/components/panels/WeaponRackPanel.tsx
ls src/components/fields/ShieldCard.tsx

# Verify component stays under 400 lines
wc -l src/components/panels/WeaponRackPanel.tsx

# Build check
npx vite build
```

## Edge Cases
- No weapons equipped → empty state with navigation.
- All weapons damaged → all shown with red badges; buttons become "Repair".
- No STR requirement set → skip STR check display.
- No damage type set → don't show damage type badge.
- No durability value → don't show durability section or damaged state.
- Shield equipped → distinct shield sub-card.
- Weapon with +0 damage bonus → only show base damage dice.
- STR exactly at half requirement → `Math.ceil(requirement / 2)` boundary. Yellow "Bane" if equal, red below.
- `strRequirement` is 1 → half is 1, green if STR >= 1 (always passes).
- `damaged` undefined → treated as `false`.
- `isShield` undefined → treated as `false`.
- Ranged weapon with STR requirement → STR check applies, but damage uses AGL bonus.

## Constraints
- Read-only for weapon CRUD (adding/editing weapons is the Gear screen's responsibility).
- Equip/unequip is also the Gear screen's responsibility.
- Only damaged state toggling is allowed on the Combat screen.
- No new npm dependencies.
- No `any` type.
