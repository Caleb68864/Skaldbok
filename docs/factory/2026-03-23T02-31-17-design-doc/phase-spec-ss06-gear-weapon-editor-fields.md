# Phase Spec: SS-06 — Gear Screen Weapon Editor — New Fields for STR Requirement, Damage Type, Damaged, Shield

## Dependency Order
**Dependencies:** SS-01 (type fields)
**Depended on by:** SS-07

## Scope
Extend the Gear screen's weapon drawer editor to include new fields for STR requirement, damage type, damaged state, and isShield flag. These fields populate the data that WeaponRackPanel displays.

## Files to Modify
- `src/screens/GearScreen.tsx`
- `src/components/fields/WeaponCard.tsx` (if weapon cards on Gear screen show any of the new fields)

## Implementation Steps

1. Open `src/screens/GearScreen.tsx` and locate the weapon editor drawer.
2. Add a "Damage Type" selector:
   - Options: None (null), Bludgeoning, Slashing, Piercing.
   - Saves to `weapon.damageType`.
   - Use a select/dropdown or segmented control matching existing editor patterns.
3. Add a "STR Requirement" number input:
   - Saves to `weapon.strRequirement`.
   - Empty or zero value treated as null (no requirement).
4. Add a "Shield" toggle:
   - When enabled, sets `weapon.isShield = true`.
   - When disabled, sets `weapon.isShield = false`.
5. Add a "Damaged" toggle:
   - Saves to `weapon.damaged`.
   - For quick marking in the editor (Combat screen also has Mark Damaged / Repair).
6. Ensure all new fields default to null/false/undefined for newly created weapons.
7. Ensure existing weapons without the new fields load and edit without errors — undefined fields treated as defaults.
8. All new editor fields have >= 44px touch targets.
9. Verify that saving a weapon with new fields persists correctly and data is immediately available on Combat screen's WeaponRackPanel.

## Acceptance Criteria

| # | Type | Criterion | REQ |
|---|------|-----------|-----|
| 1 | STRUCTURAL | Weapon editor drawer includes a "Damage Type" selector with options: None, Bludgeoning, Slashing, Piercing. Saves to `weapon.damageType`. | REQ-004, REQ-009 |
| 2 | STRUCTURAL | Weapon editor drawer includes a "STR Requirement" number input. Saves to `weapon.strRequirement`. Empty/zero treated as null. | REQ-004, REQ-011 |
| 3 | STRUCTURAL | Weapon editor drawer includes a "Shield" toggle. When enabled, sets `weapon.isShield = true`. | REQ-004, REQ-013 |
| 4 | STRUCTURAL | Weapon editor drawer includes a "Damaged" toggle. Saves to `weapon.damaged`. | REQ-004, REQ-010 |
| 5 | BEHAVIORAL | New fields default to null/false/undefined for newly created weapons. | REQ-026 |
| 6 | BEHAVIORAL | Existing weapons without the new fields load and edit without errors — undefined fields are treated as their default values. | REQ-026 |
| 7 | STRUCTURAL | All new editor fields have >= 44px touch targets. | REQ-028 |
| 8 | BEHAVIORAL | Saving a weapon with new fields persists correctly and the data is immediately available on the Combat screen's WeaponRackPanel. | REQ-008 |

## Verification Commands
```bash
# Type-check
npx tsc --noEmit

# Verify new fields are referenced in GearScreen
grep -n "damageType" src/screens/GearScreen.tsx
grep -n "strRequirement" src/screens/GearScreen.tsx
grep -n "isShield" src/screens/GearScreen.tsx
grep -n "damaged" src/screens/GearScreen.tsx

# Build check
npx vite build
```

## Constraints
- The weapon editor is on the Gear screen, not the Combat screen.
- Combat screen only has quick "Mark Damaged" / "Repair" toggles.
- Full weapon CRUD stays on Gear.
- No new npm dependencies.
- No `any` type.
