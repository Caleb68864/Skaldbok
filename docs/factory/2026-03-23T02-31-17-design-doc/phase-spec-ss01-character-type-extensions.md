# Phase Spec: SS-01 — Character Type Extensions

## Dependency Order
**Dependencies:** None (foundational — all other sub-specs depend on this)
**Depended on by:** SS-02, SS-03, SS-04, SS-05, SS-06, SS-07

## Scope
Extend `Weapon`, `HeroicAbility`, `ArmorPiece`, and `CharacterUiState` types with new optional fields for combat dashboard features. All new fields are optional to maintain backward compatibility with existing persisted characters.

## Files to Modify
- `src/types/character.ts`

## Implementation Steps

1. Open `src/types/character.ts` and locate the `Weapon` interface.
2. Add optional fields to `Weapon`:
   - `damageType?: 'bludgeoning' | 'slashing' | 'piercing' | null`
   - `strRequirement?: number | null`
   - `damaged?: boolean`
   - `isShield?: boolean`
3. Locate the `HeroicAbility` interface.
4. Add optional fields to `HeroicAbility`:
   - `wpCost?: number`
   - `requirement?: string | null`
   - `requirementSkillId?: string | null`
   - `requirementSkillLevel?: number | null`
5. Locate the `ArmorPiece` interface.
6. Add optional field to `ArmorPiece`:
   - `metal?: boolean`
7. Locate the `CharacterUiState` interface.
8. Add optional fields to `CharacterUiState`:
   - `combatCardOrder?: string[]`
   - `combatPanelVisibility?: Record<string, boolean>`
9. Verify all new fields use `?:` (optional) syntax.
10. Verify the existing `durability` field on `Weapon` is unchanged and the new `damaged` field coexists alongside it.

## Acceptance Criteria

| # | Type | Criterion | REQ |
|---|------|-----------|-----|
| 1 | STRUCTURAL | `Weapon` interface gains optional fields: `damageType?: 'bludgeoning' \| 'slashing' \| 'piercing' \| null`, `strRequirement?: number \| null`, `damaged?: boolean`, `isShield?: boolean`. | REQ-004 |
| 2 | STRUCTURAL | `HeroicAbility` interface gains optional fields: `wpCost?: number`, `requirement?: string \| null`, `requirementSkillId?: string \| null`, `requirementSkillLevel?: number \| null`. | REQ-005 |
| 3 | STRUCTURAL | `ArmorPiece` interface gains optional field: `metal?: boolean`. | REQ-006 |
| 4 | STRUCTURAL | `CharacterUiState` interface gains fields: `combatCardOrder?: string[]`, `combatPanelVisibility?: Record<string, boolean>`. | REQ-007 |
| 5 | BEHAVIORAL | All new fields use `?:` syntax so existing characters load without migration errors. | REQ-026 |
| 6 | BEHAVIORAL | The existing `durability` field on `Weapon` is preserved as-is. The new `damaged` field coexists alongside it (durability = max rating, damaged = boolean broken state). | REQ-004 |

## Verification Commands
```bash
# Type-check the project
npx tsc --noEmit

# Verify the fields exist in the type file
grep -n "damageType" src/types/character.ts
grep -n "strRequirement" src/types/character.ts
grep -n "damaged" src/types/character.ts
grep -n "isShield" src/types/character.ts
grep -n "wpCost" src/types/character.ts
grep -n "requirementSkillId" src/types/character.ts
grep -n "requirementSkillLevel" src/types/character.ts
grep -n "metal" src/types/character.ts
grep -n "combatCardOrder" src/types/character.ts
grep -n "combatPanelVisibility" src/types/character.ts
```

## Constraints
- Additive only. No removal or rename of existing fields.
- No Dexie migration changes.
- No `any` type in TypeScript.
