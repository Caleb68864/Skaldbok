# Phase Spec — SS-01: AttributeField Touch-Friendly Stepper Buttons

## Dependencies
None. This sub-spec can be implemented independently.

## Objective
Replace `<input type="number">` in `AttributeField.tsx` with a button-driven `[-] value [+]` counter in edit mode, and a static value display in play mode. Must match the `ResourceTracker` button styling pattern.

## Files to Modify
- `src/components/fields/AttributeField.tsx`

## Files to Read (Reference Only)
- `src/components/fields/ResourceTracker.tsx` — reference for `bigButtonStyle` pattern
- `src/screens/SheetScreen.tsx` — verify call sites remain compatible
- `src/types/character.ts` — confirm no type changes needed

## Acceptance Criteria
1. `[STRUCTURAL]` When `disabled` is false (edit mode), `AttributeField` renders a `<button>` for decrement, a `<span>` for the value, and a `<button>` for increment — no `<input type="number">` element.
2. `[STRUCTURAL]` When `disabled` is true (play mode), `AttributeField` renders only a `<span>` displaying the value — no buttons, no input.
3. `[BEHAVIORAL]` The decrement button calls `onChange(value - 1)` and is disabled when `value <= min`. The increment button calls `onChange(value + 1)` and is disabled when `value >= max`.
4. `[BEHAVIORAL]` Default min/max remain 3 and 18 respectively, matching Dragonbane attribute range.
5. `[STRUCTURAL]` Both stepper buttons have `minWidth` and `minHeight` of at least 48px, and the value span has `minWidth` of at least 40px with centered text.
6. `[STRUCTURAL]` Buttons use a style object consistent with `ResourceTracker`'s `bigButtonStyle` pattern: `var(--color-surface-alt)` background, `var(--color-border)` border, `var(--color-text)` color, `userSelect: 'none'`.
7. `[STRUCTURAL]` Each button has an `aria-label` attribute: "Decrease {abbreviation}" and "Increase {abbreviation}".
8. `[BEHAVIORAL]` Existing call sites in `SheetScreen.tsx` require zero changes — the `AttributeFieldProps` interface is unchanged.
9. `[STRUCTURAL]` Linked condition buttons below the attribute are unaffected — they render identically in both modes.

## Implementation Steps

1. **Read `ResourceTracker.tsx`** to extract the exact `bigButtonStyle` pattern (background, border, border-radius, font-size, color, cursor, userSelect).
2. **Read `AttributeField.tsx`** to understand the current structure, props interface, and how `disabled`, `value`, `min`, `max`, and `onChange` are used.
3. **Read `SheetScreen.tsx`** to confirm all call sites and ensure no interface changes are needed.
4. **Modify `AttributeField.tsx`**:
   - Remove the `<input type="number">` element.
   - Add a conditional render block:
     - **Edit mode (`!disabled`):** Render a horizontal flex container with:
       - A `<button>` with text `−` (minus sign), `onClick={() => onChange(value - 1)}`, `disabled={value <= min}`, `aria-label={`Decrease ${abbreviation}`}`, styled with `bigButtonStyle` pattern (min 48×48px).
       - A `<span>` displaying the current `value`, centered, `minWidth: '40px'`, `textAlign: 'center'`, `fontWeight: 'bold'`.
       - A `<button>` with text `+`, `onClick={() => onChange(value + 1)}`, `disabled={value >= max}`, `aria-label={`Increase ${abbreviation}`}`, styled identically.
     - **Play mode (`disabled`):** Render a `<span>` displaying the value, styled consistently with the edit mode value span.
   - Ensure the `min` prop defaults to `3` and `max` defaults to `18`.
   - Keep all linked condition rendering unchanged.
5. **Verify** that the `AttributeFieldProps` interface is completely unchanged.

## Edge Cases
- **Value at min boundary (3):** Decrement button is disabled (grayed out, click does nothing).
- **Value at max boundary (18):** Increment button is disabled.
- **min === max:** Both buttons disabled simultaneously.
- **No linkedConditions:** Renders cleanly with abbreviation + stepper/value only.
- **Rapid tapping:** Each tap is synchronous `onChange(value ± 1)`. React batches updates; no debounce needed.

## Constraints
- `AttributeFieldProps` interface MUST NOT change.
- `onChange` callback signature MUST remain identical.
- No new component files.
- No changes to `SheetScreen.tsx` call sites.
- No new npm dependencies.
- Prefer inline `React.CSSProperties` style objects (matching codebase pattern).

## Verification Commands
```bash
# Build must succeed
npx vite build

# Verify no <input type="number"> remains in AttributeField
grep -n "type.*number" src/components/fields/AttributeField.tsx
# Expected: no matches

# Verify buttons exist
grep -n "<button" src/components/fields/AttributeField.tsx
# Expected: 2 button elements (decrement, increment)

# Verify aria-labels exist
grep -n "aria-label" src/components/fields/AttributeField.tsx
# Expected: 2 matches (Decrease/Increase)

# Verify min/max defaults
grep -n "min.*=.*3" src/components/fields/AttributeField.tsx
grep -n "max.*=.*18" src/components/fields/AttributeField.tsx

# Verify SheetScreen has no changes
git diff src/screens/SheetScreen.tsx
# Expected: no diff (or only unrelated prior changes)
```
