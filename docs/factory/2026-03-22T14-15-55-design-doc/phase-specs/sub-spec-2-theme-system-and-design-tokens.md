---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 2
title: "Theme System and Design Tokens"
date: 2026-03-22
dependencies: ["1"]
---

# Sub-Spec 2: Theme System and Design Tokens

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Implement the three-theme system (dark, parchment, light) using CSS custom properties. Create a ThemeProvider context that reads/writes the active theme to localStorage and applies it by setting a `data-theme` attribute on the document root. Build all 8 primitive UI components specified in the design: Button, IconButton, Card, Chip, CounterControl, Drawer, Modal, SectionPanel. Dark theme is the default.

## Interface Contracts

### Provides
- `src/theme/themes.ts`: Exports `ThemeName` type (`'dark' | 'parchment' | 'light'`), `DEFAULT_THEME` constant, and theme metadata
- `src/theme/ThemeProvider.tsx`: Exports `ThemeProvider` component and `useTheme()` hook returning `{ theme: ThemeName, setTheme: (t: ThemeName) => void }`
- `src/theme/theme.css`: CSS custom properties for all three themes scoped under `[data-theme="dark"]`, `[data-theme="parchment"]`, `[data-theme="light"]`
- `src/components/primitives/Button.tsx`: `Button` component with `variant`, `size`, `disabled`, `onClick`, `children` props
- `src/components/primitives/IconButton.tsx`: `IconButton` component with `icon`, `label`, `onClick`, `disabled` props
- `src/components/primitives/Card.tsx`: `Card` component with `children`, `className` props
- `src/components/primitives/Chip.tsx`: `Chip` component with `label`, `active`, `onClick` props
- `src/components/primitives/CounterControl.tsx`: `CounterControl` component with `value`, `min`, `max`, `onChange`, `label`, `disabled` props
- `src/components/primitives/Drawer.tsx`: `Drawer` component with `open`, `onClose`, `title`, `children` props
- `src/components/primitives/Modal.tsx`: `Modal` component with `open`, `onClose`, `title`, `children`, `actions` props
- `src/components/primitives/SectionPanel.tsx`: `SectionPanel` component with `title`, `children`, `collapsible` props

### Requires
- From sub-spec 1: Working Vite + React project with `src/app/AppProviders.tsx` to nest `ThemeProvider` into

### Shared State
- `localStorage` key: `skaldbok-theme` -- stores the active theme name string

## Implementation Steps

### Step 1: Define theme CSS variables
- **File:** `src/theme/theme.css`
- **Action:** create
- **Changes:** Define CSS custom properties for all three themes. Variables must cover:
  - `--color-bg`, `--color-surface`, `--color-surface-alt`
  - `--color-text`, `--color-text-muted`, `--color-text-inverse`
  - `--color-primary`, `--color-primary-hover`, `--color-primary-text`
  - `--color-accent`, `--color-danger`, `--color-success`, `--color-warning`
  - `--color-border`, `--color-divider`
  - `--color-mode-play`, `--color-mode-edit` (for mode indicator colors)
  - `--radius-sm`, `--radius-md`, `--radius-lg`
  - `--space-xs`, `--space-sm`, `--space-md`, `--space-lg`, `--space-xl`
  - `--font-family`, `--font-size-sm`, `--font-size-md`, `--font-size-lg`, `--font-size-xl`
  - `--touch-target-min` (44px)
  - `--shadow-sm`, `--shadow-md`
  - Dark: Deep grays/blacks, muted gold accent
  - Parchment: Warm tan/cream backgrounds, dark brown text, fantasy serif feel
  - Light: Clean whites/light grays, standard sans-serif

### Step 2: Create ThemeProvider and useTheme hook
- **File:** `src/theme/themes.ts`, `src/theme/ThemeProvider.tsx`
- **Action:** create
- **Changes:**
  - `themes.ts`: Export `ThemeName` type, `DEFAULT_THEME = 'dark'`, `THEME_STORAGE_KEY = 'skaldbok-theme'`
  - `ThemeProvider.tsx`: React context + provider that:
    1. Reads theme from `localStorage` on mount (fallback to `DEFAULT_THEME`)
    2. Sets `document.documentElement.setAttribute('data-theme', theme)` on mount and theme change
    3. Writes to `localStorage` on theme change
    4. Exports `useTheme()` hook

### Step 3: Wire ThemeProvider into AppProviders
- **File:** `src/app/AppProviders.tsx`
- **Action:** modify
- **Changes:** Import `ThemeProvider` and `theme.css`, wrap children: `<ThemeProvider>{children}</ThemeProvider>`

### Step 4: Create Button component
- **File:** `src/components/primitives/Button.tsx`
- **Action:** create
- **Changes:** Styled button using CSS variables. Props: `variant: 'primary' | 'secondary' | 'danger'`, `size: 'sm' | 'md' | 'lg'`, `disabled`, `onClick`, `children`, `type`, `className`. Minimum touch target 44x44px.

### Step 5: Create IconButton component
- **File:** `src/components/primitives/IconButton.tsx`
- **Action:** create
- **Changes:** Round/square button for icon-only actions. Props: `icon: ReactNode`, `label: string` (for aria-label), `onClick`, `disabled`, `className`. Minimum 44x44px.

### Step 6: Create Card component
- **File:** `src/components/primitives/Card.tsx`
- **Action:** create
- **Changes:** Surface container with border/shadow. Props: `children`, `className`, `onClick` (optional, makes it interactive).

### Step 7: Create Chip component
- **File:** `src/components/primitives/Chip.tsx`
- **Action:** create
- **Changes:** Small toggleable pill/badge. Props: `label`, `active`, `onClick`, `disabled`. Active state uses `--color-primary`.

### Step 8: Create CounterControl component
- **File:** `src/components/primitives/CounterControl.tsx`
- **Action:** create
- **Changes:** Decrement/value/increment row with large touch targets. Props: `value: number`, `min?: number`, `max?: number`, `onChange: (v: number) => void`, `label: string`, `disabled: boolean`. Buttons are min 44x44px.

### Step 9: Create SectionPanel component
- **File:** `src/components/primitives/SectionPanel.tsx`
- **Action:** create
- **Changes:** Collapsible section with title header. Props: `title: string`, `children`, `collapsible?: boolean`, `defaultOpen?: boolean`.

### Step 10: Create Drawer component
- **File:** `src/components/primitives/Drawer.tsx`
- **Action:** create
- **Changes:** Slide-in panel from bottom or right. Props: `open: boolean`, `onClose: () => void`, `title: string`, `children`. Uses a backdrop overlay. Animates via CSS transitions.

### Step 11: Create Modal component
- **File:** `src/components/primitives/Modal.tsx`
- **Action:** create
- **Changes:** Centered dialog overlay. Props: `open: boolean`, `onClose: () => void`, `title: string`, `children`, `actions?: ReactNode`. Uses `<dialog>` element or portal with backdrop.

### Step 12: Verify
- **Run:** `npx tsc --noEmit && npm run build`
- **Expected:** Passes. All components type-check. No hardcoded colors in component files.

### Step 13: Commit
- **Stage:** `git add src/theme/ src/components/primitives/ src/app/AppProviders.tsx`
- **Message:** `feat: theme system and design tokens`

## Acceptance Criteria

- `[BEHAVIORAL]` Switching themes applies new colors instantly without page reload (REQ-005)
- `[BEHAVIORAL]` Selected theme persists across browser sessions via localStorage (REQ-005)
- `[STRUCTURAL]` Dark theme is set as default when no preference is stored (REQ-006)
- `[STRUCTURAL]` No component file contains hardcoded color values; all reference CSS variables (REQ-005)
- `[BEHAVIORAL]` Parchment theme has visible fantasy-inspired styling distinct from dark and light (REQ-006)
- `[STRUCTURAL]` All seven primitive component files exist and export a React component (REQ-007)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework configured -- verify manually.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - Verify no hardcoded colors: search component files for `#` hex codes or `rgb(` -- should find none
  - Verify localStorage persistence: set theme, reload, confirm same theme
  - Verify all 8 primitive files exist: `ls src/components/primitives/`

## Patterns to Follow

- All colors via `var(--color-*)` CSS custom properties -- never hardcoded hex/rgb in component files.
- Theme application via `data-theme` attribute on `<html>` element.
- Component CSS: use CSS modules (`.module.css`) or co-located plain CSS files imported into the component. Prefer CSS modules for scoping.
- Every interactive element must have min 44x44px effective touch area (use `--touch-target-min` variable).

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/theme/themes.ts | Create | Theme type definitions and constants |
| src/theme/ThemeProvider.tsx | Create | Theme context provider with localStorage persistence |
| src/theme/theme.css | Create | CSS custom properties for all three themes |
| src/components/primitives/Button.tsx | Create | Primary button component |
| src/components/primitives/IconButton.tsx | Create | Icon-only button component |
| src/components/primitives/Card.tsx | Create | Surface card container |
| src/components/primitives/Chip.tsx | Create | Toggleable chip/pill |
| src/components/primitives/CounterControl.tsx | Create | Increment/decrement counter |
| src/components/primitives/SectionPanel.tsx | Create | Collapsible section panel |
| src/components/primitives/Drawer.tsx | Create | Slide-in drawer panel |
| src/components/primitives/Modal.tsx | Create | Dialog modal overlay |
| src/app/AppProviders.tsx | Modify | Add ThemeProvider wrapping |
