# Phase Spec: SS-02 — Three Cohesive Fantasy Themes

**Sub-Spec:** SS-2
**Weight:** 3 (Critical)
**Dependencies:** SS-01 (Design Token System) must be completed first. SS-02 populates the color values into the token structure created by SS-01.

---

## Intent

Provide light ("Camp Before the Hunt"), dark ("Torchlight in the Barrow"), and parchment ("The Adventurer's Ledger") themes that feel like the same Dragonbane-inspired product across all modes. Each must use its specified color palette exactly.

---

## Current State Analysis

**File:** `src/theme/theme.css` — Three `[data-theme]` blocks exist (lines 26–94)

**Current palettes vs. required:**

| Token | Dark Current | Dark Required | Light Current | Light Required | Parchment Current | Parchment Required |
|-------|-------------|---------------|---------------|----------------|-------------------|-------------------|
| `--color-bg` | `#0f0f1a` | `#121613` | `#f5f5f5` | `#EEE6D2` | `#f5ead6` | `#D9C59A` |
| `--color-surface` | `#1a1a2e` | `#1A211D` | `#ffffff` | `#F7F1E2` | `#fffbf0` | `#E8D8B2` |
| `--color-accent` | `#7b68ee` (purple) | `#2F877A` (jade) | `#7b1fa2` | `#1F6E66` | `#6b3a7d` | `#2B756B` |

All three themes need complete color replacement from current values to spec values.

**Theme switching mechanism:** Works via `ThemeProvider.tsx` setting `data-theme` attribute on `document.documentElement` with localStorage persistence — this is correct and should not change.

**File:** `src/theme/themes.ts` — Exports `ThemeName` type, `DEFAULT_THEME`, and `THEME_STORAGE_KEY`. Needs theme display names added.

---

## Acceptance Criteria

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

**CRITICAL PATH GATE:** 2.1 + 2.2 + 2.3 must score >= 7/9

---

## Implementation Steps

### Step 1: Replace the `[data-theme="light"]` block in `src/theme/theme.css`

Replace the entire light theme block (currently lines 73–94) with:

```css
/* Light theme — "Camp Before the Hunt" */
[data-theme="light"] {
  --color-bg: #EEE6D2;
  --color-surface: #F7F1E2;
  --color-surface-alt: #EAE0C7;
  --color-text: #2D241B;
  --color-text-muted: #6C5B46;
  --color-accent: #1F6E66;
  --color-accent-alt: #154B47;
  --color-danger: #B63828;
  --color-border: #A69170;
  --color-gold: #A98235;
  --color-success: #5D7A49;
  --color-warning: #B96A2A;
  --color-info: #3E6C73;
}
```

### Step 2: Replace the `[data-theme="dark"]` block

Replace the entire dark theme block (currently lines 26–47) with:

```css
/* Dark theme — "Torchlight in the Barrow" */
[data-theme="dark"] {
  --color-bg: #121613;
  --color-surface: #1A211D;
  --color-surface-alt: #222B26;
  --color-text: #E9DFC7;
  --color-text-muted: #B5A88E;
  --color-accent: #2F877A;
  --color-accent-alt: #73B6AA;
  --color-danger: #D14935;
  --color-border: #3E4B43;
  --color-gold: #AA8240;
  --color-success: #6E8C54;
  --color-warning: #C07A35;
  --color-info: #6A9CA4;
}
```

### Step 3: Replace the `[data-theme="parchment"]` block

Replace the entire parchment theme block (currently lines 49–71) with:

```css
/* Parchment theme — "The Adventurer's Ledger" */
[data-theme="parchment"] {
  --color-bg: #D9C59A;
  --color-surface: #E8D8B2;
  --color-surface-alt: #F1E4C8;
  --color-text: #3A2B18;
  --color-text-muted: #6B573C;
  --color-accent: #2B756B;
  --color-accent-alt: #184A46;
  --color-danger: #A52F22;
  --color-border: #8A7451;
  --color-gold: #9C7934;
  --color-success: #667C4A;
  --color-warning: #AF6D2B;
  --color-info: #52727A;
}
```

### Step 4: Remove obsolete tokens from theme blocks

Remove from ALL theme blocks (they no longer exist in the new spec):
- `--color-primary` (replaced by `--color-accent`)
- `--color-primary-hover` (handle in interaction states SS-05)
- `--color-primary-text` (replaced by computed contrast or `--color-bg`)
- `--color-text-inverse` (no longer needed)
- `--color-divider` (use `--color-border` instead)
- `--shadow-sm` / `--shadow-md` (moved to `:root` in SS-01)
- `--font-family` per-theme override (removed in SS-01)

### Step 5: Update references to removed tokens

Components/CSS that reference removed tokens must be updated:
- `--color-primary` -> `--color-accent` (used in TopBar `.top-bar__title`, `.top-bar__character:hover`, `BottomNav .bottom-nav__item--active`, `Button.tsx` primary variant)
- `--color-primary-text` -> use appropriate contrast color or `--color-bg`
- `--color-text-inverse` -> use `--color-bg` or a computed value
- `--color-divider` -> `--color-border`
- `--shadow-sm` -> `--shadow-soft`
- `--shadow-md` -> `--shadow-medium`

**Files needing token rename updates:**
- `src/theme/theme.css` — all CSS rules referencing old names
- `src/components/primitives/Button.tsx` — `--color-primary` -> `--color-accent`, `--color-primary-text` -> appropriate value, `--color-text-inverse` -> `--color-bg`
- `src/components/layout/TopBar.tsx` — inline styles using `--color-text-inverse`
- `src/components/primitives/Modal.tsx` — if using `--shadow-md`

### Step 6: Update `src/theme/themes.ts`

Add theme display names for UI consumption:

```typescript
export type ThemeName = 'dark' | 'parchment' | 'light';

export const DEFAULT_THEME: ThemeName = 'dark';
export const THEME_STORAGE_KEY = 'skaldbok-theme';

export const THEME_DISPLAY_NAMES: Record<ThemeName, string> = {
  light: 'Camp Before the Hunt',
  dark: 'Torchlight in the Barrow',
  parchment: "The Adventurer's Ledger",
};

export const THEME_LIST: ThemeName[] = ['light', 'dark', 'parchment'];
```

### Step 7: Verify ThemeProvider.tsx — no changes needed

The current `ThemeProvider.tsx` already:
- Sets `data-theme` attribute on `document.documentElement` (criterion 2.4)
- Persists to localStorage (criterion 2.5)
- Validates stored theme value (criterion 2.4/2.5)

No changes required to this file.

---

## Files to Modify

| File | Action | What Changes |
|------|--------|-------------|
| `src/theme/theme.css` | Major rewrite | Replace all three `[data-theme]` blocks with new palettes; remove obsolete tokens |
| `src/theme/themes.ts` | Modify | Add `THEME_DISPLAY_NAMES` and `THEME_LIST` exports |
| `src/components/primitives/Button.tsx` | Modify | Rename `--color-primary` references to `--color-accent` |
| `src/components/layout/TopBar.tsx` | Modify | Rename `--color-primary` and `--color-text-inverse` references |
| `src/components/primitives/Modal.tsx` | Minor modify | Update shadow token reference if needed |
| `src/components/primitives/Card.tsx` | Minor modify | Update shadow token reference (`--shadow-sm` -> `--shadow-soft`) |

---

## Verification Commands

```bash
# 2.1: Light theme — verify all 13 colors exist with correct values
grep -A 15 'data-theme="light"' src/theme/theme.css | grep "#EEE6D2"
grep -A 15 'data-theme="light"' src/theme/theme.css | grep "#F7F1E2"
grep -A 15 'data-theme="light"' src/theme/theme.css | grep "#1F6E66"
grep -A 15 'data-theme="light"' src/theme/theme.css | grep "#A98235"
grep -A 15 'data-theme="light"' src/theme/theme.css | grep "#3E6C73"

# 2.2: Dark theme — verify all 13 colors exist with correct values
grep -A 15 'data-theme="dark"' src/theme/theme.css | grep "#121613"
grep -A 15 'data-theme="dark"' src/theme/theme.css | grep "#1A211D"
grep -A 15 'data-theme="dark"' src/theme/theme.css | grep "#2F877A"
grep -A 15 'data-theme="dark"' src/theme/theme.css | grep "#AA8240"
grep -A 15 'data-theme="dark"' src/theme/theme.css | grep "#6A9CA4"

# 2.3: Parchment theme — verify all 13 colors exist with correct values
grep -A 15 'data-theme="parchment"' src/theme/theme.css | grep "#D9C59A"
grep -A 15 'data-theme="parchment"' src/theme/theme.css | grep "#E8D8B2"
grep -A 15 'data-theme="parchment"' src/theme/theme.css | grep "#2B756B"
grep -A 15 'data-theme="parchment"' src/theme/theme.css | grep "#9C7934"
grep -A 15 'data-theme="parchment"' src/theme/theme.css | grep "#52727A"

# 2.6: No pure white or pure black
grep -c "#FFFFFF\|#ffffff\|#000000" src/theme/theme.css
# Expected: 0

# 2.7: themes.ts consistency
grep "ThemeName" src/theme/themes.ts
grep "THEME_DISPLAY_NAMES" src/theme/themes.ts
```

---

## Constraints

- Hex color values MUST match spec exactly (case-insensitive is OK, but values must be identical)
- Do NOT use pure `#FFFFFF` or `#000000` anywhere
- Preserve `--color-mode-play` and `--color-mode-edit` if TopBar still needs them (these are outside the 13 semantic tokens but used by the mode indicator)
- Theme switching mechanism must not change — `data-theme` attribute + localStorage
- Do NOT change the ThemeProvider.tsx logic unless absolutely necessary
