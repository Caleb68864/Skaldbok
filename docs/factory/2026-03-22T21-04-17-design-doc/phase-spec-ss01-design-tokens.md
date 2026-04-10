# Phase Spec: SS-01 — Design Token System

**Sub-Spec:** SS-1
**Weight:** 3 (Critical)
**Dependencies:** None — this is the foundation. Must be completed BEFORE SS-02, SS-03, SS-04, SS-05.

---

## Intent

Centralize all visual design values into a single token source in `src/theme/theme.css` so themes, components, and future artwork layers all reference the same system. The existing file has partial tokens but is missing many required by the spec.

---

## Current State Analysis

**File:** `src/theme/theme.css` — `:root` block (lines 1–24)

**Existing tokens:**
- Radius: `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (16px) — needs `--radius-xl` (20px), and `--radius-sm` must change from 4px to 8px
- Spacing: `--space-xs` (4px), `--space-sm` (8px), `--space-md` (16px), `--space-lg` (24px), `--space-xl` (40px) — needs `--space-1` through `--space-10` per spec
- Font sizes: `--font-size-sm`, `--font-size-md`, `--font-size-lg`, `--font-size-xl` — needs `--size-xs` through `--size-3xl` naming
- Shadows: `--shadow-sm`, `--shadow-md` per-theme — needs `--shadow-soft`, `--shadow-medium`, `--shadow-deep`, `--shadow-inset-soft` as shared tokens
- Font families: Only `--font-family` — needs `--font-display`, `--font-ui`, `--font-text`

**Missing entirely:**
- `--color-gold`, `--color-info`, `--color-accent-alt`, `--color-success`, `--color-warning` (some themes have success/warning but not as semantic shared concept)
- `--font-display`, `--font-ui`, `--font-text`
- Typography scale: `--size-xs` through `--size-3xl`
- Weight tokens: `--weight-normal`, `--weight-medium`, `--weight-semibold`, `--weight-bold`
- Line-height tokens: `--lh-tight`, `--lh-normal`, `--lh-relaxed`
- Border tokens: `--border-thin`, `--border-strong`
- Shadow variants: `--shadow-soft`, `--shadow-medium`, `--shadow-deep`, `--shadow-inset-soft`

---

## Acceptance Criteria

| # | Criterion | Points | Verification |
|---|-----------|--------|-------------|
| 1.1 | All 13 semantic color tokens exist as CSS custom properties (`--color-bg`, `--color-surface`, `--color-surface-alt`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-alt`, `--color-danger`, `--color-border`, `--color-gold`, `--color-success`, `--color-warning`, `--color-info`) | 3 | grep theme.css for each variable name |
| 1.2 | All 3 font family tokens exist (`--font-display`, `--font-ui`, `--font-text`) with correct values per spec | 2 | grep theme.css |
| 1.3 | Typography scale tokens exist (`--size-xs` through `--size-3xl`, weight tokens, line-height tokens) | 2 | grep theme.css |
| 1.4 | Spacing tokens exist (`--space-1` through `--space-10`) per spec values | 2 | grep theme.css |
| 1.5 | Radius tokens exist (`--radius-sm` 8px, `--radius-md` 12px, `--radius-lg` 16px, `--radius-xl` 20px) | 1 | grep theme.css |
| 1.6 | Shadow tokens exist (`--shadow-soft`, `--shadow-medium`, `--shadow-deep`, `--shadow-inset-soft`) | 2 | grep theme.css |
| 1.7 | Border tokens exist (`--border-thin`, `--border-strong`) referencing `--color-border` | 1 | grep theme.css |
| 1.8 | All tokens defined in a single centralized file (`src/theme/theme.css`) — not scattered across component files | 2 | file inspection |
| 1.9 | No component files contain hardcoded hex color values that should use tokens | 2 | grep src/components for hex codes |

**Total: 17 points**

---

## Implementation Steps

### Step 1: Rewrite the `:root` block in `src/theme/theme.css`

Replace the current `:root` block (lines 1–24) with a comprehensive shared token block. The `:root` block should contain ALL non-color tokens (since colors vary by theme):

```css
:root {
  /* Font Families (values set here, can be overridden per-theme if needed) */
  --font-display: 'Marcellus', Georgia, serif;
  --font-ui: 'Source Sans 3', Arial, Helvetica, sans-serif;
  --font-text: 'Source Serif 4', Georgia, serif;

  /* Typography Scale */
  --size-xs: 0.75rem;    /* 12px */
  --size-sm: 0.875rem;   /* 14px */
  --size-md: 1rem;       /* 16px */
  --size-lg: 1.25rem;    /* 20px */
  --size-xl: 1.5rem;     /* 24px */
  --size-2xl: 2rem;      /* 32px */
  --size-3xl: 2.5rem;    /* 40px */

  /* Font Weights */
  --weight-normal: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;

  /* Line Heights */
  --lh-tight: 1.2;
  --lh-normal: 1.5;
  --lh-relaxed: 1.75;

  /* Spacing Scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  --space-9: 48px;
  --space-10: 64px;

  /* Legacy spacing aliases (preserve backward compat) */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 40px;

  /* Border Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;

  /* Shadows (theme-agnostic, opacity-based) */
  --shadow-soft: 0 1px 4px rgba(0, 0, 0, 0.12);
  --shadow-medium: 0 4px 12px rgba(0, 0, 0, 0.18);
  --shadow-deep: 0 8px 24px rgba(0, 0, 0, 0.28);
  --shadow-inset-soft: inset 0 1px 3px rgba(0, 0, 0, 0.1);

  /* Border Shorthand Tokens */
  --border-thin: 1px solid var(--color-border);
  --border-strong: 2px solid var(--color-border);

  /* Touch Target */
  --touch-target-min: 44px;

  /* Legacy font-size aliases (preserve backward compat) */
  --font-size-sm: var(--size-sm);
  --font-size-md: var(--size-md);
  --font-size-lg: var(--size-lg);
  --font-size-xl: var(--size-xl);
}
```

### Step 2: Ensure all 13 semantic color tokens in each `[data-theme]` block

Each theme block (`[data-theme="light"]`, `[data-theme="dark"]`, `[data-theme="parchment"]`) must define ALL of these:
- `--color-bg`
- `--color-surface`
- `--color-surface-alt`
- `--color-text`
- `--color-text-muted`
- `--color-accent`
- `--color-accent-alt`
- `--color-danger`
- `--color-border`
- `--color-gold`
- `--color-success`
- `--color-warning`
- `--color-info`

**Note:** The exact color VALUES for each theme are specified in SS-02. For SS-01, the structural requirement is that the token names exist. However, since SS-01 and SS-02 are likely implemented together in the same file, coordinate with SS-02 for the values.

For SS-01 implementation, add placeholder values if SS-02 is not yet done, or use SS-02's spec values directly:
- Remove old tokens that are renamed: `--color-primary`, `--color-primary-hover`, `--color-primary-text`, `--color-accent` (old purple value), `--color-divider`, `--color-text-inverse`
- Add new tokens: `--color-accent-alt`, `--color-gold`, `--color-info`
- Keep `--color-mode-play`, `--color-mode-edit` if still used by TopBar

### Step 3: Remove per-theme shadow definitions

Currently `--shadow-sm` and `--shadow-md` are defined inside each theme block. Move shadows to `:root` as `--shadow-soft`, `--shadow-medium`, `--shadow-deep`, `--shadow-inset-soft`. Add legacy aliases `--shadow-sm` and `--shadow-md` in `:root` pointing to new names.

### Step 4: Remove per-theme font-family override

Currently parchment theme overrides `--font-family`. Remove this — font tokens are now in `:root` and body uses `--font-ui`.

### Step 5: Audit component files for hardcoded hex values

Scan these files and replace any hardcoded hex colors with token references:
- `src/components/primitives/Button.tsx` — currently clean (uses CSS vars)
- `src/components/primitives/Card.tsx` — currently clean
- `src/components/primitives/Modal.tsx` — has `rgba(0,0,0,0.6)` for backdrop (acceptable)
- `src/components/primitives/SectionPanel.tsx` — currently clean
- `src/components/layout/TopBar.tsx` — currently clean
- `src/components/layout/BottomNav.tsx` — currently clean
- Check ALL other component files in `src/components/` for hex values

### Step 6: Remove reference tab hardcoded colors from `:root`

The `:root` block currently has `--ref-header-bg: #2f5b1f`, `--ref-header-text: #ffffff`, etc. These hardcoded hex values should either be removed or converted to use semantic tokens.

---

## Files to Modify

| File | Action | What Changes |
|------|--------|-------------|
| `src/theme/theme.css` | Major rewrite | Rewrite `:root` block with full token system; restructure shadow/border tokens |
| `src/components/**/*.tsx` | Audit + minor edits | Replace any hardcoded hex color values with CSS variable references |

---

## Verification Commands

```bash
# 1.1: All 13 semantic color tokens exist
grep -c "\-\-color-bg" src/theme/theme.css
grep -c "\-\-color-surface:" src/theme/theme.css
grep -c "\-\-color-surface-alt" src/theme/theme.css
grep -c "\-\-color-text:" src/theme/theme.css
grep -c "\-\-color-text-muted" src/theme/theme.css
grep -c "\-\-color-accent:" src/theme/theme.css
grep -c "\-\-color-accent-alt" src/theme/theme.css
grep -c "\-\-color-danger" src/theme/theme.css
grep -c "\-\-color-border" src/theme/theme.css
grep -c "\-\-color-gold" src/theme/theme.css
grep -c "\-\-color-success" src/theme/theme.css
grep -c "\-\-color-warning" src/theme/theme.css
grep -c "\-\-color-info" src/theme/theme.css

# 1.2: Font family tokens
grep "\-\-font-display" src/theme/theme.css
grep "\-\-font-ui" src/theme/theme.css
grep "\-\-font-text" src/theme/theme.css

# 1.3: Typography scale
grep "\-\-size-xs" src/theme/theme.css
grep "\-\-size-sm" src/theme/theme.css
grep "\-\-size-md" src/theme/theme.css
grep "\-\-size-lg" src/theme/theme.css
grep "\-\-size-xl" src/theme/theme.css
grep "\-\-size-2xl" src/theme/theme.css
grep "\-\-size-3xl" src/theme/theme.css
grep "\-\-weight-" src/theme/theme.css
grep "\-\-lh-" src/theme/theme.css

# 1.4: Spacing tokens
grep "\-\-space-1:" src/theme/theme.css
grep "\-\-space-10:" src/theme/theme.css

# 1.5: Radius tokens
grep "\-\-radius-sm" src/theme/theme.css
grep "\-\-radius-xl" src/theme/theme.css

# 1.6: Shadow tokens
grep "\-\-shadow-soft" src/theme/theme.css
grep "\-\-shadow-medium" src/theme/theme.css
grep "\-\-shadow-deep" src/theme/theme.css
grep "\-\-shadow-inset-soft" src/theme/theme.css

# 1.7: Border tokens
grep "\-\-border-thin" src/theme/theme.css
grep "\-\-border-strong" src/theme/theme.css

# 1.9: No hardcoded hex in components
grep -rn "#[0-9a-fA-F]\{3,8\}" src/components/ --include="*.tsx" --include="*.ts"
```

---

## Constraints

- All tokens MUST live in `src/theme/theme.css` (single source of truth)
- Preserve backward compatibility with existing token names where possible (add aliases)
- No shell commands during implementation — file edits only
- Cross-platform CSS only (no vendor prefixes needed for custom properties)
- The `--font-family` token currently used by body should be aliased to `--font-ui` or replaced
