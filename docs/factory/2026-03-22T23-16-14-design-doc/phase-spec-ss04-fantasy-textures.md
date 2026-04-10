# Phase Spec — SS-04: CSS-Only Fantasy Texture System

## Dependencies
None. Can be implemented independently. (Note: SS-01 stepper buttons will inherit the embossed input/button styles added here, but no code dependency exists.)

## Objective
Add CSS rules to `theme.css` that apply decorative fantasy textures across all three themes: noise grain on body, leather-strip panel headers, embossed inputs/buttons, beveled panel borders, and gold accent lines. Add classNames to `SectionPanel.tsx` for CSS targeting.

## Files to Modify
- `src/theme/theme.css`
- `src/components/primitives/SectionPanel.tsx`

## Files to Read (Reference Only)
- `src/theme/theme.css` — existing theme structure, custom properties, selectors
- `src/components/primitives/SectionPanel.tsx` — current structure, inline styles
- `src/components/layout/TopBar.tsx` — confirm `.top-bar` selector availability

## Acceptance Criteria
1. `[STRUCTURAL]` `body` receives a subtle noise grain via a repeating `radial-gradient` or similar CSS-only pattern applied as a `::before` or `::after` pseudo-element with `pointer-events: none` and `position: fixed` covering the viewport.
2. `[STRUCTURAL]` `.section-panel__header` (or equivalent selector targeting `SectionPanel` headers) receives a darker gradient background and a `border-bottom: 2px solid var(--color-gold)` gold accent.
3. `[STRUCTURAL]` `input`, `textarea`, `select`, and stepper/resource buttons receive an embossed look via `box-shadow: inset 0 2px 4px rgba(0,0,0,0.2), inset 0 -1px 2px rgba(255,255,255,0.1)` or similar.
4. `[STRUCTURAL]` `.section-panel` (or equivalent selector) receives a beveled border effect: lighter shadow on top-left edge, darker shadow on bottom-right edge.
5. `[STRUCTURAL]` `.top-bar` receives a `border-bottom` using `var(--color-gold)` or the existing mode-colored border is supplemented with a gold accent.
6. `[STRUCTURAL]` Headings (`h1`–`h3`) inside panels receive a subtle gold underline or bottom border accent.
7. `[BEHAVIORAL]` All texture values (grain opacity, shadow depths, gold color) derive from CSS custom properties defined in each `[data-theme]` block, so dark/parchment/light each get appropriate intensity.
8. `[STRUCTURAL]` Each theme block (`[data-theme="dark"]`, `[data-theme="parchment"]`, `[data-theme="light"]`) gains texture-specific custom properties: `--texture-grain-opacity`, `--texture-shadow-strength`, `--texture-highlight-strength`.
9. `[BEHAVIORAL]` All pseudo-elements used for textures have `pointer-events: none` and `z-index` that does not intercept clicks on interactive elements.
10. `[BEHAVIORAL]` Text contrast ratios remain unchanged — textures are applied behind or around text, not over it.
11. `[STRUCTURAL]` `SectionPanel.tsx` adds a `className` (e.g., `section-panel`, `section-panel__header`, `section-panel__body`) to its root div, header div, and content div so CSS can target them without inline style conflicts.
12. `[MECHANICAL]` `vite build` succeeds with no errors after all CSS additions.

## Implementation Steps

1. **Read `theme.css`** thoroughly — understand all existing `[data-theme]` blocks, custom properties, and selectors. Identify insertion points for texture properties and rules.
2. **Read `SectionPanel.tsx`** — understand the current div structure, inline styles, and how to add classNames without breaking existing styles.
3. **Modify `SectionPanel.tsx`** — Add classNames:
   - Root div: `className="section-panel"`
   - Header div (the clickable/collapsible header): `className="section-panel__header"`
   - Content/body div: `className="section-panel__body"`
   - Ensure existing inline styles are preserved — classNames are additive.
   - If the component already uses `className` props, merge them.
4. **Modify `theme.css`** — Add texture custom properties to each theme block:
   ```css
   [data-theme="dark"] {
     --texture-grain-opacity: 0.06;
     --texture-shadow-strength: 0.3;
     --texture-highlight-strength: 0.08;
     --color-gold: #9C7934; /* if not already defined */
   }
   [data-theme="parchment"] {
     --texture-grain-opacity: 0.04;
     --texture-shadow-strength: 0.15;
     --texture-highlight-strength: 0.12;
   }
   [data-theme="light"] {
     --texture-grain-opacity: 0.03;
     --texture-shadow-strength: 0.1;
     --texture-highlight-strength: 0.15;
   }
   ```
5. **Add body noise grain** — Using `body::before`:
   ```css
   body::before {
     content: '';
     position: fixed;
     top: 0; left: 0; right: 0; bottom: 0;
     pointer-events: none;
     z-index: 9999; /* above content, but pointer-events: none */
     opacity: var(--texture-grain-opacity);
     background-image: repeating-radial-gradient(
       circle at 1px 1px, transparent 0, transparent 1px,
       rgba(0,0,0,0.08) 1px, rgba(0,0,0,0.08) 2px
     );
     background-size: 3px 3px;
   }
   ```
   - Use small dimensions (2–4px) for fine grain on retina displays.
   - `position: fixed` so it doesn't scroll or create extra scrollable area.
6. **Add `.section-panel__header` leather treatment**:
   ```css
   .section-panel__header {
     background: linear-gradient(
       180deg,
       rgba(255,255,255, var(--texture-highlight-strength)) 0%,
       transparent 40%,
       rgba(0,0,0, var(--texture-shadow-strength)) 100%
     );
     border-bottom: 2px solid var(--color-gold);
   }
   ```
7. **Add embossed inputs/buttons**:
   ```css
   input, textarea, select, .resource-tracker button, .section-panel button {
     box-shadow: inset 0 2px 4px rgba(0,0,0, var(--texture-shadow-strength)),
                 inset 0 -1px 2px rgba(255,255,255, var(--texture-highlight-strength));
   }
   ```
8. **Add beveled `.section-panel` borders**:
   ```css
   .section-panel {
     box-shadow:
       1px 1px 2px rgba(0,0,0, var(--texture-shadow-strength)),
       -1px -1px 2px rgba(255,255,255, var(--texture-highlight-strength));
   }
   ```
9. **Add gold accent on `.top-bar`**:
   ```css
   .top-bar {
     border-bottom: 3px solid var(--color-gold);
   }
   ```
   - Note: SS-02 also sets a mode-colored border. Coordinate: either use `box-shadow` for gold accent and `border-bottom` for mode color, or layer them. The CSS rule here may need to account for the inline style from TopBar.tsx — use lower specificity or complementary properties.
10. **Add gold accents on headings inside panels**:
    ```css
    .section-panel h1, .section-panel h2, .section-panel h3 {
      border-bottom: 1px solid var(--color-gold);
      padding-bottom: 4px;
    }
    ```
11. **Verify** all pseudo-elements have `pointer-events: none`.
12. **Verify** no layout shifts — textures use shadows, pseudo-elements, and borders only.

## Edge Cases
- **Inline styles vs CSS classes on SectionPanel:** Adding classNames must not override existing inline styles. CSS rules should use specificity carefully or only target properties not set inline (shadows, borders, gradients).
- **Texture grain on high-DPI screens:** Use 2–4px pattern size for fine grain appearance on retina.
- **Body pseudo-element and scroll:** `position: fixed` prevents scroll extension.
- **Gold accent on parchment theme:** Gold (#9C7934) on parchment (#E8D8B2) is decorative only — no semantic meaning.
- **Top bar gold vs mode border conflict:** If SS-02 sets `borderBottom` inline, CSS `border-bottom` on `.top-bar` may be overridden. Consider using `box-shadow` for the gold accent instead, or apply gold as a secondary `::after` pseudo-element.
- **theme.css size:** If additions push past 800 lines, escalate for potential split into `theme-textures.css`.

## Constraints
- CSS-only — no JavaScript for textures.
- No images or external assets.
- No changes to layout or spacing tokens (`--space-*`, `--radius-*`).
- Texture pseudo-elements MUST NOT cause scrollbar overflow.
- `SectionPanel` className additions MUST NOT break existing inline styles.
- All texture colors use `rgba()` with CSS custom property-driven opacity/strength — no hardcoded theme-specific colors.
- Must not modify `AppStateContext.tsx`, `modeGuards.ts`, or any data/type files.
- Must not add new npm dependencies.
- Must not reduce text contrast ratios in any theme.

## Verification Commands
```bash
# Build must succeed
npx vite build

# Verify texture custom properties in theme blocks
grep -n "texture-grain-opacity\|texture-shadow-strength\|texture-highlight-strength" src/theme/theme.css
# Expected: properties in all 3 theme blocks

# Verify body grain pseudo-element
grep -n "body::before\|body::after" src/theme/theme.css
# Expected: noise grain rule

# Verify pointer-events: none on pseudo-elements
grep -n "pointer-events.*none" src/theme/theme.css
# Expected: at least 1 match on texture pseudo-elements

# Verify section-panel classNames added
grep -n "section-panel" src/components/primitives/SectionPanel.tsx
# Expected: className="section-panel", section-panel__header, section-panel__body

# Verify gold accent
grep -n "color-gold" src/theme/theme.css
# Expected: multiple matches for border/accent rules

# Verify embossed box-shadow on inputs
grep -n "box-shadow.*inset" src/theme/theme.css
# Expected: embossed shadow rules

# Verify beveled panel shadow
grep -n "section-panel" src/theme/theme.css
# Expected: beveled box-shadow rule
```
