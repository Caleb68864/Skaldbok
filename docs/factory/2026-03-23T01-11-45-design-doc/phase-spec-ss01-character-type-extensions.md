# Phase Spec: SS-01 — Character Type Extensions

## Dependency Order
**Dependencies:** None (foundational — all other sub-specs depend on this)
**Blocks:** SS-02, SS-03, SS-04, SS-05, SS-06, SS-07, SS-08, SS-09

## Objective
Extend `CharacterRecord` and related types with new optional fields for spell preparation, equipment metal flags, and dashboard UI state. All new fields are optional to maintain backward compatibility with existing persisted characters.

## Files to Modify
- `src/types/character.ts`

## Acceptance Criteria
1. `[STRUCTURAL]` `Spell` interface gains optional fields: `prepared?: boolean`, `rank?: number` (1–3), `requirements?: string[]`, `castingTime?: 'action' | 'reaction' | 'ritual'`.
2. `[STRUCTURAL]` `Weapon` interface gains optional field: `metal?: boolean`.
3. `[STRUCTURAL]` `ArmorPiece` interface gains optional field: `metal?: boolean`.
4. `[STRUCTURAL]` `CharacterUiState` interface gains fields: `pinnedSkills?: string[]`, `sheetCardOrder?: string[]`, `sheetCustomCards?: CustomCard[]`, `sheetPanelVisibility?: Record<string, boolean>`.
5. `[BEHAVIORAL]` All new fields are optional (use `?:` syntax) so existing characters load without migration errors.
6. `[STRUCTURAL]` A `CustomCard` type or inline type is defined for `sheetCustomCards` entries with `id: string`, `title: string`, and `body: string` fields.
7. `[BEHAVIORAL]` The existing `powerLevel` field on `Spell` is preserved as-is (no breaking rename). The new `rank` field coexists alongside it.

## Implementation Steps
1. Open `src/types/character.ts`.
2. Locate the `Spell` interface (or equivalent type). Add optional fields: `prepared?: boolean`, `rank?: number`, `requirements?: string[]`, `castingTime?: 'action' | 'reaction' | 'ritual'`. Do NOT remove or rename the existing `powerLevel` field.
3. Locate the `Weapon` interface (or equivalent type). Add `metal?: boolean`.
4. Locate the `ArmorPiece` interface (or equivalent type for armor/helmet). Add `metal?: boolean`. If armor and helmet share a type, one addition covers both. If they are separate, add to both.
5. Define a `CustomCard` type: `export interface CustomCard { id: string; title: string; body: string; }`.
6. Locate or create the `CharacterUiState` interface. If `uiState` is currently typed inline on `CharacterRecord`, extract it to a named interface. Add: `pinnedSkills?: string[]`, `sheetCardOrder?: string[]`, `sheetCustomCards?: CustomCard[]`, `sheetPanelVisibility?: Record<string, boolean>`.
7. Ensure `CharacterRecord.uiState` uses the updated `CharacterUiState` type and remains optional (`uiState?: CharacterUiState`).
8. Verify no existing fields are removed, renamed, or made required.

## Constraints
- Additive only. No removal or rename of existing fields.
- No Dexie migration changes.
- All new fields must use `?:` optional syntax.
- Do not modify any files other than `src/types/character.ts`.

## Verification Commands
```bash
# Type-check the project (no runtime needed)
npx tsc --noEmit

# Build succeeds
npx vite build
```

## Verification Checklist
- [ ] `Spell` interface has `prepared?: boolean`
- [ ] `Spell` interface has `rank?: number`
- [ ] `Spell` interface has `requirements?: string[]`
- [ ] `Spell` interface has `castingTime?: 'action' | 'reaction' | 'ritual'`
- [ ] `Weapon` interface has `metal?: boolean`
- [ ] `ArmorPiece` (and/or helmet type) has `metal?: boolean`
- [ ] `CustomCard` type exists with `id`, `title`, `body` fields
- [ ] `CharacterUiState` has `pinnedSkills?: string[]`
- [ ] `CharacterUiState` has `sheetCardOrder?: string[]`
- [ ] `CharacterUiState` has `sheetCustomCards?: CustomCard[]`
- [ ] `CharacterUiState` has `sheetPanelVisibility?: Record<string, boolean>`
- [ ] Existing `powerLevel` field on `Spell` is unchanged
- [ ] All new fields are optional (`?:`)
- [ ] `npx tsc --noEmit` passes
