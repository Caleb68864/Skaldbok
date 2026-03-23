# Phase 1: Rules Engine Fixes & Validation

**Run ID**: `2026-03-22T19-41-57-design-doc`
**Phase**: 1 of 4
**Sub-Specs**: SS-03 (Encumbrance Formula Fix), SS-09 (Rules Engine Validation)
**Priority**: P0 + P1
**Combined Score**: 15 / 100

---

## Dependencies

```
(none) ──→ Phase 1
Phase 1 ──→ Phase 2 (SS-02 depends on corrected encumbrance formula)
```

**Upstream**: None — this phase has no dependencies and can begin immediately.
**Downstream**: Phase 2 (SS-02 Armor/Helmet Forms) depends on the corrected encumbrance formula from SS-03.

---

## Rationale

Rules engine correctness is foundational. Fixing the encumbrance formula (SS-03) and validating all derived values (SS-09) must happen first because:
1. SS-02 (Armor Forms) feeds armor weight into encumbrance — the formula must be correct first.
2. SS-09 may reveal additional formula fixes beyond encumbrance that would affect other phases.
3. Both are small, surgical changes to a single file (`src/utils/derivedValues.ts`).

---

## Implementation Steps

### Step 1.1: Fix Encumbrance Formula (SS-03)

**File**: `src/utils/derivedValues.ts`

**Current code** (line ~47):
```ts
export function computeEncumbranceLimit(character: CharacterRecord): number {
  const override = character.derivedOverrides?.encumbranceLimit;
  if (override !== undefined && override !== null) return override;
  const str = character.attributes['str'] ?? 10;
  return Math.ceil(str / 2) + 5;
}
```

**Action**: Remove the `+ 5` from the return statement.

**Changed code**:
```ts
return Math.ceil(str / 2);
```

**Rule source**: Dragonbane Core Rules p. 46 — "Carrying capacity = STR / 2 (rounded up)"

### Step 1.2: Review Damage Bonus Thresholds (SS-09)

**File**: `src/utils/derivedValues.ts`

**Current code** (line ~37):
```ts
export function computeDamageBonus(character: CharacterRecord): string {
  const override = character.derivedOverrides?.damageBonus;
  if (override !== undefined && override !== null) return override;
  const str = character.attributes['str'] ?? 10;
  if (str >= 17) return '+D6';
  if (str >= 13) return '+D4';
  return '+0';
}
```

**Action**: Verify threshold values. The NPC attribute guidelines in the reference sheet say "+D4 roll against 14" which implies STR 14+ for +D4. The current code uses STR >= 13. If core rules confirm 13, keep as-is with a comment. If core rules say 14, change to `>= 14`.

**Decision guidance**: The NPC guidelines table describes inferring attributes FROM damage bonus (reverse lookup), not computing damage bonus from attributes. The Dragonbane core rules (p. 40) define: STR 13-16 → +D4, STR 17+ → +D6. The current thresholds (>=13 and >=17) match the core rules. Keep as-is but add clarifying comment.

### Step 1.3: Add Rule Source Comments (SS-09)

**File**: `src/utils/derivedValues.ts`

Add inline comments citing rule sources for every derived value function:

```ts
/** HP Max = CON attribute value. Dragonbane Core Rules p. 26. */
export function computeHPMax(character: CharacterRecord): number { ... }

/** WP Max = WIL attribute value. Dragonbane Core Rules p. 26. */
export function computeWPMax(character: CharacterRecord): number { ... }

/** Base movement = 10. Dragonbane Core Rules p. 44. */
export function computeMovement(character: CharacterRecord): number { ... }

/** Damage Bonus: STR 17+ → +D6, STR 13-16 → +D4, STR ≤12 → +0. Dragonbane Core Rules p. 40. */
export function computeDamageBonus(character: CharacterRecord): string { ... }

/** Encumbrance Limit = STR / 2 (rounded up). Dragonbane Core Rules p. 46. */
export function computeEncumbranceLimit(character: CharacterRecord): number { ... }
```

### Step 1.4: Add Skill Base-Chance Lookup (SS-09)

**File**: `src/utils/derivedValues.ts`

Add a new exported function for skill base-chance lookup (from `skill_level_base_chance` table in reference YAML):

```ts
/**
 * Skill base chance by attribute value.
 * Dragonbane Reference Sheet: skill_level_base_chance table.
 *   Attribute 1-5 → base chance 3
 *   Attribute 6-8 → base chance 4
 *   Attribute 9-12 → base chance 5
 *   Attribute 13-15 → base chance 6
 *   Attribute 16-18 → base chance 7
 */
export function getSkillBaseChance(attributeValue: number): number {
  if (attributeValue <= 5) return 3;
  if (attributeValue <= 8) return 4;
  if (attributeValue <= 12) return 5;
  if (attributeValue <= 15) return 6;
  return 7;
}
```

---

## Acceptance Criteria Checklist

| AC | Description | Verification |
|----|-------------|-------------|
| AC-03.1 | `computeEncumbranceLimit` returns `Math.ceil(STR / 2)` (no +5) | Read file, confirm formula |
| AC-03.2 | GearScreen encumbrance display reflects corrected formula | GearScreen calls `computeEncumbranceLimit` — no change needed there, auto-reflects |
| AC-03.3 | Encumbrance warning triggers at correct threshold | GearScreen compares totalWeight vs limit — triggers correctly with new formula |
| AC-03.4 | Characters with `derivedOverrides` for encumbrance still work | Override check is above formula — unchanged, still takes precedence |
| AC-09.1 | Damage bonus thresholds verified and documented | Add comment citing Core Rules p. 40, confirm >=17/>=13 correct |
| AC-09.2 | Skill base-chance lookup function exists | New `getSkillBaseChance()` function added |
| AC-09.3 | All derivedValues functions have inline comments citing rule source | Add JSDoc comments to all 5+ functions |
| AC-09.4 | Movement base value of 10 documented with source reference | Add comment: "Dragonbane Core Rules p. 44" |

---

## Verification Commands

```bash
# 1. Confirm encumbrance formula has no +5
grep -n "Math.ceil" src/utils/derivedValues.ts
# Expected: Math.ceil(str / 2) with NO + 5

# 2. Confirm all functions have rule source comments
grep -n "Core Rules\|Reference Sheet" src/utils/derivedValues.ts
# Expected: At least 5 matches (one per function)

# 3. Confirm getSkillBaseChance exists
grep -n "getSkillBaseChance" src/utils/derivedValues.ts
# Expected: function definition present

# 4. TypeScript compilation check
npx tsc --noEmit
# Expected: No errors

# 5. Build check
npm run build
# Expected: Build succeeds
```

---

## Risk Notes

- **Low risk**: Changes are confined to a single utility file with pure functions.
- **Side effect**: Characters created with the old +5 encumbrance formula may appear overloaded after the fix. This is correct behavior — the old formula was wrong.
- **No migration needed**: Encumbrance limit is computed, not stored.
