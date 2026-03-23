# Phase Spec: SS-05 — Interaction States & Accessibility

**Sub-Spec:** SS-5
**Weight:** 2 (Important)
**Dependencies:** SS-01 (Design Token System), SS-02 (Fantasy Themes), and SS-04 (Component Styling) must be completed first. This sub-spec layers interaction states on top of the styled components.

---

## Intent

Ensure hover, active, focus, disabled, and error states are implemented consistently using theme tokens, with strong accessibility compliance for tablet/mobile use.

---

## Current State Analysis

**Hover states:**
- `.top-bar__btn:hover` — has `background-color: var(--color-surface-alt)` — basic, works
- `.top-bar__character:hover` — has color change + underline — works
- `.topbar-menu__item:hover` — has `background-color: var(--color-surface-alt)` — works
- `Button.tsx` — NO hover state (inline styles can't do `:hover`)
- `.bottom-nav__item` — NO hover state
- `Card.tsx` — NO hover state

**Focus states:**
- No `focus-visible` rules exist anywhere
- No focus ring styling
- TopBar title has `tabIndex={0}` but no visible focus indicator
- Buttons rely on browser default focus (often invisible or inconsistent)

**Disabled states:**
- `Button.tsx` has `opacity: 0.6` when disabled — basic but functional
- `.field--locked` has `opacity: 0.6` — functional
- No global disabled input styling

**Error states:**
- No error/invalid input styling exists

**Touch targets:**
- `--touch-target-min: 44px` exists and is used by buttons, nav items — good
- Bottom nav items and top bar buttons respect this — good

**Body text size:**
- Currently `font-size: var(--font-size-md)` = `1rem` — meets criterion

---

## Acceptance Criteria

| # | Criterion | Points | Verification |
|---|-----------|--------|-------------|
| 5.1 | Hover states exist on interactive elements (buttons, tabs, inputs) with subtle darken/lighten | 2 | inspect CSS hover rules |
| 5.2 | Focus states use visible ring with `--color-accent` or `--color-gold` — keyboard accessible | 3 | inspect CSS focus-visible rules |
| 5.3 | Disabled states show reduced contrast but remain legible | 1 | inspect disabled styles |
| 5.4 | Error/invalid input states use `--color-danger` clearly | 1 | inspect input error styles |
| 5.5 | Touch targets are minimum 44px (existing `--touch-target-min` maintained) | 1 | inspect interactive element sizing |
| 5.6 | Body text at `--size-md` (1rem) or larger — suitable for tablet reading | 1 | inspect body font-size |
| 5.7 | All three themes maintain sufficient contrast for body text against background (WCAG AA, 4.5:1 minimum) | 2 | contrast ratio check of text/bg pairs |
| 5.8 | No decorative styling interferes with form completion or readability | 1 | manual review |

**Total: 12 points**

---

## Implementation Steps

### Step 1: Add global button hover/active states to `src/theme/theme.css`

Since `Button.tsx` uses inline styles (which can't handle `:hover`), add CSS class-based hover rules. The approach: add a global `button` element hover rule, or add specific classes.

**Option A (recommended):** Add global button element hover rules:

```css
/* Button interaction states */
button {
  transition: background-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

button:hover:not(:disabled) {
  filter: brightness(1.1);
}

button:active:not(:disabled) {
  filter: brightness(0.95);
  transform: translateY(1px);
}
```

**Note:** `filter: brightness()` works universally across themes — lighter elements get slightly lighter, darker elements get slightly darker. This avoids needing to compute separate hover colors for each theme.

### Step 2: Add bottom nav hover state to `src/theme/theme.css`

```css
.bottom-nav__item:hover {
  background-color: var(--color-surface-alt);
  color: var(--color-text);
}
```

### Step 3: Add focus-visible styles to `src/theme/theme.css`

Add a global focus-visible rule for all interactive elements:

```css
/* Focus-visible ring for keyboard accessibility */
button:focus-visible,
a:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible,
[role="button"]:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(47, 135, 122, 0.25);
}

/* Remove default outline for mouse users */
button:focus:not(:focus-visible),
a:focus:not(:focus-visible),
[role="button"]:focus:not(:focus-visible),
[tabindex]:focus:not(:focus-visible) {
  outline: none;
}
```

### Step 4: Add global disabled state styles to `src/theme/theme.css`

```css
/* Disabled state — reduced contrast but legible */
button:disabled,
input:disabled,
textarea:disabled,
select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: none;
}
```

### Step 5: Add/verify input error states in `src/theme/theme.css`

This may overlap with SS-04. Ensure these rules exist (add if not already present from SS-04):

```css
/* Error/invalid input state */
input.error,
input[aria-invalid="true"],
textarea.error,
textarea[aria-invalid="true"],
select.error,
select[aria-invalid="true"] {
  border-color: var(--color-danger);
  box-shadow: var(--shadow-inset-soft), 0 0 0 1px var(--color-danger);
}
```

### Step 6: Verify touch target sizes

Audit that all interactive elements maintain `min-height: 44px` (or `var(--touch-target-min)`):
- Buttons: `sizeStyles.md.minHeight` = `var(--touch-target-min)` — correct
- Bottom nav items: `min-height: var(--touch-target-min)` — correct
- Top bar buttons: `min-height: var(--touch-target-min)` — correct
- Menu items: `min-height: var(--touch-target-min)` — correct

No changes needed if existing code is maintained. Verify `sm` sized buttons still have adequate touch target:
- Currently `minHeight: '36px'` — this is below 44px. Consider adding a note but don't change the API (small buttons are intentionally small for inline use).

### Step 7: Verify body text size

Ensure body rule uses `font-size: var(--size-md)` (which is `1rem` = 16px). Already correct from SS-01/SS-03 changes.

### Step 8: Verify WCAG AA contrast ratios

Check the text/background contrast ratios for all three themes:

| Theme | Text Color | Background Color | Expected Ratio | Passes AA? |
|-------|-----------|-----------------|----------------|-----------|
| Light | `#2D241B` | `#EEE6D2` | ~9.3:1 | Yes |
| Dark | `#E9DFC7` | `#121613` | ~13.2:1 | Yes |
| Parchment | `#3A2B18` | `#D9C59A` | ~7.0:1 | Yes |
| Light muted | `#6C5B46` | `#EEE6D2` | ~4.5:1 | Borderline - verify |
| Dark muted | `#B5A88E` | `#121613` | ~8.2:1 | Yes |
| Parchment muted | `#6B573C` | `#D9C59A` | ~3.8:1 | Borderline - verify |

**If parchment muted fails AA:** Consider adjusting `--color-text-muted` for parchment to a slightly darker value (e.g., `#5D4A30`) to meet 4.5:1. However, ONLY do this if the spec values genuinely fail — do not change spec values without documenting the deviation.

### Step 9: Add transition to interactive elements for smooth state changes

Ensure all interactive elements in `theme.css` have transitions:

```css
/* Smooth transitions for interactive elements */
.bottom-nav__item {
  transition: background-color 0.15s ease, color 0.15s ease;
}

.top-bar__btn {
  transition: background-color 0.15s ease, color 0.15s ease;
}

.topbar-menu__item {
  transition: background-color 0.15s ease;
}
```

### Step 10: Add link hover/focus states if links exist

```css
a {
  color: var(--color-accent);
  text-decoration: none;
  transition: color 0.15s ease;
}

a:hover {
  color: var(--color-accent-alt);
  text-decoration: underline;
}
```

---

## Files to Modify

| File | Action | What Changes |
|------|--------|-------------|
| `src/theme/theme.css` | Modify | Add hover, focus-visible, disabled, error, and transition rules |

**Note:** This sub-spec primarily adds CSS rules to `theme.css`. Component files should NOT need modification since the hover/focus/disabled states are applied via element selectors and pseudo-classes in CSS, not inline styles.

---

## Verification Commands

```bash
# 5.1: Hover states exist
grep ":hover" src/theme/theme.css
grep "button:hover" src/theme/theme.css
grep "bottom-nav.*:hover" src/theme/theme.css

# 5.2: Focus-visible rules
grep "focus-visible" src/theme/theme.css
grep "outline.*color-accent\|outline.*color-gold" src/theme/theme.css

# 5.3: Disabled states
grep ":disabled" src/theme/theme.css
grep "opacity.*0\.[45]" src/theme/theme.css

# 5.4: Error/invalid input states
grep "aria-invalid\|\.error" src/theme/theme.css
grep "color-danger" src/theme/theme.css

# 5.5: Touch target min maintained
grep "touch-target-min" src/theme/theme.css
grep "min-height.*touch-target" src/theme/theme.css

# 5.6: Body text size
grep "font-size.*size-md\|font-size.*1rem" src/theme/theme.css

# 5.7: Contrast ratios (manual check — use online contrast checker)
# Light:     text #2D241B on bg #EEE6D2 => verify >= 4.5:1
# Dark:      text #E9DFC7 on bg #121613 => verify >= 4.5:1
# Parchment: text #3A2B18 on bg #D9C59A => verify >= 4.5:1

# 5.8: No decorative interference (manual review)
# Verify no text-shadow, transform, or animation on body/form text
```

---

## Constraints

- All interaction states must use theme tokens (no hardcoded colors)
- `focus-visible` must be used (not `:focus`) to avoid showing focus rings on mouse click
- Transitions should be subtle and fast (150ms max)
- No animations that could cause motion sickness (respect `prefers-reduced-motion` if adding animations)
- Touch targets must remain >= 44px
- Do NOT modify component APIs or props
- Error states should use `aria-invalid="true"` attribute selector for semantic correctness
- If any spec contrast ratio fails WCAG AA, document the issue but do not unilaterally change spec color values

---

## WCAG AA Reference

- Normal text (< 18pt): 4.5:1 minimum contrast ratio
- Large text (>= 18pt or 14pt bold): 3:1 minimum contrast ratio
- UI components and graphical objects: 3:1 minimum contrast ratio
