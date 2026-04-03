# Phase Spec — SS-02: getEffectiveValue() Utility

**Run:** 2026-04-03T21-00-59-design-doc
**Sub-Spec ID:** SS-02
**Priority:** P0
**Dependency:** ⚠️ Requires SS-01 to be complete first. `TempModifier`, `StatKey`, and `CharacterRecord.tempModifiers` must be defined in `src/types/character.ts` before implementing this utility.
**Effort:** ~45 min

---

## Objective

Implement a pure utility function `getEffectiveValue()` in `src/utils/derivedValues.ts` that resolves a stat's effective value for a character by summing the base value plus all active modifier deltas for that stat. Returns a structured result object so callers can display a breakdown.

---

## Files to Modify

- `src/utils/derivedValues.ts` — add `EffectiveValueResult` interface and `getEffectiveValue()` function

---

## Implementation Steps

### Step 1 — Add the `EffectiveValueResult` interface

Add this export to `src/utils/derivedValues.ts`:

```typescript
export interface EffectiveValueResult {
  base: number;
  modifiers: Array<{ label: string; delta: number }>;
  effective: number;
  isModified: boolean;   // convenience — true if modifiers.length > 0
}
```

### Step 2 — Implement the stat key resolver (private helper)

Add a private `resolveBase` function inside the file:

```typescript
function resolveBase(stat: StatKey, character: CharacterRecord): number {
  // Attribute keys
  if (['str', 'con', 'agl', 'int', 'wil', 'cha'].includes(stat)) {
    return (character.attributes as Record<string, number>)?.[stat] ?? 0;
  }
  // Armor
  if (stat === 'armor') return character.armor?.rating ?? 0;
  if (stat === 'helmet') return character.helmet?.rating ?? 0;
  // Derived — delegate to getDerivedValue() so override precedence is respected
  if (stat === 'movement') return getDerivedValue('movement', character).effective;
  if (stat === 'hpMax')    return getDerivedValue('hpMax', character).effective;
  if (stat === 'wpMax')    return getDerivedValue('wpMax', character).effective;
  // Skill ID fallback
  const skills = character.skills as Record<string, { value?: number }> | undefined;
  if (skills && stat in skills) {
    return skills[stat]?.value ?? 0;
  }
  // Unrecognized
  console.warn('getEffectiveValue: unknown stat key', stat);
  return 0;
}
```

### Step 3 — Implement `getEffectiveValue()`

```typescript
export function getEffectiveValue(
  stat: StatKey,
  character: CharacterRecord
): EffectiveValueResult {
  const base = resolveBase(stat, character);
  const active = character.tempModifiers ?? [];
  const modifiers = active.flatMap(m =>
    m.effects
      .filter(e => e.stat === stat)
      .map(e => ({ label: m.label, delta: e.delta }))
  );
  const sum = modifiers.reduce((acc, m) => acc + m.delta, 0);
  return {
    base,
    modifiers,
    effective: base + sum,
    isModified: modifiers.length > 0,
  };
}
```

### Step 4 — Add required imports

Ensure the following are imported at the top of `derivedValues.ts`:
- `StatKey`, `TempModifier` (or just `CharacterRecord`) from `src/types/character.ts`
- `getDerivedValue` — should already exist in this file or be importable; if `getDerivedValue` is defined in the same file, no import is needed

**Escalation trigger:** If `getDerivedValue()` does not exist in this file and is not importable without circular dependency, escalate to human before proceeding.

---

## Stat Key Resolver Map

| Key | Extraction path |
|-----|----------------|
| `'str'` `'con'` `'agl'` `'int'` `'wil'` `'cha'` | `character.attributes[key] ?? 0` |
| `'armor'` | `character.armor?.rating ?? 0` |
| `'helmet'` | `character.helmet?.rating ?? 0` |
| `'movement'` | `getDerivedValue('movement', character).effective` |
| `'hpMax'` | `getDerivedValue('hpMax', character).effective` |
| `'wpMax'` | `getDerivedValue('wpMax', character).effective` |
| skill ID (e.g. `'swords'`) | `character.skills?.[key]?.value ?? 0` |
| unrecognized | `0` + `console.warn(...)` |

---

## Override Precedence Rule

For derived stats (`movement`, `hpMax`, `wpMax`), `getDerivedValue()` already applies any `DerivedOverrides` the user has set. Delegating to it means:

- **Override present:** base = override value (already baked in by `getDerivedValue`)
- **No override:** base = computed value
- **Modifier stacking:** `effective = base + sum(deltas)` in all cases

This is intentional and correct — overrides represent permanent user intent, temp modifiers are a temporary overlay on top.

---

## Constraints

- Function must be **pure** — no side effects, no mutations, no async
- `character.tempModifiers === undefined` must be handled gracefully (use `?? []`)
- Do **NOT** modify `getDerivedValue()` or any existing function signatures
- Do **NOT** cap modifier sum — multiple modifiers on the same stat stack additively with no limit
- If a stat key is unrecognized: return `{ base: 0, modifiers: [], effective: 0, isModified: false }` and log warning

---

## Acceptance Criteria

- [ ] `EffectiveValueResult` is exported from `src/utils/derivedValues.ts`
- [ ] `getEffectiveValue` is exported from `src/utils/derivedValues.ts`
- [ ] Returns `{ base, modifiers, effective, isModified }` for all stat keys in the resolver map
- [ ] Handles `character.tempModifiers === undefined` gracefully (defaults to `[]`)
- [ ] Multiple modifiers on the same stat are summed (no cap applied)
- [ ] For `movement`, `hpMax`, `wpMax`: uses `getDerivedValue()` to get base, respecting override precedence
- [ ] Unrecognized stat key: returns `base: 0`, logs `console.warn`, does not throw
- [ ] Function is pure — no side effects, no mutations
- [ ] `tsc --noEmit` passes after this change

---

## Verification Commands

```
tsc --noEmit
```

Expected: zero errors. Spot-check by tracing the import graph — `derivedValues.ts` must import from `character.ts` and not create a circular dependency.

---

## Notes for Worker Agent

- Before writing, read `src/utils/derivedValues.ts` in full to understand what `getDerivedValue()` looks like and what it already exports. This will inform exact import paths and whether any helper already exists.
- The `attributes` field on `CharacterRecord` may be a typed object (e.g. `{ str: number; con: number; ... }`) rather than a plain `Record<string, number>`. Adjust the accessor accordingly — you may be able to use a direct property access (`character.attributes?.str`) rather than dynamic bracket notation.
- `armor` and `helmet` may have different shapes than `{ rating: number }` — read `character.ts` first and adjust the resolver if the field names differ (e.g. `armorRating`, `bodyArmor.rating`, etc.).
