# Phase Spec — SS-05: Overall Compactness Pass

**Run:** `2026-03-22T22-18-21-design-doc`
**Sub-Spec:** SS-5
**Score:** 5 / 10
**Dependencies:** SS-1 (Responsive Multi-Column Sheet Layout), SS-4 (Character Portrait)

---

## Dependency Order

> **Depends on SS-1 and SS-4.** This is a polish layer that should be done **last**, after the responsive grid (SS-1), conditions layout (SS-3), and portrait (SS-4) are in place. Compactness tuning depends on the final layout structure being settled.

---

## Intent

Tighten vertical spacing across the sheet screen so more content is visible without scrolling, particularly on the Galaxy Tab S9 (800 × 1280 portrait). This is a polish pass that reduces padding and gaps by one step on the spacing scale.

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-5.1 | SectionPanel **header padding** reduced from `--space-md` to `--space-sm` (or equivalent tightening). | Inspect computed padding values. |
| AC-5.2 | SectionPanel **content padding** reduced by one step on the spacing scale (e.g., `--space-md` → `--space-sm`). | Inspect computed padding values. |
| AC-5.3 | Gaps between SectionPanels on the sheet screen are reduced (e.g., `--space-lg` → `--space-md`). | Visual check; measure gap. |
| AC-5.4 | **Touch targets remain ≥ 44 px** (`--touch-target-min`) per WCAG 2.5.5 — compactness must not violate accessibility. | Inspect all interactive elements. |
| AC-5.5 | The full sheet screen (Identity + Attributes/Conditions + Resources + Derived) is **visible without scrolling** on an 800 × 1280 viewport at default font size. | Emulate Galaxy Tab S9 portrait; check scroll. |

---

## Implementation Steps

1. **Audit current spacing** — Open `src/theme/theme.css` and note the current spacing scale (`--space-xs`, `--space-sm`, `--space-md`, `--space-lg`, `--space-xl`). Understand the values.

2. **Tighten SectionPanel header padding** — Open `src/components/primitives/SectionPanel.tsx` (or its CSS):
   - Locate the header element's padding declaration.
   - Change from `--space-md` to `--space-sm` (or reduce by one step).
   - Ensure the header text and collapse toggle remain visually balanced.

3. **Tighten SectionPanel content padding** — In the same file:
   - Locate the content/body area's padding declaration.
   - Reduce by one step (e.g., `--space-md` → `--space-sm`).

4. **Reduce gaps between SectionPanels** — In `src/screens/SheetScreen.tsx` or `src/theme/theme.css`:
   - Find the gap/margin between SectionPanel components.
   - Reduce by one step (e.g., `--space-lg` → `--space-md`).
   - This may also affect the grid gap set in SS-1.

5. **Verify touch targets** — After all spacing reductions, audit every interactive element on the sheet screen:
   - Buttons, toggles, +/− controls, input fields, condition chips.
   - Ensure each has a minimum tap target of 44 × 44 px (or uses `--touch-target-min`).
   - If any element is undersized, increase its hit area (padding, min-height/min-width) without increasing visual size.

6. **Test on Galaxy Tab S9 emulation** — Set browser viewport to 800 × 1280. Load the full sheet and check if all core sections (Identity, Attributes/Conditions, Resources, Derived) fit without scrolling. If not, identify which sections are oversized and make targeted adjustments.

---

## Verification Commands

> All verification is visual / inspector-based (no shell commands per constraints).

- **Padding inspection:** Right-click SectionPanel header → Inspect → verify padding uses `--space-sm` (or reduced value). Same for content area.
- **Gap inspection:** Inspect the gap between SectionPanels; confirm it resolves to a reduced token value.
- **Touch target audit:** For each interactive element, check computed `min-height` / `min-width` ≥ 44 px in the Box Model pane.
- **Galaxy Tab S9 test:** DevTools → Device toolbar → custom size 800 × 1280 → confirm no vertical scroll needed for the core sheet sections.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/primitives/SectionPanel.tsx` | Reduce header padding and content padding by one spacing step. |
| `src/theme/theme.css` | Adjust any global spacing rules affecting the sheet layout. May tighten default section gaps. |
| `src/screens/SheetScreen.tsx` | Reduce gap between SectionPanels (grid gap or margin). |

---

## Constraints Reminder

- **Accessibility is non-negotiable:** Touch targets ≥ 44 px. Do not sacrifice usability for compactness.
- Design-token adherence: all values must use CSS custom properties. No magic numbers.
- This is a polish pass: changes should be small, incremental spacing adjustments — not layout restructuring.
- Test on both narrow (375 px) and wide (800 px) viewports to avoid regressions.
