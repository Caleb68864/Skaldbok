# Phase Spec — SS-01: TempModifier Type + CharacterRecord Schema Extension

**Run:** 2026-04-03T21-00-59-design-doc
**Sub-Spec ID:** SS-01
**Priority:** P0
**Dependency:** None — this is the foundation; all other sub-specs depend on this completing first.
**Effort:** ~30 min

---

## Objective

Extend `src/types/character.ts` with the `TempModifier`, `TempModifierEffect`, `StatKey`, and `SpellEffect` types. Add `tempModifiers` to `CharacterRecord` and `effects` to the `Spell` type. Base attribute values are **never mutated** — this is a pure overlay schema.

---

## Files to Modify

- `src/types/character.ts` — primary target

---

## Implementation Steps

1. **Add `StatKey` type export** near the top of the type definitions section:

```typescript
/** Flat stat key namespace resolved by getEffectiveValue() */
export type StatKey =
  | 'str' | 'con' | 'agl' | 'int' | 'wil' | 'cha'   // attributes
  | 'armor' | 'helmet'                                  // armor ratings
  | 'movement' | 'hpMax' | 'wpMax'                     // derived
  | string;                                              // skill IDs (e.g. "swords")
```

2. **Add `TempModifierEffect` interface export**:

```typescript
export interface TempModifierEffect {
  stat: StatKey;
  delta: number;   // positive = buff, negative = debuff
}
```

3. **Add `TempModifier` interface export**:

```typescript
export interface TempModifier {
  id: string;                   // nanoid or crypto.randomUUID()
  label: string;                // e.g. "Power Fist", "Stone Skin"
  effects: TempModifierEffect[];
  duration: 'round' | 'stretch' | 'shift' | 'scene' | 'permanent';
  sourceSpellId?: string;       // populated when created via spell quick-apply
  createdAt: string;            // ISO 8601 via nowISO()
}
```

4. **Add `SpellEffect` interface export**:

```typescript
/** Added to Spell type */
export interface SpellEffect {
  stat: StatKey;
  delta: number;
  duration: TempModifier['duration'];
}
```

5. **Extend `CharacterRecord`** — add this optional field (do not touch any existing fields):

```typescript
tempModifiers?: TempModifier[];   // undefined on old records → treated as [] at all read sites
```

6. **Extend `Spell` type** (the existing interface within `character.ts`) — add this optional field:

```typescript
effects?: SpellEffect[];   // optional — spells without this work unchanged
```

---

## Constraints

- Do **NOT** use Zod — `character.ts` uses plain TypeScript interfaces only
- Do **NOT** change `attributes`, `resources`, or any existing field types
- Do **NOT** add a migration — old records are handled by `?? []` at all read sites (no change needed here)
- All new types must be **exported** so other modules can import them

---

## Acceptance Criteria

- [ ] `TempModifier` is exported from `src/types/character.ts`
- [ ] `TempModifierEffect` is exported from `src/types/character.ts`
- [ ] `StatKey` is exported from `src/types/character.ts`
- [ ] `SpellEffect` is exported from `src/types/character.ts`
- [ ] `CharacterRecord.tempModifiers` is typed as `TempModifier[] | undefined`
- [ ] `Spell.effects` is typed as `SpellEffect[] | undefined`
- [ ] No existing fields on `CharacterRecord`, `Spell`, or any other type are modified
- [ ] `tsc --noEmit` passes with zero errors after this change

---

## Verification Commands

```
# After making changes, run TypeScript type check (no shell, run via project's existing tsc command):
tsc --noEmit
```

Expected output: zero errors. Any error in `src/types/character.ts` must be resolved before marking this sub-spec complete.

---

## Notes for Worker Agent

- Locate the existing `Spell` interface in `character.ts` — it may already have fields; add `effects` as the last optional field.
- `CharacterRecord` is likely a large interface — add `tempModifiers` as the last field to minimize diff noise.
- The `StatKey` union uses `| string` as a catch-all for skill IDs — this is intentional; TypeScript will still provide autocomplete for the named keys.
- Export AC-9 ("Export/import includes active modifiers in character JSON") is satisfied implicitly: because `tempModifiers` is typed on `CharacterRecord`, the existing export/import logic will include it with no additional changes.
