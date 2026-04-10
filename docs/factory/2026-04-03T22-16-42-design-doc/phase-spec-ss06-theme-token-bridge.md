# Phase Spec — SS-06: Theme Token Bridge

**Run:** 2026-04-03T22-16-42-design-doc
**Sub-Spec:** SS-06
**Score:** 95 | Priority: Must | Risk: High
**Dependency:** ⚠️ DEPENDS ON SS-01 (Foundation Setup) — `tailwind.config.ts` must exist before the token bridge can be configured. This sub-spec should be completed as part of or immediately after SS-01, before any component migration begins (SS-02+).

---

## Intent

Ensure the existing `theme.css` CSS custom properties remain the **single source of truth** for all color values, with Tailwind consuming them via CSS variable references — never hardcoded hex or rgb values.

---

## Architecture

```
src/theme/theme.css
  [data-theme="dark"]       { --color-accent: #c4973b; --color-surface: #1e1e1e; ... }
  [data-theme="parchment"]  { --color-accent: #7c4f1e; --color-surface: #f5e9c9; ... }
  [data-theme="light"]      { --color-accent: #6b3e1a; --color-surface: #ffffff; ... }
        ↓
tailwind.config.ts
  theme.extend.colors.accent        = 'var(--color-accent)'
  theme.extend.colors.surface       = 'var(--color-surface)'
  theme.extend.colors.gold          = 'var(--color-gold)'
  theme.extend.colors.muted         = 'var(--color-muted)'
  theme.extend.colors.destructive   = 'var(--color-destructive)'
  theme.extend.colors.background    = 'var(--color-background)'
  ... (all 45+ tokens)
        ↓
Component JSX
  className="bg-surface text-accent"
        ↓ resolves to ↓
  background-color: var(--color-surface)   ← changes with [data-theme]
  color: var(--color-accent)               ← changes with [data-theme]
```

---

## File Paths to Create / Modify

| Action | Path |
|--------|------|
| CREATE/MODIFY | `tailwind.config.ts` — add all color token mappings |
| READ ONLY | `src/theme/theme.css` — source of truth; **no deletions permitted** |

---

## Implementation Steps

1. **Audit `theme.css`** — enumerate every CSS custom property defined under each `[data-theme]` block. Record all token names (e.g., `--color-accent`, `--color-surface`, `--color-gold`, `--color-muted`, `--color-destructive`, `--color-background`, `--color-text`, `--color-border`, etc.).

2. **Map every token in `tailwind.config.ts`**:
   ```ts
   // tailwind.config.ts
   export default {
     theme: {
       extend: {
         colors: {
           accent:      'var(--color-accent)',
           surface:     'var(--color-surface)',
           gold:        'var(--color-gold)',
           muted:       'var(--color-muted)',
           destructive: 'var(--color-destructive)',
           background:  'var(--color-background)',
           // ... add ALL tokens found in theme.css
         },
       },
     },
   }
   ```
   - One entry per token.
   - NO hardcoded `#rrggbb` or `rgb(...)` values anywhere in this file.

3. **Verify mapping completeness** — after adding all tokens, cross-reference with `theme.css` to confirm every `--color-*` property has a corresponding Tailwind color entry.

4. **Spot-check Tailwind class resolution** — in a browser or via build output, verify:
   - `text-accent` → `color: var(--color-accent)`
   - `bg-surface` → `background-color: var(--color-surface)`
   - `text-muted` → `color: var(--color-muted)`
   - `border-gold` → `border-color: var(--color-gold)`

5. **Theme switching test** — toggle `data-theme` attribute on `<html>` or `<body>` via the app's theme toggle. Confirm UI colors update immediately without a page reload.

6. **Component className audit** — scan all components and screens for any hardcoded color values in Tailwind's arbitrary value syntax (e.g., `text-[#c4973b]`, `bg-[rgb(30,30,30)]`). Replace with semantic token classes.

---

## Acceptance Criteria

| ID | Criterion | Verification Command / Method |
|----|-----------|-------------------------------|
| 6.1 | `tailwind.config.ts` contains no hardcoded hex/rgb color values | `grep -n "#\|rgb(" tailwind.config.ts` returns 0 matches (only `var()` references) |
| 6.2 | `theme.css` unchanged (or additive only — new properties permitted, no deletions) | `git diff HEAD -- src/theme/theme.css` shows no deletions of existing custom properties |
| 6.3 | Theme switching via `data-theme` attribute works without page reload | Toggle theme → UI updates immediately without flicker |
| 6.4 | All 45+ CSS custom properties from theme.css accessible as Tailwind classes | Spot-check: `text-accent`, `bg-surface`, `text-muted`, `border-gold` compile and apply correctly |
| 6.5 | No color values hardcoded in component className strings | `grep -rn "text-\[#\|bg-\[#\|border-\[#" src/components/ src/screens/` returns 0 matches |

---

## Verification Commands

```bash
# No hardcoded colors in tailwind config
grep -n "#\|rgb(" tailwind.config.ts

# No deletions in theme.css
git diff HEAD -- src/theme/theme.css

# No arbitrary hex colors in component class names
grep -rn "text-\[#" src/components/ src/screens/
grep -rn "bg-\[#" src/components/ src/screens/
grep -rn "border-\[#" src/components/ src/screens/

# TypeScript + build
tsc -b
vite build
```

---

## Notes

- If `theme.css` contains tokens beyond `--color-*` (e.g., `--radius-*`, `--spacing-*`, `--shadow-*`), those may optionally be mapped into the appropriate Tailwind `borderRadius`, `spacing`, and `boxShadow` extensions as well — but color token mapping is the minimum requirement.
- The agent must read `theme.css` in full before writing `tailwind.config.ts` to ensure completeness.
