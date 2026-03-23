# Specification: Dragonbane PWA Theme Foundation

**Task:** `dragonbane_pwa_theme_foundation`
**Run:** `2026-03-22T21-04-17-design-doc`
**Branch:** `2026/03/22-1941-caleb-feat-design-doc`
**Phase:** forge
**Score Model:** weighted acceptance criteria (1–3 points each)

---

## Intent Hierarchy

```
Mission ─► Skaldmark: The Adventurer's Ledger — a Dragonbane-inspired character sheet PWA
  └─ Goal ─► Implement full visual theme foundation (colors, fonts, tokens, surfaces, component styling)
       ├─ Sub-goal 1 ─► Design token system (centralized, semantic, switchable)
       ├─ Sub-goal 2 ─► Three cohesive fantasy themes (light, dark, parchment)
       ├─ Sub-goal 3 ─► Font pairing system (display, UI, lore)
       ├─ Sub-goal 4 ─► Base component styling foundations
       └─ Sub-goal 5 ─► Interaction states & accessibility
```

---

## Sub-Specs

### SS-1: Design Token System (Weight: 3 — Critical)

**Intent:** Centralize all visual design values into a single token source so themes, components, and future artwork layers all reference the same system.

**Current State:** `src/theme/theme.css` already defines CSS variables per theme via `[data-theme]` selectors. Existing tokens cover basic colors, spacing, radius, fonts, and shadows — but the set is incomplete relative to the input document's requirements (missing `--color-gold`, `--color-info`, `--font-display`, `--font-text`, typography scale tokens, border tokens, and several shadow variants).

**Acceptance Criteria:**

| # | Criterion | Points | Verification |
|---|-----------|--------|-------------|
| 1.1 | All 13 semantic color tokens exist as CSS custom properties (`--color-bg`, `--color-surface`, `--color-surface-alt`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-alt`, `--color-danger`, `--color-border`, `--color-gold`, `--color-success`, `--color-warning`, `--color-info`) | 3 | grep theme.css for each variable name |
| 1.2 | All 3 font family tokens exist (`--font-display`, `--font-ui`, `--font-text`) with correct values per spec | 2 | grep theme.css |
| 1.3 | Typography scale tokens exist (`--size-xs` through `--size-3xl`, weight tokens, line-height tokens) | 2 | grep theme.css |
| 1.4 | Spacing tokens exist (`--space-1` through `--space-10`) per spec values | 2 | grep theme.css |
| 1.5 | Radius tokens exist (`--radius-sm` 8px, `--radius-md` 12px, `--radius-lg` 16px, `--radius-xl` 20px) | 1 | grep theme.css |
| 1.6 | Shadow tokens exist (`--shadow-soft`, `--shadow-medium`, `--shadow-deep`, `--shadow-inset-soft`) | 2 | grep theme.css |
| 1.7 | Border tokens exist (`--border-thin`, `--border-strong`) referencing `--color-border` | 1 | grep theme.css |
| 1.8 | All tokens defined in a single centralized file (`src/theme/theme.css` or equivalent) — not scattered across component files | 2 | file inspection |
| 1.9 | No component files contain hardcoded hex color values that should use tokens | 2 | grep src/components for hex codes |

**Total: 17 points**

---

### SS-2: Three Cohesive Fantasy Themes (Weight: 3 — Critical)

**Intent:** Provide light ("Camp Before the Hunt"), dark ("Torchlight in the Barrow"), and parchment ("The Adventurer's Ledger") themes that feel like the same Dragonbane-inspired product across all modes. Each must use its specified color palette.

**Current State:** Three themes exist (`light`, `dark`, `parchment`) with `[data-theme]` selectors. Colors are defined but use a different palette than the spec requires (e.g., dark theme uses purple accents instead of jade/verdigris greens). Theme switching works via `ThemeProvider` + `data-theme` attribute + localStorage persistence.

**Acceptance Criteria:**

| # | Criterion | Points | Verification |
|---|-----------|--------|-------------|
| 2.1 | Light theme defines all 13 color tokens matching spec values (bg `#EEE6D2`, surface `#F7F1E2`, surface_alt `#EAE0C7`, text `#2D241B`, text_muted `#6C5B46`, accent `#1F6E66`, accent_alt `#154B47`, danger `#B63828`, border `#A69170`, gold `#A98235`, success `#5D7A49`, warning `#B96A2A`, info `#3E6C73`) | 3 | grep theme.css `[data-theme="light"]` block |
| 2.2 | Dark theme defines all 13 color tokens matching spec values (bg `#121613`, surface `#1A211D`, surface_alt `#222B26`, text `#E9DFC7`, text_muted `#B5A88E`, accent `#2F877A`, accent_alt `#73B6AA`, danger `#D14935`, border `#3E4B43`, gold `#AA8240`, success `#6E8C54`, warning `#C07A35`, info `#6A9CA4`) | 3 | grep theme.css `[data-theme="dark"]` block |
| 2.3 | Parchment theme defines all 13 color tokens matching spec values (bg `#D9C59A`, surface `#E8D8B2`, surface_alt `#F1E4C8`, text `#3A2B18`, text_muted `#6B573C`, accent `#2B756B`, accent_alt `#184A46`, danger `#A52F22`, border `#8A7451`, gold `#9C7934`, success `#667C4A`, warning `#AF6D2B`, info `#52727A`) | 3 | grep theme.css `[data-theme="parchment"]` block |
| 2.4 | Theme switching mechanism works via `data-theme` attribute on root element | 1 | inspect ThemeProvider.tsx |
| 2.5 | Theme selection persists across sessions (localStorage or IndexedDB) | 1 | inspect ThemeProvider.tsx / AppStateContext.tsx |
| 2.6 | No theme uses pure white (`#FFFFFF`) or pure black (`#000000`) as bg/surface/text | 1 | grep theme.css |
| 2.7 | `themes.ts` exports theme identifiers consistent with CSS selectors | 1 | inspect themes.ts |

**Total: 13 points**

---

### SS-3: Font Pairing System (Weight: 2 — Important)

**Intent:** Establish a three-tier font system (Marcellus for display, Source Sans 3 for UI, Source Serif 4 for lore) that feels fantasy-adjacent yet highly readable on tablet/mobile.

**Current State:** No custom fonts imported. System fonts and Georgia used. No `--font-display` or `--font-text` tokens.

**Acceptance Criteria:**

| # | Criterion | Points | Verification |
|---|-----------|--------|-------------|
| 3.1 | Google Fonts (or equivalent) import exists for Marcellus, Source Sans 3, and Source Serif 4 | 3 | inspect index.html or CSS @import |
| 3.2 | `--font-display` resolves to `'Marcellus', Georgia, serif` | 2 | grep theme.css |
| 3.3 | `--font-ui` resolves to `'Source Sans 3', Arial, Helvetica, sans-serif` | 2 | grep theme.css |
| 3.4 | `--font-text` resolves to `'Source Serif 4', Georgia, serif` | 2 | grep theme.css |
| 3.5 | Body text uses `--font-ui` by default | 1 | inspect body style rule |
| 3.6 | Heading elements (h1–h6 or equivalent) use `--font-display` | 2 | inspect heading style rules |
| 3.7 | Font loading is efficient (preconnect hints, `font-display: swap`, or equivalent) | 1 | inspect index.html / CSS |
| 3.8 | No decorative/unreadable fantasy fonts used for body or form text | 1 | manual review of font assignments |

**Total: 14 points**

---

### SS-4: Base Component Styling Foundations (Weight: 2 — Important)

**Intent:** Restyle primitive components (buttons, inputs, cards, tabs, headings, modals) so they feel like physical fantasy field-book objects rather than default browser controls — using only tokens, no artwork.

**Current State:** Components use inline React styles referencing existing CSS variables. Button has primary/secondary/danger variants. Card, Modal, SectionPanel, Drawer exist. BottomNav provides tab navigation. Styling is functional but generic — not yet themed to the Dragonbane fantasy aesthetic.

**Acceptance Criteria:**

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

### SS-5: Interaction States & Accessibility (Weight: 2 — Important)

**Intent:** Ensure hover, active, focus, disabled, and error states are implemented consistently using theme tokens, with strong accessibility compliance for tablet/mobile use.

**Current State:** Basic hover states on some buttons. Focus visibility unclear. No systematic interaction state layer.

**Acceptance Criteria:**

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

## Scoring Summary

| Sub-Spec | Description | Weight | Max Points |
|----------|-------------|--------|------------|
| SS-1 | Design Token System | 3 (Critical) | 17 |
| SS-2 | Three Fantasy Themes | 3 (Critical) | 13 |
| SS-3 | Font Pairing System | 2 (Important) | 14 |
| SS-4 | Component Styling | 2 (Important) | 17 |
| SS-5 | Interaction & A11y | 2 (Important) | 12 |
| **Total** | | | **73** |

### Pass Thresholds

- **Full pass:** ≥ 66 / 73 (90%)
- **Conditional pass:** ≥ 55 / 73 (75%)
- **Fail:** < 55 / 73

### Critical-path gates (must pass regardless of total score):

- 2.1 + 2.2 + 2.3 ≥ 7 / 9 (all three themes define correct palettes)
- 1.1 ≥ 2 / 3 (semantic color tokens exist)
- 3.1 ≥ 2 / 3 (fonts are imported)

---

## Constraints & Ground Rules

1. **Correctness over speed.** Every token value must match the spec exactly.
2. **No shell commands.** Implementation via file edits only.
3. **Cross-platform.** CSS must work in modern browsers (Chrome, Firefox, Safari, Edge). No platform-specific hacks.
4. **No artwork.** Do not add SVGs, PNGs, texture images, or ornamental graphics. Theme must feel on-brand through color, typography, spacing, and shadow alone.
5. **Preserve existing functionality.** Theme switching, localStorage persistence, data-theme mechanism, and component APIs must continue to work.
6. **Token-first.** All visual values in components should reference CSS custom properties. No hardcoded hex in component files.
7. **Single source of truth.** All design tokens live in `src/theme/theme.css` (or a clearly organized set of theme files).

---

## Implementation Guidance

### File Map (expected changes)

| File | Action | Purpose |
|------|--------|---------|
| `index.html` | Modify | Add Google Fonts preconnect + import links |
| `src/theme/theme.css` | Major rewrite | Full token system, three theme palettes, typography scale, component base styles, interaction states |
| `src/theme/themes.ts` | Modify | Ensure exported theme IDs match CSS selectors; add theme display names |
| `src/theme/ThemeProvider.tsx` | Minor modify | Ensure default theme aligns with new system |
| `src/components/primitives/Button.tsx` | Modify | Use semantic tokens for all variants |
| `src/components/primitives/Card.tsx` | Modify | Use surface/shadow/border tokens |
| `src/components/primitives/Modal.tsx` | Modify | Use deep shadow, display font for headers |
| `src/components/primitives/SectionPanel.tsx` | Modify | Use surface tokens |
| `src/components/layout/TopBar.tsx` | Modify | Use accent/surface tokens, display font |
| `src/components/layout/BottomNav.tsx` | Modify | Use accent for active tab, surface tokens |

### Token Naming Convention

All CSS custom properties use these prefixes:
- `--color-*` — semantic colors
- `--font-*` — font families
- `--size-*` — font sizes
- `--weight-*` — font weights
- `--lh-*` — line heights
- `--space-*` — spacing
- `--radius-*` — border radii
- `--shadow-*` — box shadows
- `--border-*` — border shorthand tokens

### Theme Selector Pattern

```css
:root { /* shared tokens: spacing, radius, typography, shadows */ }
[data-theme="light"] { /* light palette colors */ }
[data-theme="dark"] { /* dark palette colors */ }
[data-theme="parchment"] { /* parchment palette colors */ }
```

---

## Definition of Done (from input document)

- [ ] App supports light, dark, and parchment themes
- [ ] Fonts are applied consistently and read well
- [ ] Theme modes feel cohesive and fantasy field-book inspired
- [ ] No artwork is required for the design to already feel on-brand
- [ ] Components look intentionally themed rather than default browser controls
- [ ] The system is ready for later addition of parchment textures and dragon-themed artwork
