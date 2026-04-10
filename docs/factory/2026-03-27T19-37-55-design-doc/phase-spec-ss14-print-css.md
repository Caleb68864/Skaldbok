# Phase Spec — SS-14: Print CSS (`print-sheet.css`)

**Run:** 2026-03-27T19-37-55-design-doc
**Sub-Spec:** SS-14
**Priority:** P0 | **Impact:** 5 | **Risk:** 4
**Dependency:** None — can be implemented in parallel with SS-03. All visual sub-specs (SS-04 through SS-13) depend on this file for color/layout rules.

---

## Objective

Create the CSS file that makes this a real printable sheet. Defines page setup, sheet dimensions, color/B&W mode classes, font usage, toolbar hiding, and the hard one-page constraint. This is an intentional exception to the codebase's inline-styles convention because `@page` and `@media print` rules cannot be expressed as inline styles.

---

## Files to Create

| File | Action |
|---|---|
| `src/styles/print-sheet.css` | Create: print-optimized CSS |

> If `src/styles/` does not exist, the agent may place the file at `src/print-sheet.css` or any location that can be imported from `PrintableSheetScreen.tsx` or `PrintableSheet.tsx`. Record the chosen path.

---

## Implementation Steps

### 1. Create the CSS File with All Required Rules

```css
/* ============================================================
   print-sheet.css
   Print-optimized styles for the Dragonbane character sheet.
   Intentional exception to inline-styles convention:
   @page and @media print cannot be expressed as inline styles.
   ============================================================ */

/* ----- Page Setup ----- */
@page {
  size: letter portrait;
  margin: 0.25in;
}

/* ----- Sheet Container ----- */
.print-sheet {
  width: 8.5in;
  height: 11in;
  overflow: hidden;
  box-sizing: border-box;
  font-family: var(--font-text, 'Source Sans 3', sans-serif);
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
  position: relative;
}

/* ----- Print Media: Hide Toolbar & Reset Body ----- */
@media print {
  .print-toolbar {
    display: none !important;
  }
  body {
    margin: 0;
    padding: 0;
  }
}

/* ----- Color Mode ----- */
.print-sheet--color {
  background-color: #f5f0e8; /* parchment */
  color: #1a1a1a;
}

.print-sheet--color .sheet-header {
  background-color: #2a7a7a; /* teal */
  color: #ffffff;
  padding: 4px 6px;
}

.print-sheet--color .sheet-title {
  color: #ffffff;
}

.print-sheet--color .sheet-section-header {
  color: #2a7a7a;
  border-bottom-color: #2a7a7a;
}

.print-sheet--color .hp-dot-filled {
  background-color: #c0392b;
  border-color: #c0392b;
}

.print-sheet--color .wp-dot-filled {
  background-color: #27ae60;
  border-color: #27ae60;
}

/* ----- B&W Mode ----- */
.print-sheet--bw {
  background-color: #ffffff;
  color: #000000;
}

.print-sheet--bw .sheet-header {
  background-color: #1a1a1a;
  color: #ffffff;
  padding: 4px 6px;
}

.print-sheet--bw .sheet-title {
  color: #ffffff;
}

.print-sheet--bw .sheet-section-header {
  color: #000000;
  border-bottom-color: #000000;
}

.print-sheet--bw .hp-dot-filled {
  background-color: #333333;
  border-color: #333333;
}

.print-sheet--bw .wp-dot-filled {
  background-color: #333333;
  border-color: #333333;
}

/* ----- Typography Baseline ----- */
/* Minimum text size: 7pt / ~9px. No text may be smaller. */
.print-sheet * {
  min-font-size: 7pt; /* not a real CSS property — enforced by not writing smaller sizes below */
  line-height: 1.2;
}

/* Font roles (use CSS variables from app's bundled fonts) */
.print-sheet .sheet-title,
.print-sheet .sheet-section-header {
  font-family: var(--font-display, 'Marcellus', serif);
}

.print-sheet .sheet-label,
.print-sheet .sheet-attribute-label,
.print-sheet .sheet-derived-label,
.print-sheet .sheet-field-label,
.print-sheet .sheet-inventory-label,
.print-sheet .sheet-currency-label,
.print-sheet .sheet-condition-label,
.print-sheet .sheet-death-label,
.print-sheet .sheet-dot-label,
.print-sheet .sheet-checkbox-label,
.print-sheet .sheet-equipment-type-label {
  font-family: var(--font-ui, 'Source Serif 4', serif);
}

/* Body text */
.print-sheet .sheet-value,
.print-sheet .sheet-attribute-value,
.print-sheet .sheet-derived-value,
.print-sheet .sheet-currency-value,
.print-sheet .sheet-inventory-name,
.print-sheet .sheet-skill-name,
.print-sheet .sheet-skill-value,
.print-sheet .sheet-ability-row,
.print-sheet .sheet-field-value {
  font-family: var(--font-text, 'Source Sans 3', sans-serif);
}

/* ----- Floating Toolbar (screen only) ----- */
.print-toolbar {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 1000;
  display: flex;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.95);
  padding: 0.5rem;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.2);
}

.print-toolbar button {
  padding: 0.4rem 0.8rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  background: #ffffff;
}

.print-toolbar button:hover {
  background: #f0f0f0;
}

/* ----- No External Fonts ----- */
/*
  IMPORTANT: Do NOT add any @import url(...) for Google Fonts or any CDN.
  The app bundles its own fonts. Use var(--font-display), var(--font-ui),
  and var(--font-text) CSS custom properties defined by the app theme.
  Fallback stacks are included above for robustness.
*/
```

### 2. Import Location
Import this CSS file in `PrintableSheetScreen.tsx` (or `PrintableSheet.tsx`):
```typescript
import '../styles/print-sheet.css'; // adjust relative path to match file location
```

### 3. Font Rules — No External CDN
- **Do not** add `@import url('https://fonts.googleapis.com/...')` or any external URL.
- **Do not** add `<link>` tags in the HTML for any font CDN.
- Use only `var(--font-display)`, `var(--font-ui)`, `var(--font-text)` CSS variables — these are defined by the app's existing theme/global CSS.
- Include font-family fallback stacks (e.g., `'Marcellus', serif`) as fallbacks only.

### 4. Minimum Text Size Enforcement
- Review all CSS rules across SS-04 through SS-13 that define `font-size`.
- No `font-size` value may be below `7pt` or `9px`.
- The threshold: `7pt ≈ 9.3px` at 96dpi screen, `≈ 9.8px` at 72dpi — use `7pt` as the smallest value.

---

## Verification

- Open Chrome Print Preview (Ctrl+P): page margins are 0.25in, size is letter portrait.
- `.print-sheet` in browser computed styles: `width: 816px` (8.5in at 96dpi), `height: 1056px`.
- Toggle color mode: color class shows teal header + parchment background; B&W class shows black header + white background.
- Print Preview: toolbar not visible.
- Inspect all font-size values — none below 7pt / 9px.
- No external `@import` or CDN references in the file.

---

## Acceptance Criteria

- [ ] `14.1` `@page { size: letter portrait; margin: 0.25in; }` is defined
- [ ] `14.2` `.print-sheet` has `width: 8.5in; height: 11in; overflow: hidden`
- [ ] `14.3` `print-color-adjust: exact` and `-webkit-print-color-adjust: exact` are set
- [ ] `14.4` `@media print` hides `.print-toolbar`
- [ ] `14.5` Color and B&W mode classes produce visually distinct outputs
- [ ] `14.6` No external font CDN `@import` or `<link>` tags
- [ ] `14.7` No text is smaller than 7pt / 9px on screen
