# Phase Spec: SS-04 — Base Component Styling Foundations

**Sub-Spec:** SS-4
**Weight:** 2 (Important)
**Dependencies:** SS-01 (Design Token System) and SS-02 (Fantasy Themes) must be completed first. SS-03 (Font Pairing) should be completed first for font token availability. This sub-spec applies tokens to components.

---

## Intent

Restyle primitive components (buttons, inputs, cards, tabs, headings, modals) so they feel like physical fantasy field-book objects rather than default browser controls — using only tokens, no artwork.

---

## Current State Analysis

**`src/components/primitives/Button.tsx`:**
- Uses inline React styles via `variantStyles` and `sizeStyles` objects
- Primary variant: `backgroundColor: 'var(--color-primary)'`, `color: 'var(--color-primary-text)'` — needs update to `--color-accent`
- Secondary variant: Uses `--color-surface-alt` and `--color-border` — mostly correct
- Danger variant: Uses `--color-danger` and `--color-text-inverse` — `--color-text-inverse` needs replacement
- Uses `borderRadius: 'var(--radius-sm)'` — currently 4px, will be 8px after SS-01
- Uses `fontFamily: 'inherit'` — should explicitly use `--font-ui`

**`src/components/primitives/Card.tsx`:**
- Uses `--color-surface`, `--color-border`, `--radius-md`, `--shadow-sm`
- Shadow token needs rename: `--shadow-sm` -> `--shadow-soft`
- Otherwise well-structured

**`src/components/primitives/Modal.tsx`:**
- Uses `--color-surface`, `--color-border`, `--radius-lg`, `--shadow-md`
- Shadow token needs rename: `--shadow-md` -> `--shadow-deep` (modals should use deep shadow)
- Title `<h2>` has inline `fontSize` but no `fontFamily` — should use `--font-display`
- Close button uses `--color-text-muted` — fine

**`src/components/primitives/SectionPanel.tsx`:**
- Header uses `--color-surface-alt` — correct
- Title `<h3>` has inline styles but no font-family — should inherit `--font-display` from heading rule (SS-03)
- Uses `--color-border` — correct

**`src/components/layout/TopBar.tsx`:**
- Title uses `--color-primary` — needs `--color-accent`
- Mode button uses `--color-text-inverse` — needs replacement
- Otherwise uses CSS classes from theme.css

**`src/components/layout/BottomNav.tsx`:**
- Uses CSS classes: `.bottom-nav`, `.bottom-nav__item`, `.bottom-nav__item--active`
- Active state uses `--color-primary` — needs `--color-accent`
- Currently in theme.css with `border-top: 2px solid var(--color-primary)` for active

**Input fields:** No global input styling exists in theme.css. Inputs inherit browser defaults.

---

## Acceptance Criteria

| # | Criterion | Points | Verification |
|---|-----------|--------|-------------|
| 4.1 | Buttons (primary) use `--color-accent` background with readable contrast text | 2 | inspect Button.tsx or theme.css button rules |
| 4.2 | Buttons (secondary) use `--color-surface-alt` with `--color-border` border | 1 | inspect Button.tsx |
| 4.3 | Buttons (danger) use `--color-danger` background | 1 | inspect Button.tsx |
| 4.4 | All buttons use `--font-ui` and avoid overly rounded or gradient styles | 1 | inspect Button.tsx |
| 4.5 | Input fields use inset shadow or subtle border, `--color-border` styling, accent focus state, danger error state | 2 | inspect theme.css input rules |
| 4.6 | Cards/panels use `--color-surface` / `--color-surface-alt` with `--shadow-soft` and `--color-border` borders | 2 | inspect Card.tsx / SectionPanel.tsx |
| 4.7 | Headings use `--font-display` font family | 2 | inspect heading styles |
| 4.8 | Tab/navigation active state uses `--color-accent` indicator | 1 | inspect BottomNav.tsx or tab styles |
| 4.9 | Modal uses `--shadow-deep` and maintains theme consistency | 1 | inspect Modal.tsx |
| 4.10 | Muted/helper text uses `--color-text-muted` | 1 | inspect component usage |
| 4.11 | Radius values on components use radius tokens (not hardcoded px) | 1 | grep components for `border-radius` |
| 4.12 | No component uses hardcoded colors where a semantic token should be used | 2 | grep components for hex values |

**Total: 17 points**

---

## Implementation Steps

### Step 1: Update `src/components/primitives/Button.tsx`

Replace token references in `variantStyles`:

```typescript
const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--color-accent)',
    color: 'var(--color-bg)',
    border: 'none',
  },
  secondary: {
    backgroundColor: 'var(--color-surface-alt)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
  },
  danger: {
    backgroundColor: 'var(--color-danger)',
    color: 'var(--color-bg)',
    border: 'none',
  },
};
```

Update the base button style in the JSX:
- Change `fontFamily: 'inherit'` to `fontFamily: 'var(--font-ui)'`
- Keep `borderRadius: 'var(--radius-sm)'` (will be 8px after SS-01)
- Ensure no gradients or overly rounded corners

### Step 2: Add global input/textarea/select styles to `src/theme/theme.css`

Add after the heading styles:

```css
/* Form elements base styling */
input,
textarea,
select {
  font-family: var(--font-ui);
  font-size: var(--size-md);
  color: var(--color-text);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  box-shadow: var(--shadow-inset-soft);
  min-height: var(--touch-target-min);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

input:focus,
textarea:focus,
select:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent);
}

input.error,
input[aria-invalid="true"],
textarea.error,
textarea[aria-invalid="true"] {
  border-color: var(--color-danger);
  box-shadow: 0 0 0 2px var(--color-danger);
}

input:disabled,
textarea:disabled,
select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Step 3: Update `src/components/primitives/Card.tsx`

Update shadow token:
- Change `boxShadow: 'var(--shadow-sm)'` to `boxShadow: 'var(--shadow-soft)'`

### Step 4: Update `src/components/primitives/Modal.tsx`

- Change `boxShadow: 'var(--shadow-md)'` to `boxShadow: 'var(--shadow-deep)'`
- Add `fontFamily: 'var(--font-display)'` to the title `<h2>` style
- Replace `--color-text-muted` for close button — this one is actually correct, keep it

### Step 5: Update `src/components/primitives/SectionPanel.tsx`

- Verify header uses `--color-surface-alt` — already correct
- Verify border uses `--color-border` — already correct
- The `<h3>` should inherit `--font-display` from the global heading rule (SS-03), but if it uses inline `fontFamily`, ensure it's `var(--font-display)`
- Add `boxShadow: 'var(--shadow-soft)'` to the outer container if not present

### Step 6: Update `src/theme/theme.css` — BottomNav active state

Replace `--color-primary` with `--color-accent` in the bottom nav active style:

```css
.bottom-nav__item--active {
  color: var(--color-accent);
  font-weight: bold;
  border-top: 2px solid var(--color-accent);
}
```

### Step 7: Update `src/theme/theme.css` — TopBar styles

Replace `--color-primary` references in TopBar CSS:

```css
.top-bar__title {
  font-size: var(--size-lg);
  font-weight: bold;
  color: var(--color-accent);
  font-family: var(--font-display);
  flex-shrink: 0;
}

.top-bar__character:hover {
  color: var(--color-accent);
  text-decoration: underline;
}
```

### Step 8: Update `src/components/layout/TopBar.tsx`

Replace inline style token references:
- `--color-text-inverse` -> `--color-bg` (for mode button text color)
- Any `--color-primary` references -> `--color-accent`

### Step 9: Update `src/theme/theme.css` — TopBar menu active state

```css
.topbar-menu__item--active {
  color: var(--color-accent);
  font-weight: bold;
  background-color: var(--color-surface-alt);
}
```

### Step 10: Audit all components for hardcoded hex values

Search all `.tsx` and `.ts` files in `src/components/` for hex color patterns (`#[0-9a-fA-F]{3,8}`). Replace any found with appropriate token references. Based on current state, most components are already clean, but verify:
- `src/components/primitives/Chip.tsx`
- `src/components/primitives/CounterControl.tsx`
- `src/components/primitives/Drawer.tsx`
- `src/components/primitives/IconButton.tsx`
- `src/components/primitives/Toast.tsx` / `Toast.module.css`
- Any files in `src/components/fields/`

### Step 11: Ensure radius values use tokens

Verify no component uses hardcoded `border-radius: Npx` — all should use `var(--radius-sm)`, `var(--radius-md)`, `var(--radius-lg)`, or `var(--radius-xl)`.

---

## Files to Modify

| File | Action | What Changes |
|------|--------|-------------|
| `src/components/primitives/Button.tsx` | Modify | Update variant token names (`--color-primary` -> `--color-accent`, etc.), set `--font-ui` |
| `src/components/primitives/Card.tsx` | Modify | `--shadow-sm` -> `--shadow-soft` |
| `src/components/primitives/Modal.tsx` | Modify | `--shadow-md` -> `--shadow-deep`, add `--font-display` to title |
| `src/components/primitives/SectionPanel.tsx` | Minor modify | Add shadow, verify tokens |
| `src/theme/theme.css` | Modify | Add input/form styles, update TopBar/BottomNav token references |
| `src/components/layout/TopBar.tsx` | Modify | Replace `--color-text-inverse`, `--color-primary` references |
| `src/components/layout/BottomNav.tsx` | Verify | Should be handled by CSS changes in theme.css |
| `src/components/primitives/Chip.tsx` | Audit | Check for hardcoded colors |
| `src/components/primitives/CounterControl.tsx` | Audit | Check for hardcoded colors |
| `src/components/primitives/Drawer.tsx` | Audit | Check for hardcoded colors |
| `src/components/primitives/IconButton.tsx` | Audit | Check for hardcoded colors |
| `src/components/primitives/Toast.tsx` | Audit | Check for hardcoded colors |
| `src/components/primitives/Toast.module.css` | Audit | Check for hardcoded colors |

---

## Verification Commands

```bash
# 4.1: Button primary uses --color-accent
grep "color-accent" src/components/primitives/Button.tsx

# 4.2: Button secondary uses --color-surface-alt and --color-border
grep "color-surface-alt" src/components/primitives/Button.tsx
grep "color-border" src/components/primitives/Button.tsx

# 4.3: Button danger uses --color-danger
grep "color-danger" src/components/primitives/Button.tsx

# 4.4: Button uses --font-ui
grep "font-ui" src/components/primitives/Button.tsx

# 4.5: Input styles exist
grep -A 5 "^input" src/theme/theme.css
grep "shadow-inset-soft" src/theme/theme.css
grep "input:focus" src/theme/theme.css
grep "aria-invalid" src/theme/theme.css

# 4.6: Card uses --shadow-soft
grep "shadow-soft" src/components/primitives/Card.tsx

# 4.7: Headings use --font-display
grep "font-display" src/theme/theme.css

# 4.8: BottomNav active uses --color-accent
grep "color-accent" src/theme/theme.css | grep -i "active\|bottom"

# 4.9: Modal uses --shadow-deep
grep "shadow-deep" src/components/primitives/Modal.tsx

# 4.10: --color-text-muted used for helper text
grep -rn "color-text-muted" src/components/

# 4.11: No hardcoded border-radius px in components
grep -rn "border-radius.*[0-9]px" src/components/ --include="*.tsx"
# Should return empty or only use var() references

# 4.12: No hardcoded hex colors in components
grep -rn "#[0-9a-fA-F]\{3,8\}" src/components/ --include="*.tsx" --include="*.ts" --include="*.css"
# Should return empty (excluding comments)
```

---

## Constraints

- Use ONLY CSS custom properties for colors, fonts, spacing, radius, shadows
- No gradients on buttons
- No overly rounded corners (max `--radius-lg` = 16px for most elements)
- No artwork/SVGs/PNGs
- Components must still work with all three themes
- Preserve existing component APIs (props, children, etc.)
- Touch targets must remain >= 44px (`--touch-target-min`)
