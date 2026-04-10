# Phase Spec: SS-03 — Font Pairing System

**Sub-Spec:** SS-3
**Weight:** 2 (Important)
**Dependencies:** SS-01 (Design Token System) must be completed first — SS-03 relies on `--font-display`, `--font-ui`, `--font-text` tokens existing in `:root`.

---

## Intent

Establish a three-tier font system (Marcellus for display, Source Sans 3 for UI, Source Serif 4 for lore) that feels fantasy-adjacent yet highly readable on tablet/mobile.

---

## Current State Analysis

**`index.html`:** No Google Fonts imports. No preconnect hints. No font loading optimization.

**`src/theme/theme.css`:** Uses `--font-family: system-ui, -apple-system, sans-serif` in `:root`. Parchment theme overrides to `Georgia, 'Times New Roman', serif`. No `--font-display`, `--font-ui`, or `--font-text` tokens exist.

**`body` rule (line 106):** Uses `font-family: var(--font-family)` — will need to change to `var(--font-ui)`.

**Heading styles:** No heading-specific styles exist in `theme.css`. Components like `SectionPanel.tsx` and `Modal.tsx` render `<h2>` and `<h3>` with inline styles but no font-family override — they inherit from body.

---

## Acceptance Criteria

| # | Criterion | Points | Verification |
|---|-----------|--------|-------------|
| 3.1 | Google Fonts (or equivalent) import exists for Marcellus, Source Sans 3, and Source Serif 4 | 3 | inspect index.html or CSS @import |
| 3.2 | `--font-display` resolves to `'Marcellus', Georgia, serif` | 2 | grep theme.css |
| 3.3 | `--font-ui` resolves to `'Source Sans 3', Arial, Helvetica, sans-serif` | 2 | grep theme.css |
| 3.4 | `--font-text` resolves to `'Source Serif 4', Georgia, serif` | 2 | grep theme.css |
| 3.5 | Body text uses `--font-ui` by default | 1 | inspect body style rule |
| 3.6 | Heading elements (h1-h6 or equivalent) use `--font-display` | 2 | inspect heading style rules |
| 3.7 | Font loading is efficient (preconnect hints, `font-display: swap`, or equivalent) | 1 | inspect index.html / CSS |
| 3.8 | No decorative/unreadable fantasy fonts used for body or form text | 1 | manual review of font assignments |

**Total: 14 points**

**CRITICAL PATH GATE:** 3.1 must score >= 2/3

---

## Implementation Steps

### Step 1: Add Google Fonts to `index.html`

Add preconnect hints and font import link in the `<head>` section, before the `<title>` tag:

```html
<!-- Google Fonts: preconnect for performance -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<!-- Font imports: Marcellus (display), Source Sans 3 (UI), Source Serif 4 (lore/text) -->
<link
  href="https://fonts.googleapis.com/css2?family=Marcellus&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&display=swap"
  rel="stylesheet"
/>
```

**Key details:**
- `display=swap` ensures text remains visible during font load (criterion 3.7)
- Preconnect hints reduce DNS/TLS overhead (criterion 3.7)
- Marcellus only comes in regular weight (400)
- Source Sans 3 needs 400, 600, 700 weights plus italic 400
- Source Serif 4 needs 400, 600, 700 weights plus italic 400

### Step 2: Define font tokens in `:root` of `src/theme/theme.css`

This should be done as part of SS-01, but verify/add if not present:

```css
--font-display: 'Marcellus', Georgia, serif;
--font-ui: 'Source Sans 3', Arial, Helvetica, sans-serif;
--font-text: 'Source Serif 4', Georgia, serif;
```

### Step 3: Update `body` style rule in `src/theme/theme.css`

Change the body font-family from `var(--font-family)` to `var(--font-ui)`:

```css
body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-ui);
  font-size: var(--size-md);
  line-height: var(--lh-normal);
  min-height: 100vh;
}
```

### Step 4: Add heading styles to `src/theme/theme.css`

Add a global heading rule after the body rule:

```css
/* Headings use display font */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
  line-height: var(--lh-tight);
}

h1 {
  font-size: var(--size-3xl);
  font-weight: var(--weight-bold);
}

h2 {
  font-size: var(--size-2xl);
  font-weight: var(--weight-bold);
}

h3 {
  font-size: var(--size-xl);
  font-weight: var(--weight-semibold);
}

h4 {
  font-size: var(--size-lg);
  font-weight: var(--weight-semibold);
}

h5 {
  font-size: var(--size-md);
  font-weight: var(--weight-semibold);
}

h6 {
  font-size: var(--size-sm);
  font-weight: var(--weight-semibold);
}
```

### Step 5: Remove legacy `--font-family` token or alias it

In `:root`, either:
- Remove `--font-family` entirely and update all references, OR
- Alias it: `--font-family: var(--font-ui);`

The parchment theme's per-theme `--font-family` override must be removed (it sets Georgia, which is no longer correct — all themes share the same font tokens).

### Step 6: Verify no decorative fonts on body/form text

Ensure:
- `body` uses `--font-ui` (Source Sans 3 — readable sans-serif)
- `input`, `textarea`, `select`, `button` inherit `--font-ui`
- Only `h1`-`h6` and decorative titles use `--font-display` (Marcellus)
- `--font-text` (Source Serif 4) is available for lore/narrative content but NOT used for form fields

Add a rule for form elements if not already present:

```css
input, textarea, select, button {
  font-family: var(--font-ui);
}
```

---

## Files to Modify

| File | Action | What Changes |
|------|--------|-------------|
| `index.html` | Modify | Add Google Fonts preconnect + import links in `<head>` |
| `src/theme/theme.css` | Modify | Update body font-family, add heading styles, add form element font rule, remove parchment font override |

---

## Verification Commands

```bash
# 3.1: Google Fonts import exists
grep "fonts.googleapis.com" index.html
grep "Marcellus" index.html
grep "Source+Sans+3" index.html
grep "Source+Serif+4" index.html

# 3.2: --font-display token
grep "\-\-font-display.*Marcellus" src/theme/theme.css

# 3.3: --font-ui token
grep "\-\-font-ui.*Source Sans 3" src/theme/theme.css

# 3.4: --font-text token
grep "\-\-font-text.*Source Serif 4" src/theme/theme.css

# 3.5: Body uses --font-ui
grep "font-family.*\-\-font-ui" src/theme/theme.css

# 3.6: Headings use --font-display
grep -A 2 "h1.*h2.*h3" src/theme/theme.css
grep "font-family.*\-\-font-display" src/theme/theme.css

# 3.7: Preconnect hints
grep "preconnect" index.html
grep "display=swap" index.html

# 3.8: No decorative fonts on body/form
grep "font-family" src/theme/theme.css
# Verify body and input/textarea/select/button use --font-ui
```

---

## Constraints

- Only use Google Fonts (free, no licensing issues)
- `font-display: swap` must be used for performance
- Fallback stacks must include system fonts (Georgia for serif, Arial/Helvetica for sans-serif)
- Marcellus is ONLY for display/headings — never for body text or form inputs
- Source Sans 3 is the primary UI font — used for body, forms, buttons, navigation
- Source Serif 4 is for lore/narrative content — available but not default
