# Phase Spec — SS-03: Conditions Adjacent to Linked Attributes

**Run:** `2026-03-22T22-18-21-design-doc`
**Sub-Spec:** SS-3
**Score:** 7 / 10
**Dependencies:** SS-1 (Responsive Multi-Column Sheet Layout)

---

## Dependency Order

> **Depends on SS-1.** The responsive grid established in SS-1 must be in place before implementing this sub-spec. The combined attribute+condition cells must respect the 2-column grid and wrap gracefully on narrow viewports.

---

## Intent

Each condition in Dragonbane is linked to a specific attribute (e.g., Exhausted → CON, Angry → STR). Display each condition toggle **next to** its associated attribute so the player can see the pairing at a glance, improving game-play scannability.

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-3.1 | Each attribute cell in the attributes section also displays its linked condition toggle(s) directly **adjacent** (below or to the right of the attribute value). | Visual check on sheet screen. |
| AC-3.2 | The condition–attribute mapping is derived from the **system definition** data (not hard-coded layout), so it adapts if conditions or attributes change. | Code review: mapping sourced from system def. |
| AC-3.3 | Conditions that have **no linked attribute** (if any exist) are still rendered in a general conditions area. | Check edge cases in system definition. |
| AC-3.4 | The combined attribute+condition cell respects the responsive grid from SS-1 and wraps gracefully on narrow viewports. | Resize to 375 px; verify no overflow. |

---

## Implementation Steps

1. **Inspect system definition data** — Find where the Dragonbane system definition lives (likely a JSON or TS file under `src/` or a data directory). Locate the condition definitions and check if they already have an attribute linkage field (e.g., `linkedAttribute`, `attributeKey`, etc.). If not, the mapping may need to be added to the system definition.

2. **Understand current condition rendering** — Open `src/components/fields/ConditionToggleGroup.tsx` to see how conditions are currently rendered (as a standalone group). Note the props and data flow.

3. **Understand current attribute rendering** — Open `src/components/fields/AttributeField.tsx` to see how each attribute cell is rendered.

4. **Create or modify a composite component** — Build the attribute+condition composite:
   - Option A: Modify `AttributeField.tsx` to accept an optional list of linked conditions and render their toggles adjacent to the attribute value.
   - Option B: Create a new composite component (e.g., `AttributeWithConditions.tsx`) that wraps `AttributeField` and `ConditionToggle`.

5. **Wire up in `SheetScreen.tsx`** — In the attributes section of `SheetScreen.tsx`:
   - For each attribute, look up its linked conditions from the system definition.
   - Render the composite component instead of the standalone `AttributeField`.
   - Collect any orphan conditions (no linked attribute) and render them in a fallback area.

6. **Remove standalone conditions section (or reduce it)** — If all conditions are now rendered alongside attributes, the standalone `ConditionToggleGroup` section may be unnecessary (or reduced to only orphan conditions).

7. **Responsive behavior** — Ensure the composite cells work within the SS-1 grid. On narrow viewports (< 768 px), the condition toggle should stack below the attribute value rather than overflowing.

---

## Verification Commands

> All verification is visual / inspector-based (no shell commands per constraints).

- **Visual check (tablet):** At 800 px width, confirm each attribute shows its linked condition toggle adjacent to it.
- **Visual check (phone):** At 375 px width, confirm no overflow; condition toggles stack gracefully.
- **Code review:** Verify the condition–attribute mapping comes from system definition data, not hard-coded JSX.
- **Edge case:** Check if any conditions lack a linked attribute; confirm they render in a general area.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/screens/SheetScreen.tsx` | Rewire attributes section to render composite attribute+condition cells; handle orphan conditions. |
| `src/components/fields/AttributeField.tsx` | Extend to accept and render linked condition toggles (or create new composite component). |
| `src/components/fields/ConditionToggleGroup.tsx` | May be modified or reduced; individual toggles extracted for per-attribute use. |
| System definition file (TBD) | Ensure condition→attribute linkage data exists. |

---

## Constraints Reminder

- Mapping must come from system definition data — no hard-coded attribute-to-condition pairings in layout code.
- Design-token adherence for all spacing.
- Accessibility: condition toggles must remain keyboard-accessible and screen-reader friendly in their new positions.
- Must work within the SS-1 responsive grid.
