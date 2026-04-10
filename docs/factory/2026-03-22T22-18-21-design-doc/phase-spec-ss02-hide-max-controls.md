# Phase Spec — SS-02: Hide Max-HP / Max-WP Edit Controls in Play Mode

**Run:** `2026-03-22T22-18-21-design-doc`
**Sub-Spec:** SS-2
**Score:** 7 / 10
**Dependencies:** None — this sub-spec is independent.

---

## Dependency Order

> **No dependencies.** SS-2 can be implemented in parallel with any other sub-spec.

---

## Intent

In play mode, the max values of HP and WP should not be adjustable. The +/− increment buttons (and any editable input affordance) for `resources.hp.max` and `resources.wp.max` must be hidden so only the current values are interactive. In edit mode, everything functions as before.

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-2.1 | In **play mode**, the +/− buttons for HP Max and WP Max are **not rendered** (or visually hidden with `display: none`). | Toggle to play mode; buttons absent. |
| AC-2.2 | The max values themselves remain **visible as read-only text** so the player can still see them. | Visual check: "/ 22" still shown. |
| AC-2.3 | In **edit mode**, the +/− buttons render and function as before (no regression). | Toggle to edit mode; buttons present and functional. |
| AC-2.4 | The guard check uses the existing `useFieldEditable` hook or `isFieldEditable` utility from `modeGuards.ts` for consistency. | Code review. |

---

## Implementation Steps

1. **Inspect `src/utils/modeGuards.ts`** — Understand the existing `useFieldEditable` hook or `isFieldEditable` utility. Note its API (does it take a field path? a field key?).

2. **Open `src/components/fields/ResourceTracker.tsx`** — Locate the +/− button rendering for the max value of each resource (HP, WP). This is likely a sub-component or inline JSX that renders increment/decrement controls alongside the max value.

3. **Add editability guard** — Import `useFieldEditable` (or equivalent) and call it for the max fields (`resources.hp.max`, `resources.wp.max`). Conditionally render the +/− buttons only when the field is editable.

4. **Ensure max value remains visible** — When buttons are hidden, the max value text (e.g., "/ 22") must still render as static read-only text. Verify the component renders the value outside of the button conditional.

5. **Check `src/components/fields/DerivedFieldDisplay.tsx`** — If this component also renders editable controls for max HP/WP, apply the same guard logic here.

6. **Check `src/screens/SheetScreen.tsx`** — If the mode toggle or resource rendering is orchestrated here, ensure the mode context is properly passed down.

---

## Verification Commands

> All verification is visual / manual (no shell commands per constraints).

- **Play mode test:** Switch to play mode → confirm HP Max and WP Max +/− buttons are absent → confirm max values still display as text.
- **Edit mode test:** Switch to edit mode → confirm +/− buttons appear and function (increment/decrement max values).
- **Code review:** Verify `useFieldEditable` or `isFieldEditable` is used (not a raw mode check) for consistency with the rest of the codebase.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/fields/ResourceTracker.tsx` | Conditionally render +/− buttons for max values based on `useFieldEditable` / editability guard. |
| `src/components/fields/DerivedFieldDisplay.tsx` | Apply same guard if it renders max HP/WP edit controls. |
| `src/utils/modeGuards.ts` | Reference only — use existing utilities; extend if needed for resource max fields. |
| `src/screens/SheetScreen.tsx` | Minor changes if mode context wiring is needed. |

---

## Constraints Reminder

- Use existing `modeGuards.ts` utilities for consistency.
- No regression in edit mode.
- Cross-platform: standard React conditional rendering.
- Accessibility: hidden buttons must be fully removed from the DOM (not just visually hidden) to avoid confusing screen readers.
