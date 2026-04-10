# Phase Spec — SS-07: Icon System

**Run:** 2026-04-03T22-16-42-design-doc
**Sub-Spec:** SS-07
**Score:** 88 | Priority: Must | Risk: Low
**Dependency:** ⚠️ DEPENDS ON SS-01 (Foundation Setup) — `lucide-react` must be installed. SS-07 work runs in parallel with SS-02/SS-03/SS-04 as icons are replaced screen-by-screen. Final verification happens after SS-04 completes.

---

## Intent

Establish a clean two-tier icon system: **Lucide React** for all structural UI icons, **GameIcon.tsx** for fantasy-specific RPG icons. No mixing. No Unicode symbol stand-ins. No regressions.

---

## Icon Assignment Rules

| Icon Type | Source | Examples |
|-----------|--------|---------|
| Navigation (tabs, back, forward) | Lucide | `ChevronLeft`, `ChevronRight`, `Scroll`, `Flame`, `BookOpen` |
| Actions (add, delete, edit, close) | Lucide | `Plus`, `Trash2`, `Pencil`, `X` |
| Status (active, warning, info) | Lucide | `CheckCircle`, `AlertTriangle`, `Info` |
| Chrome (menu, search, settings) | Lucide | `Menu`, `Search`, `Settings` |
| Fantasy RPG (swords, potions, spells) | GameIcon | sword, potion, magic-swirl, etc. |

---

## Scope

- Audit all Unicode symbol usages (`▲`, `▼`, `≡`, `●`, `□`, `■`, `◆`) across `src/components/` and `src/screens/`
- Replace each with the appropriate Lucide icon (named import — no wildcard imports)
- Confirm GameIcon.tsx is not structurally modified
- Confirm all Lucide imports use named imports (tree-shaking compliant)
- Verify icons render correctly in all three themes

---

## File Paths to Modify

Any file in:
- `src/components/primitives/`
- `src/components/shell/`
- `src/components/panels/`
- `src/screens/`

That contains Unicode symbols used as UI icons or uses Lucide icons with non-named imports.

**DO NOT MODIFY:** `src/components/primitives/GameIcon.tsx`

---

## Implementation Steps

1. **Audit Unicode symbols:**
   ```bash
   grep -rn "[▲▼≡●□■◆]" src/components/ src/screens/
   ```
   Record every file and line number.

2. **For each Unicode occurrence, replace with appropriate Lucide icon:**
   - `▲` (collapse up) → `ChevronUp`
   - `▼` (collapse down / dropdown) → `ChevronDown`
   - `≡` (hamburger menu) → `Menu`
   - `●` (active indicator dot) → use CSS `rounded-full` div with `animate-pulse` (not an icon; remove Unicode)
   - `□` / `■` / `◆` (decorative) → use CSS shape or appropriate Lucide icon by context

3. **Import pattern — always use named imports:**
   ```tsx
   // ✅ Correct (tree-shakeable)
   import { ChevronUp, ChevronDown, Menu } from 'lucide-react'

   // ❌ Wrong (imports entire library)
   import * as LucideIcons from 'lucide-react'
   ```

4. **Icon sizing:** Apply consistent sizing via Tailwind:
   - Navigation icons: `size-5` (20px)
   - Action icons: `size-4` (16px) or `size-5`
   - FAB icon: `size-6` (24px)
   - Use the `size` prop on Lucide components or `className="size-5"`.

5. **Icon color inheritance:** Do NOT hardcode icon colors. Use `currentColor` (Lucide default) so icons inherit the parent's `text-*` color class.
   ```tsx
   // ✅ Correct — inherits parent text color
   <ChevronDown className="size-4" />

   // ❌ Wrong — hardcoded color
   <ChevronDown color="#c4973b" />
   ```

6. **Confirm GameIcon.tsx unchanged:** After all replacements, run:
   ```bash
   git diff HEAD -- src/components/primitives/GameIcon.tsx
   ```
   Must show zero changes.

7. **Theme spot-check:** In dark, parchment, and light themes, visually verify:
   - Lucide icons inherit the correct text color for their context
   - No color bleed (icons don't show wrong color in any theme)

---

## Acceptance Criteria

| ID | Criterion | Verification Command / Method |
|----|-----------|-------------------------------|
| 7.1 | No Unicode symbols used for UI | `grep -rn "[▲▼≡●□■◆]" src/components/ src/screens/` returns 0 matches |
| 7.2 | Lucide icons tree-shake correctly (no full import) | No `import * as LucideIcons from 'lucide-react'` in any file |
| 7.3 | GameIcon.tsx unchanged structurally | `git diff HEAD -- src/components/primitives/GameIcon.tsx` shows no structural changes |
| 7.4 | All Lucide icon names are semantically appropriate for their use | Code review: icon name matches its UI purpose |
| 7.5 | Icons render in all three themes without color bleed | Spot-check in dark/parchment/light: icons inherit correct color |

---

## Verification Commands

```bash
# Check for Unicode symbols
grep -rn "[▲▼≡●□■◆]" src/components/ src/screens/

# Check for wildcard Lucide imports
grep -rn "import \* as" src/ | grep lucide

# Confirm GameIcon.tsx unchanged
git diff HEAD -- src/components/primitives/GameIcon.tsx

# TypeScript + build
tsc -b
vite build
```

---

## Notes

- Icon selection (which specific Lucide icon to use) is the agent's discretion — choose the most semantically appropriate option from the Lucide icon library.
- If a Unicode character is used for purely decorative purposes (not an interactive icon), a CSS solution (e.g., a styled `<span>` or pseudo-element) is acceptable.
