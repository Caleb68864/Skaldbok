# Phase Spec — SS-01: Responsive Multi-Column Sheet Layout

**Run:** `2026-03-22T22-18-21-design-doc`
**Sub-Spec:** SS-1
**Score:** 8 / 10
**Dependencies:** None — this is the foundational layout sub-spec.

---

## Dependency Order

> **No dependencies.** SS-1 must be completed **first** as SS-3 (Conditions by Attributes) and SS-5 (Compactness Pass) depend on the grid established here.

---

## Intent

On wider viewports (≥ 768 px, e.g. Galaxy Tab S9 portrait at 800 px), arrange SectionPanels in a multi-column grid so the sheet is scannable without excessive scrolling. On narrow viewports (< 768 px), the layout must remain single-column with no regression.

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-1.1 | A CSS media query breakpoint (or container query) at **≥ 768 px** switches the SheetScreen section container from single-column to a **2-column CSS grid**. | Inspect computed styles at 800 px width. |
| AC-1.2 | Sections that are logically full-width (e.g., Identity + portrait row) span both columns via `grid-column: 1 / -1`. | Visual check on tablet viewport. |
| AC-1.3 | On viewports **< 768 px** the layout remains single-column (no regression on phones). | Resize to 375 px and verify stacking. |
| AC-1.4 | Grid gap uses existing design tokens (`--space-md` or `--space-lg`). | Inspect CSS; no magic numbers. |

---

## Implementation Steps

1. **Open `src/screens/SheetScreen.tsx`** — Locate the container element that wraps the SectionPanel components (the main section list/wrapper).

2. **Add a CSS class for the grid container** — In `src/theme/theme.css` (or a co-located CSS module if one exists for SheetScreen), add:
   - A base rule for the section container: `display: flex; flex-direction: column; gap: var(--space-md);` (preserve current single-column behavior).
   - A `@media (min-width: 768px)` block that switches to: `display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-lg);` (or `--space-md` — use whichever token is appropriate).

3. **Mark full-width sections** — In `SheetScreen.tsx`, add a prop, class, or inline style to sections that should span both columns (Identity row, and any other logically full-width sections). Apply `grid-column: 1 / -1` to those elements.

4. **Verify token usage** — Ensure the `gap` value references a CSS custom property from `theme.css` (e.g., `var(--space-md)` or `var(--space-lg)`). No magic pixel values.

5. **Test narrow viewport** — Confirm that at < 768 px the grid falls back to the single-column flex layout (or `grid-template-columns: 1fr`).

---

## Verification Commands

> All verification is visual / inspector-based (no shell commands per constraints).

- **800 px viewport:** Open browser DevTools → toggle device toolbar → set width to 800 px. Confirm 2-column grid on the sheet screen.
- **375 px viewport:** Set width to 375 px. Confirm single-column stacking.
- **Inspect CSS:** Right-click section container → Inspect → verify `grid-template-columns: 1fr 1fr` at ≥ 768 px and `grid-template-columns: 1fr` (or flex column) below.
- **Gap tokens:** In the Styles pane, confirm `gap` resolves to a `var(--space-*)` token.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/screens/SheetScreen.tsx` | Add grid container class to section wrapper; mark full-width sections with spanning class/style. |
| `src/theme/theme.css` | Add media query with 2-column grid rules; define `.sheet-grid` (or equivalent) class. |

---

## Constraints Reminder

- Design-token adherence: all spacing via CSS custom properties.
- No magic numbers.
- Cross-platform: standard CSS only.
- Accessibility: layout change must not break tab order or screen-reader flow.
