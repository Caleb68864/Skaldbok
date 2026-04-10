# Phase Spec — SS-08: Touch Target Compliance

**Run:** 2026-04-03T22-16-42-design-doc
**Sub-Spec:** SS-08
**Score:** 92 | Priority: Must | Risk: Medium
**Dependency:** ⚠️ DEPENDS ON SS-01 (Foundation, for Tailwind config) and SS-02 (Primitive Components, specifically Button). Touch target compliance must be built into primitive components from the start. Final audit runs after SS-04 (Screen Migration) completes.

---

## Intent

Every interactive element maintains a minimum 44×44px touch target per Apple HIG and WCAG 2.5.5 (AAA). This is enforced at the component level via Tailwind utilities, not applied ad-hoc. No regressions from the current implementation.

---

## Scope

- Define `min-h-touch` Tailwind utility alias (= 44px) in `tailwind.config.ts`
- Enforce `min-h-[44px]` on all Button variants
- Enforce `min-w-[44px]` AND `min-h-[44px]` on icon-only buttons
- Enforce 44px tap zones on BottomNav tabs
- Enforce 44px height on Drawer/Sheet drag handles and other interactive controls
- Audit all interactive elements across screens post-migration

---

## File Paths to Create / Modify

| Action | Path |
|--------|------|
| MODIFY | `tailwind.config.ts` — add `min-h-touch` utility |
| MODIFY | `src/components/ui/button.tsx` — add touch target classes |
| MODIFY | `src/components/shell/BottomNav.tsx` — ensure 44px tap zones |
| MODIFY | `src/components/ui/sheet.tsx` — drag handle height |
| AUDIT | All files under `src/screens/` and `src/components/` for interactive elements |

---

## Implementation Steps

### Step 1: Define `min-h-touch` utility in Tailwind config

In `tailwind.config.ts`, extend the `minHeight` theme:
```ts
export default {
  theme: {
    extend: {
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
}
```
This creates `min-h-touch` and `min-w-touch` utility classes.

### Step 2: Apply to Button component

In `src/components/ui/button.tsx`, ensure all variants include `min-h-touch`:
```ts
const buttonVariants = cva(
  'inline-flex items-center justify-center min-h-touch ...', // base
  {
    variants: {
      variant: {
        primary: '...',
        secondary: '...',
        ghost: '...',
        danger: '...',
        icon: 'min-w-touch min-h-touch ...', // icon variant: both dimensions
      },
    },
  }
)
```

### Step 3: Apply to BottomNav tabs

In `src/components/shell/BottomNav.tsx`:
- Each nav item / tab trigger must have `min-h-touch` (or `min-h-[44px]`).
- Use `flex items-center justify-center min-h-touch` on the anchor/button wrapping each tab.

### Step 4: Apply to Sheet drag handle

In `src/components/ui/sheet.tsx`:
- The drag handle area (the element at the top of the bottom sheet that users grab) should have `min-h-touch` to make it easy to grab.

### Step 5: Audit remaining interactive elements

After SS-04 screen migration completes, audit every screen for interactive elements that may have been missed:

Checklist of elements to verify:
- `<button>` elements
- `<a>` links used as buttons
- Toggle switches / checkboxes
- List item rows that are tappable
- Icon-only action buttons (delete, edit, close)
- Input increment/decrement controls (stat adjusters)
- Collapsible panel headers (SectionPanel)
- Dropdown trigger buttons
- Toast close buttons

For each, open browser DevTools and inspect computed height. Any element < 44px must be fixed.

### Step 6: Common fix patterns

| Element | Fix |
|---------|-----|
| Small icon button | Add `min-h-touch min-w-touch` |
| List row tap | Add `min-h-touch` to the row container |
| Stat adjuster `+`/`-` | Add `min-h-touch min-w-touch` |
| SectionPanel header | Add `min-h-touch` to the header button |
| Dropdown trigger | Ensure Button variant wraps it with `min-h-touch` |

---

## Acceptance Criteria

| ID | Criterion | Verification Command / Method |
|----|-----------|-------------------------------|
| 8.1 | All Button variants have ≥44px height | Computed height in DevTools ≥ 44px for all 5 variants (primary, secondary, ghost, danger, icon) |
| 8.2 | Icon-only buttons have ≥44px width AND height | `icon` variant: computed width and height both ≥ 44px |
| 8.3 | BottomNav tap zones are ≥44px height | Computed height of nav item ≥ 44px |
| 8.4 | No existing interactive element has height < 44px after migration | Browser accessibility audit or manual DevTools check on key interactive elements across all screens |
| 8.5 | `min-h-touch` utility defined in tailwind config | `grep "min-h-touch\|touch.*44\|44.*touch" tailwind.config.ts` returns match |

---

## Verification Commands

```bash
# Confirm touch utility in tailwind config
grep -n "touch" tailwind.config.ts

# Confirm min-h-touch applied to button base
grep -n "min-h-touch\|min-h-\[44px\]" src/components/ui/button.tsx

# Confirm BottomNav tap zones
grep -n "min-h-touch\|min-h-\[44px\]" src/components/shell/BottomNav.tsx

# TypeScript + build
tsc -b
vite build
```

---

## Notes

- `min-h-touch` is the preferred approach over inline `min-h-[44px]` throughout the codebase — it keeps the semantic meaning clear and makes future updates to the touch target size a single config change.
- If a design element genuinely cannot be 44px tall (e.g., a tiny inline badge), use a transparent padding wrapper to expand the tap zone without changing visual size: `p-2 -m-2` pattern.
