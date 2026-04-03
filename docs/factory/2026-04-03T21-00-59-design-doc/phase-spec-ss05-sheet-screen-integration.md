# Phase Spec — SS-05: SheetScreen Integration

**Run:** 2026-04-03T21-00-59-design-doc
**Sub-Spec ID:** SS-05
**Priority:** P1
**Dependency:** ⚠️ Requires ALL of the following to be complete first:
- **SS-01** — `TempModifier` type and `CharacterRecord.tempModifiers` must exist
- **SS-02** — `getEffectiveValue()` must be implemented and exported
- **SS-03** — `BuffChipBar` component must exist at `src/components/panels/BuffChipBar.tsx`
- **SS-04** — `AddModifierDrawer` component must exist at `src/components/panels/AddModifierDrawer.tsx`

**Effort:** ~90 min

---

## Objective

Wire `BuffChipBar` into `SheetScreen` below the conditions row. Connect add/remove/clear-all modifier actions to `updateCharacter()`. Update attribute and derived value display fields to show effective values (via `getEffectiveValue()`) with a visual modifier indicator when active.

---

## Files to Modify

- `src/screens/SheetScreen.tsx` — primary target
- Potentially `AttributeField` component if it needs a new optional prop (see Step 5)

---

## Implementation Steps

### Step 1 — Read the existing SheetScreen

Read `src/screens/SheetScreen.tsx` in full before writing any code. Understand:
- How `updateCharacter()` is called and where it comes from (context vs. hook vs. prop)
- Where `nowISO()` is imported from
- Whether `crypto.randomUUID()` or `nanoid()` is already used elsewhere (prefer what the project already uses)
- Where conditions are currently rendered (this is where `BuffChipBar` goes — immediately below)
- How attributes are currently displayed (what component is used — `AttributeField`, `StatRow`, etc.)
- What derived values (`movement`, `hpMax`, `wpMax`) look like in the render tree

### Step 2 — Add local state for drawer

```typescript
const [addModifierOpen, setAddModifierOpen] = useState(false);
```

### Step 3 — Add modifier CRUD handlers

Add these handlers inside the SheetScreen component body (after state declarations):

```typescript
const handleAddModifier = (partial: Omit<TempModifier, 'id' | 'createdAt'>) => {
  const newMod: TempModifier = {
    ...partial,
    id: crypto.randomUUID(),   // or nanoid() — match what project uses elsewhere
    createdAt: nowISO(),
  };
  updateCharacter({ tempModifiers: [...(character.tempModifiers ?? []), newMod] });
};

const handleRemoveModifier = (id: string) => {
  updateCharacter({
    tempModifiers: (character.tempModifiers ?? []).filter(m => m.id !== id),
  });
};

const handleClearAllModifiers = () => {
  updateCharacter({ tempModifiers: [] });
};
```

### Step 4 — Place BuffChipBar in the render tree

Find the conditions row in the JSX. Immediately below it, add:

```tsx
<BuffChipBar
  modifiers={character.tempModifiers ?? []}
  onRemove={handleRemoveModifier}
  onClearAll={handleClearAllModifiers}
  onAdd={() => setAddModifierOpen(true)}
/>
```

Also add the `AddModifierDrawer` (can be at the bottom of the JSX before the closing tag):

```tsx
<AddModifierDrawer
  open={addModifierOpen}
  onClose={() => setAddModifierOpen(false)}
  onSave={handleAddModifier}
/>
```

### Step 5 — Update attribute display to show effective values

For each attribute field (`str`, `con`, `agl`, `int`, `wil`, `cha`) in the render tree:

1. Compute the effective value:
```typescript
const strResult = getEffectiveValue('str', character);
// repeat for con, agl, int, wil, cha
```

Or compute all at once into a map:

```typescript
const ATTR_KEYS = ['str', 'con', 'agl', 'int', 'wil', 'cha'] as const;
const effectiveAttrs = Object.fromEntries(
  ATTR_KEYS.map(k => [k, getEffectiveValue(k, character)])
);
```

2. Pass `effective` value to the display component instead of the raw attribute value.

3. **Visual modifier indicator:** When `isModified` is true, show a delta badge or color indicator. The approach depends on what `AttributeField` (or equivalent) accepts:

   - **Option A (preferred if safe):** Add an optional `modifierDelta?: number` prop to `AttributeField`. When provided and non-zero, display a small badge (e.g., `+2`) alongside the value and apply a color change (use `--color-accent` or equivalent token).
   - **Option B (if AttributeField is complex or widely shared):** Wrap the existing component rather than modifying it — render a `<div>` with position-relative, normal `AttributeField` inside, and a small `<span>` badge overlaid.

   **Escalation trigger:** If modifying `AttributeField` props would affect more than 2 other screens, escalate to human before modifying. Instead, use Option B.

4. When `modifierDelta` is zero or undefined, the component renders identically to today. Existing callers are unaffected.

### Step 6 — Update derived value display

For `movement`, `hpMax`, `wpMax` — wherever they are displayed on SheetScreen:

```typescript
const movementResult = getEffectiveValue('movement', character);
const hpMaxResult    = getEffectiveValue('hpMax', character);
const wpMaxResult    = getEffectiveValue('wpMax', character);
```

Pass `effective` value to the display and show indicator if `isModified`. Use the same pattern as Step 5.

### Step 7 — Add required imports

At the top of `SheetScreen.tsx`, add:
```typescript
import { BuffChipBar } from '../components/panels/BuffChipBar';
import { AddModifierDrawer } from '../components/panels/AddModifierDrawer';
import { getEffectiveValue } from '../utils/derivedValues';
import type { TempModifier } from '../types/character';
```

Adjust paths as needed based on actual file locations.

---

## Constraints

- Use **only** `updateCharacter()` for all modifier mutations — no direct state manipulation
- Do **NOT** mutate `character.attributes`, `character.resources`, or any base field
- `tempModifiers` is written as a complete array replacement (immutable update pattern)
- The `addModifierOpen` state is local to SheetScreen — not lifted to context
- Do NOT break existing rest flow — rest logic is handled in SS-06, not here

---

## Acceptance Criteria

- [ ] `BuffChipBar` renders below the conditions row on SheetScreen
- [ ] Tapping "+" in BuffChipBar opens `AddModifierDrawer`
- [ ] Saving in `AddModifierDrawer` calls `handleAddModifier` — new chip appears immediately in BuffChipBar
- [ ] Tapping Remove on a chip calls `handleRemoveModifier` — chip disappears
- [ ] Tapping "Clear All" calls `handleClearAllModifiers` — all chips disappear
- [ ] Attribute fields (`str`, `con`, `agl`, `int`, `wil`, `cha`) show **effective** value (base + modifier sum) when modifiers are active
- [ ] Attribute fields show a **visual indicator** (delta badge or color change) when modified
- [ ] Attribute fields revert to base value display when all modifiers removed (indicator disappears)
- [ ] Derived fields (`movement`, `hpMax`, `wpMax`) also show effective value + indicator when modified
- [ ] `updateCharacter()` is used for all mutations
- [ ] Autosave persists `tempModifiers` (verify via browser devtools IndexedDB — `tempModifiers` key present on character object)
- [ ] `tsc --noEmit` passes after this change

---

## Verification Steps

1. Run `tsc --noEmit` — expect zero errors
2. In browser: navigate to SheetScreen → BuffChipBar visible below conditions (shows only "+" chip initially)
3. Tap "+" → `AddModifierDrawer` opens
4. Enter label "Power Fist", set STR +2, duration Round → Save
5. Chip "Power Fist +2 · RND" appears in chip bar
6. STR attribute field now shows base+2 with visual indicator
7. Tap chip → expanded view → tap Remove → chip gone, STR reverts to base
8. Add 3 modifiers → tap "Clear All" → all gone
9. Reload page → modifiers persisted (IndexedDB check)

---

## Notes for Worker Agent

- The project uses `updateCharacter` — read SheetScreen to find exact invocation pattern. It may come from a hook (`useCharacter()`), context, or be passed as a prop.
- `nowISO()` is a utility function. Search `src/utils/` for it if not already imported in SheetScreen.
- For the ID generation, check what's already imported elsewhere (search for `nanoid` or `randomUUID` in the codebase). Prefer consistency.
- If attribute fields are rendered in a loop or via a config array, you may be able to integrate `getEffectiveValue` cleanly at that map site rather than per-field.
- Agent authority: You may also add `BuffChipBar` to `SkillsScreen` and `GearScreen` if it feels natural — but SheetScreen is the required minimum. SS-05 only gates on SheetScreen.
