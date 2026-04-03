# Phase Spec — SS-07: Spell Quick-Apply

**Run:** 2026-04-03T21-00-59-design-doc
**Sub-Spec ID:** SS-07
**Priority:** P2
**Dependency:** ⚠️ Requires the following to be complete first:
- **SS-01** — `TempModifier`, `SpellEffect`, and `Spell.effects` must be defined in `src/types/character.ts`
- **SS-05** — `BuffChipBar` must be visible in SheetScreen; `updateCharacter()` modifier pattern must be established

**Effort:** ~30 min

---

## Objective

Extend the spell cast handler (wherever it lives — SheetScreen or a related hook/action) so that when a spell has `effects?: SpellEffect[]` defined, casting it automatically creates one or more `TempModifier` entries on the character. Spells without `effects` are completely unchanged.

---

## Files to Modify

- `src/screens/SheetScreen.tsx` — most likely location of the cast action; verify first
- Potentially a dedicated spell/action file if cast logic is extracted there

---

## Implementation Steps

### Step 1 — Locate the cast handler

Before writing any code, search `src/screens/SheetScreen.tsx` for where spell casting is handled. Look for:
- WP (Willpower) deduction on cast
- `spell.id` or `spell.name` usage
- `updateCharacter()` calls related to spells

If cast logic is in a separate file (e.g., `useSpellActions.ts`, `castSpell.ts`), implement there instead. The key requirement is that modifier creation happens **at the same call site** as WP deduction.

### Step 2 — Implement the groupBy helper (inline)

Do NOT add a new npm dependency (no lodash). Use this simple inline implementation:

```typescript
function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = acc[key] ? [...acc[key], item] : [item];
    return acc;
  }, {} as Record<string, T[]>);
}
```

Place this as a module-level helper (not inside the component) in the same file as the cast handler.

### Step 3 — Extend the cast handler

After the existing spell cast logic (WP deduction, logging, etc.), add:

```typescript
// Auto-create TempModifiers from spell effects
if (spell.effects && spell.effects.length > 0) {
  const byDuration = groupBy(spell.effects, e => e.duration);
  const newModifiers: TempModifier[] = Object.entries(byDuration).map(([dur, effs]) => ({
    id: crypto.randomUUID(),   // or nanoid() — match what project uses elsewhere
    label: spell.name,
    effects: effs.map(e => ({ stat: e.stat, delta: e.delta })),
    duration: dur as TempModifier['duration'],
    sourceSpellId: spell.id,
    createdAt: nowISO(),
  }));
  updateCharacter({
    tempModifiers: [...(character.tempModifiers ?? []), ...newModifiers],
  });
}
```

### Step 4 — Grouping rule examples

- **All same duration:** `[{ stat: 'str', delta: 2, duration: 'round' }, { stat: 'con', delta: 1, duration: 'round' }]`
  → Creates **one** `TempModifier` with two effects: `[{ stat: 'str', delta: 2 }, { stat: 'con', delta: 1 }]`, duration `'round'`

- **Mixed durations:** `[{ stat: 'str', delta: 2, duration: 'round' }, { stat: 'armor', delta: 1, duration: 'stretch' }]`
  → Creates **two** `TempModifier` entries: one for round (STR), one for stretch (armor)

### Step 5 — Add required imports

Add to the file containing the cast handler (if not already imported):
```typescript
import type { TempModifier } from '../types/character';
import { nowISO } from '../utils/time';   // adjust path as needed
```

---

## Constraints

- Do **NOT** add new npm dependencies — `groupBy` must be implemented inline
- Do **NOT** modify the existing cast logic (WP deduction, existing logging) — only append the modifier creation block after it
- Spells without `effects` (undefined or empty array) must be **completely unaffected** — the `if (spell.effects && spell.effects.length > 0)` guard handles this
- `sourceSpellId` must be set to `spell.id` on all auto-created modifiers
- `label` must default to `spell.name`
- Use `crypto.randomUUID()` or `nanoid()` — whichever is already used elsewhere in the project

---

## Acceptance Criteria

- [ ] Casting a spell with `effects` defined creates corresponding `TempModifier(s)` in `character.tempModifiers`
- [ ] `sourceSpellId` is populated with the spell's `id` on all auto-created modifiers
- [ ] `label` is set to `spell.name` on all auto-created modifiers
- [ ] Effects with **different** durations are grouped into separate `TempModifier` entries (one per distinct duration)
- [ ] Effects with the **same** duration are grouped into one `TempModifier` with multiple effects
- [ ] Casting a spell **without** `effects` creates no modifier (existing behavior unchanged)
- [ ] New modifiers appear in `BuffChipBar` immediately after cast (no page reload required)
- [ ] `tsc --noEmit` passes after this change

---

## Verification Steps

1. Run `tsc --noEmit` — expect zero errors
2. Add a spell definition with `effects: [{ stat: 'str', delta: 2, duration: 'round' }]`
3. Cast that spell → chip "SpellName +2 · RND" appears in `BuffChipBar` without manual entry
4. Cast a spell without `effects` → no modifier created, no chip appears
5. Add a spell with mixed durations → two chips appear (one per duration)
6. Verify `sourceSpellId` is set: check character in IndexedDB → `tempModifiers[n].sourceSpellId` matches spell id

---

## Notes for Worker Agent

- The `groupBy` helper uses `Record<string, T[]>` — TypeScript should infer this without issues. If you encounter type errors, add explicit generic parameters.
- `nowISO()` — search the codebase for its definition (likely in `src/utils/time.ts` or similar). If it doesn't exist, use `new Date().toISOString()` directly.
- If the cast handler is an async function, the modifier update can still be synchronous — `updateCharacter()` in this project appears to be synchronous (Dexie write) or returns a promise. Either way, await it if needed, but don't change the existing pattern.
- `spell.id` may not exist if spells don't have IDs — check the `Spell` type. If no `id` field exists on `Spell`, use `spell.name` as the `sourceSpellId` fallback (and note this as an issue in your result).
- This is a P2 sub-spec — it is low complexity and should not require architectural changes. If you find the cast handler is scattered across many places or doesn't exist as a single function, add a comment noting where you implemented it and why.
