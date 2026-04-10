# Phase Spec — SS-01: Phase 1 Foundation Setup

**Run:** 2026-04-03T22-16-42-design-doc
**Sub-Spec:** SS-01
**Score:** 95 | Priority: Must | Risk: High
**Dependency:** None — this is the first gate. All other sub-specs depend on SS-01 completing successfully.

---

## Intent

Establish the Tailwind v4 + shadcn/ui + Lucide integration as a validated, buildable baseline before any component migration begins. This phase is the go/no-go gate for the entire overhaul.

---

## Scope

- Install and configure `tailwindcss` v4 with `@tailwindcss/vite` plugin
- Install `lucide-react`
- Install Radix primitive packages needed by adopted shadcn components
- Install `class-variance-authority`, `clsx`, `tailwind-merge`
- Configure `tailwind.config.ts` bridging `theme.css` tokens into Tailwind's design scale
- Create `src/components/ui/` directory and copy initial shadcn component sources
- Validate React 19 + Radix compatibility by rendering one Radix-backed component (Tooltip)
- Create `cn()` utility helper at `src/lib/utils.ts`

---

## File Paths to Create / Modify

| Action | Path |
|--------|------|
| CREATE | `tailwind.config.ts` |
| CREATE | `src/lib/utils.ts` |
| CREATE | `src/components/ui/tooltip.tsx` |
| MODIFY | `package.json` (add dependencies) |
| MODIFY | `vite.config.ts` (add `@tailwindcss/vite` plugin) |
| MODIFY | `src/main.tsx` or root CSS import (add Tailwind directives) |

---

## Implementation Steps

1. **Install dependencies** via `package.json` additions:
   - `tailwindcss` (v4)
   - `@tailwindcss/vite`
   - `lucide-react`
   - `@radix-ui/react-tooltip`
   - `@radix-ui/react-dialog`
   - `@radix-ui/react-dropdown-menu`
   - `@radix-ui/react-tabs`
   - `@radix-ui/react-toast`
   - `@radix-ui/react-collapsible` (for SectionPanel)
   - `class-variance-authority`
   - `clsx`
   - `tailwind-merge`

2. **Configure Vite** — add `@tailwindcss/vite` to `vite.config.ts` plugins array.

3. **Create `tailwind.config.ts`** — extend theme colors with CSS variable references from `theme.css`. Map every token (accent, surface, gold, muted, destructive, background, etc.) as `'var(--color-<name>)'`. No hardcoded hex values.

4. **Add Tailwind directives** — add `@import "tailwindcss"` (v4 syntax) to the root CSS entry point (or `index.css`). Do NOT modify `theme.css`.

5. **Create `src/lib/utils.ts`** — export `cn()` using `clsx` + `tailwind-merge`:
   ```ts
   import { clsx, type ClassValue } from 'clsx'
   import { twMerge } from 'tailwind-merge'
   export function cn(...inputs: ClassValue[]) {
     return twMerge(clsx(inputs))
   }
   ```

6. **Create `src/components/ui/tooltip.tsx`** — copy shadcn Tooltip source backed by `@radix-ui/react-tooltip`. Use `cn()` for class merging.

7. **Smoke-test Radix compatibility** — render the Tooltip somewhere visible (e.g., wrap an existing button in a Tooltip in any shell component or a dedicated test location) to confirm React 19 + Radix renders without console errors.

8. **Audit dynamic class patterns** — scan existing codebase for dynamically constructed class strings that Tailwind's JIT might purge. Add any needed entries to the Tailwind `safelist` in `tailwind.config.ts`.

9. **Verify build** — confirm `tsc -b` and `vite build` both exit 0.

---

## Acceptance Criteria

| ID | Criterion | Verification Command / Method |
|----|-----------|-------------------------------|
| 1.1 | `tailwind.config.ts` extends theme with all color tokens from `theme.css` as CSS variable references | `grep -n "var(--color-" tailwind.config.ts` returns mappings for accent, surface, gold, muted, destructive, and background |
| 1.2 | Tailwind v4 compiles without errors | `vite build` exits 0 |
| 1.3 | TypeScript compiler passes | `tsc -b` exits 0 |
| 1.4 | A Radix-backed shadcn Tooltip renders in the app without console errors | Manual smoke test OR Playwright assertion on tooltip trigger element |
| 1.5 | `src/lib/utils.ts` exports `cn()` using `clsx` + `tailwind-merge` | File exists and exports a `cn` function |
| 1.6 | `src/components/ui/` directory exists with at least Tooltip source copied | `ls src/components/ui/tooltip.tsx` succeeds |
| 1.7 | No existing functionality broken | App navigates to each main route without JS errors |
| 1.8 | Only permitted dependencies added | `package.json` diff shows only: tailwindcss, @tailwindcss/vite, lucide-react, @radix-ui/* packages, class-variance-authority, clsx, tailwind-merge |

---

## Verification Commands

```bash
# Check color token mappings
grep -n "var(--color-" tailwind.config.ts

# TypeScript check
tsc -b

# Production build check
vite build

# Confirm utils.ts exists and exports cn
grep -n "export function cn" src/lib/utils.ts

# Confirm tooltip source exists
ls src/components/ui/tooltip.tsx

# Confirm no disallowed dependencies added
git diff HEAD -- package.json
```

---

## Escalation Triggers

- **Radix + React 19 version incompatibility discovered** → escalate to human before proceeding; do NOT continue to SS-02 through SS-10
- **Any new dependency beyond the permitted list is required** → escalate before installing

---

## Phase Gate (SS-01 → All Others)

Before any downstream sub-spec may begin:
- [ ] Radix + React 19 compatibility confirmed (no console errors)
- [ ] Tailwind classes resolve correctly in all three themes
- [ ] `cn()` utility available and tested
- [ ] `tsc -b` exits 0
- [ ] `vite build` exits 0
