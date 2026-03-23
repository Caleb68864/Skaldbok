# Phase Spec: SS-02 — Derived Values and Metal Detection Utility

## Dependency Order
**Dependencies:** SS-01 (type definitions for `metal` flags and spell fields)
**Blocks:** SS-04, SS-06, SS-08

## Objective
Add `computeMaxPreparedSpells` to `derivedValues.ts` that returns INT base chance (3–7) for spell preparation limits. Create a standalone `isMetalEquipped` utility for cross-cutting metal detection.

## Files to Modify
- `src/utils/derivedValues.ts` — add `computeMaxPreparedSpells`
- `src/utils/metalDetection.ts` — **new file**, add `isMetalEquipped`

## Acceptance Criteria
1. `[BEHAVIORAL]` `computeMaxPreparedSpells(character)` returns the INT base chance using the existing `getSkillBaseChance` mapping: INT 1–5 → 3, INT 6–8 → 4, INT 9–12 → 5, INT 13–15 → 6, INT 16–18 → 7.
2. `[BEHAVIORAL]` If character has no INT attribute (edge case), defaults to base chance 5 (INT 10 equivalent).
3. `[BEHAVIORAL]` `isMetalEquipped(character)` returns `true` if any equipped weapon has `metal === true`, or equipped armor has `metal === true`, or equipped helmet has `metal === true`.
4. `[BEHAVIORAL]` `isMetalEquipped` returns `false` if no metal flags are set (backward compatibility — `undefined` treated as `false`).
5. `[BEHAVIORAL]` `isMetalEquipped` only checks currently equipped items (`equipped === true`), not all inventory items.
6. `[STRUCTURAL]` Both functions are exported and importable by panel components and MagicScreen.
7. `[STRUCTURAL]` Both functions are pure (no side effects, no context dependency) — they take a `CharacterRecord` and return a value.

## Implementation Steps
1. Open `src/utils/derivedValues.ts`.
2. Locate the existing `getSkillBaseChance` function (or equivalent mapping from attribute value to base chance 3–7).
3. Add and export `computeMaxPreparedSpells(character: CharacterRecord): number`:
   - Extract the character's INT attribute value.
   - Pass it through `getSkillBaseChance` to get the base chance (3–7).
   - If INT is undefined/missing, default to 5 (equivalent to INT 10).
   - Return the result.
4. Create new file `src/utils/metalDetection.ts`.
5. Import `CharacterRecord` from `src/types/character.ts`.
6. Export `isMetalEquipped(character: CharacterRecord): boolean`:
   - Check equipped weapons array: `character.weapons?.filter(w => w.equipped).some(w => w.metal === true)`.
   - Check armor: `character.armor?.equipped && character.armor?.metal === true`.
   - Check helmet: `character.helmet?.equipped && character.helmet?.metal === true`.
   - Return `true` if any of the above is true, else `false`.
   - Handle undefined/missing fields gracefully (all default to `false`).
7. Adapt the exact property access patterns to match the actual `CharacterRecord` structure discovered in SS-01.

## Constraints
- `computeMaxPreparedSpells` must reuse the existing `getSkillBaseChance` function, not duplicate the mapping.
- `isMetalEquipped` goes in a separate utility file (`metalDetection.ts`) to keep `derivedValues.ts` focused.
- Both functions must be pure — no React hooks, no context, no side effects.
- No new npm dependencies.

## Verification Commands
```bash
# Type-check
npx tsc --noEmit

# Build succeeds
npx vite build
```

## Verification Checklist
- [ ] `computeMaxPreparedSpells` exists and is exported from `derivedValues.ts`
- [ ] Returns 3 for INT 1–5
- [ ] Returns 4 for INT 6–8
- [ ] Returns 5 for INT 9–12
- [ ] Returns 6 for INT 13–15
- [ ] Returns 7 for INT 16–18
- [ ] Returns 5 when INT attribute is missing
- [ ] `isMetalEquipped` exists and is exported from `metalDetection.ts`
- [ ] Returns `true` when any equipped weapon has `metal === true`
- [ ] Returns `true` when equipped armor has `metal === true`
- [ ] Returns `true` when equipped helmet has `metal === true`
- [ ] Returns `false` when no metal flags set or items have `metal: undefined`
- [ ] Only checks equipped items, not entire inventory
- [ ] Both functions are pure (no hooks, no context)
- [ ] `npx tsc --noEmit` passes
