---
date: 2026-04-03
topic: "UI Overhaul — Tailwind + Lucide + shadcn/ui Cherry-Picks"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-04-03
tags:
  - design
  - ui-overhaul
  - tailwind
  - shadcn
  - lucide
---

# UI Overhaul -- Design

## Summary

A full UI overhaul of Skaldmark to make it look and feel like a polished, commercial TTRPG companion app. Migrates from inline `style={{}}` props to Tailwind CSS for consistent design-scale enforcement, adds Lucide React for UI icons while keeping game-icons.net SVGs for fantasy-specific icons, and cherry-picks shadcn/ui components (Sheet, Dialog, Toast, Tabs, DropdownMenu, Tooltip) for complex UI patterns that benefit from Radix primitives' accessibility and animation. Executed in five phases: Foundation, Primitives, Shell, Screens, Polish.

## Approach Selected

**Blend of Approach A (Tailwind + Lucide) and Approach C (shadcn/ui)** — Tailwind CSS as the styling system for full creative control over the fantasy aesthetic, Lucide for clean UI icons, and cherry-picked shadcn/ui components for Drawer, Modal, Toast, Tabs, and DropdownMenu where production-quality accessibility and animation matter most.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 STYLING SYSTEM                   │
│                                                  │
│  theme.css (CSS custom properties)               │
│       ↓ mapped into                              │
│  tailwind.config.ts (extends theme)              │
│       ↓ consumed by                              │
│  Component JSX (className="..." instead of       │
│                  style={{...}})                   │
│                                                  │
│  Three themes stay: [data-theme="dark|           │
│                      parchment|light"]           │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                  ICON SYSTEM                     │
│                                                  │
│  Lucide React ──── UI icons (nav, actions,       │
│                    status, chrome)                │
│  GameIcon.tsx ──── Fantasy icons (swords,         │
│                    potions, shields, spells)      │
│                    (game-icons.net, stays as-is)  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│            CHERRY-PICKED SHADCN/UI               │
│                                                  │
│  Sheet (Drawer) ── bottom-sheet slide-up panels  │
│  Dialog (Modal) ── confirmation & input dialogs  │
│  Toast ─────────── notification system           │
│  Tabs ──────────── CharacterSubNav replacement   │
│  DropdownMenu ──── CampaignSelector, HamburgerMenu│
│  Tooltip ───────── icon-only button hints        │
│                                                  │
│  Radix primitives underneath for a11y            │
│  + class-variance-authority for variants         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              MIGRATION PHASES                    │
│                                                  │
│  Phase 1: Foundation (Tailwind + shadcn setup)   │
│  Phase 2: Primitives (Card, SectionPanel, Button)│
│  Phase 3: Shell (Nav, Header, FAB)               │
│  Phase 4: Screens (one-by-one migration)         │
│  Phase 5: Polish (animations, textures, delight) │
└─────────────────────────────────────────────────┘
```

### Key Architectural Decisions

**Theme token bridge:** Existing `theme.css` CSS custom properties remain the single source of truth for color palettes. `tailwind.config.ts` extends its theme by referencing those variables: `accent: 'var(--color-accent)'`. Theme switching via `data-theme` continues to work exactly as it does now.

**Inline styles → Tailwind classes:** Every component migrates from `style={{}}` to `className="..."`. Tailwind enforces a design scale (spacing, radius, shadow) so things stop looking randomly different.

**shadcn copies, not depends:** shadcn components are copied into `src/components/ui/` as source files you own. They use Tailwind classes and Radix primitives underneath, but you can modify them freely (e.g., adding fantasy textures to the Sheet backdrop).

**Icon strategy:** Lucide for all structural UI needs (~1,500 icons, tiny bundle via tree-shaking). GameIcon stays for the ~20 fantasy RPG icons that Lucide doesn't cover. Both render as inline SVGs.

## Components

### Foundation Layer (Phase 1)

**`tailwind.config.ts`** — Bridges theme.css tokens into Tailwind's design scale.
- Owns: Color mappings (`accent`, `surface`, `gold`, etc.), font family aliases, custom shadow presets, custom radius scale, fantasy-specific utilities (e.g., `text-shadow-emboss`)
- Does NOT own: The actual color values (those live in theme.css and change per `data-theme`)

**`src/components/ui/` directory** — shadcn component copies, customized for Skaldmark.
- Components adopted: Sheet, Dialog, Toast/Toaster, Tabs, DropdownMenu, Tooltip, Button (shadcn variant)
- Owns: Accessible markup, keyboard navigation, animation timing, variant system (via CVA)
- Does NOT own: Business logic, data fetching, app state

### Primitive Components (Phase 2)

**`Button`** — Replace current hand-rolled button with shadcn's Button using CVA variants.
- Variants: `primary` (accent bg), `secondary` (surface bg), `ghost` (transparent), `danger` (red), `icon` (square, icon-only)
- All variants enforce 44px minimum touch target
- Fantasy treatment: subtle inset shadow on press, gold border option for special actions

**`Card`** — Rebuild with Tailwind classes, add depth.
- Current: flat surface + 1px border + soft shadow
- New: layered shadow system (`shadow-sm` idle → `shadow-md` hover/active), subtle border gradient, rounded-xl corners
- Variant: `elevated` (stronger shadow), `inset` (sunken panel feel for input groups)

**`SectionPanel`** — Collapsible panel, major visual upgrade.
- Header: subtle gradient background, gold bottom border accent, Lucide ChevronUp/ChevronDown replacing Unicode ▲/▼
- Body: smooth collapse animation (CSS `grid-template-rows` trick or Radix Collapsible)
- Icon slot: GameIcon in header becomes more prominent with gold tint

**`Modal`** → Replaced by shadcn **Dialog**.
- Animated overlay fade + content scale-in
- Proper focus trapping, escape-to-close, click-outside
- Customized backdrop: dark overlay with subtle grain texture

**`Drawer`** → Replaced by shadcn **Sheet**.
- Spring-animated slide-up from bottom (mobile-native feel)
- Drag handle indicator at top
- Snap points: half-screen and full-screen
- Used for: all quick-action drawers, ManagePartyDrawer, QuickNoteDrawer

**`Toast`** → Replaced by shadcn **Toast/Toaster**.
- Slide-in from top, auto-dismiss, action button support
- Variants: `default`, `success` (green accent), `destructive` (red), `info`

### Shell Components (Phase 3)

**`BottomNav`** — Upgrade from text-only to icon + label tabs.
- Icons: Lucide `Scroll` (Characters), `Flame` (Session), `BookOpen` (Reference)
- Active state: icon fills, accent color, subtle scale-up
- Accent-colored bar above active tab
- Background: `backdrop-blur` for frosted glass effect

**`CharacterSubNav`** → Rebuilt with shadcn **Tabs**.
- Icons: GameIcon `person` (Sheet), `dice-six-faces-six` (Skills), `backpack` (Gear), `magic-swirl` (Magic)
- Animated underline indicator that slides between tabs
- Touch-optimized: full-width on mobile, centered on tablet

**`CampaignHeader`** — Refined.
- Campaign name uses Marcellus display font
- Unicode symbols replaced with Lucide icons (Menu, ChevronDown)
- Session active indicator: pulsing dot animation
- Campaign selector → shadcn DropdownMenu
- Hamburger menu → shadcn Sheet sliding from right

**`GlobalFAB` + Quick Actions** — Rethought for one-tap touch-first use.
- FAB: accent circle with Lucide `Sparkles` (session active) / `Plus` (default)
- Action menu items: icon + short label as mini-card stack
  - `Dice` → Skill Check, `ShoppingCart` → Shopping, `Gem` → Loot, `Quote` → Quote, `Ear` → Rumor
- Quick-action drawers get pre-filled smart defaults (active character, most-used skill), reducing typing

### Screen Migration (Phase 4)

Each screen migrates from inline styles to Tailwind classes using new primitives. No structural changes — just swap components and restyle. Order:
1. SheetScreen (most visible, validates primitives)
2. SkillsScreen
3. GearScreen
4. MagicScreen
5. SessionScreen
6. ReferenceScreen
7. Remaining screens (Settings, Profile, Library, NoteEditor)

### Polish Layer (Phase 5)

**Fantasy texture system:**
- Subtle noise grain overlay on body background
- Panel headers: darker gradient + gold accent border
- Input fields: soft inset shadow (embossed feel)
- Cards: multi-layer beveled border (light top-left, dark bottom-right)
- All textures via CSS custom properties, adapting per theme
- Performance: GPU-composited pseudo-elements

**Micro-interactions:**
- Button press: scale-down (0.97) + shadow reduction
- Card tap: brief shadow lift
- Tab switch: sliding indicator
- Drawer open: spring physics
- Toast enter/exit: slide + fade
- Mode toggle: color transition on CampaignHeader border

## Data Flow

Minimal data flow changes — this is a UI/UX overhaul.

**What stays the same:**
- Dexie/IndexedDB layer, all repositories, schemas, queries
- AppStateContext, ActiveCharacterContext, CampaignContext — same APIs
- React Router routes — same structure, same screens

**What changes:**
- Toast system: `useToast()` internals rewired to shadcn's toast hook. External API (`showToast('message')`) can stay the same.
- Drawer/Modal rendering: content components unchanged, just wrapped in shadcn Sheet/Dialog for animation, focus trapping, and drag-to-dismiss.
- Icon rendering: Lucide for UI icons (same inline SVG output, different import source), GameIcon unchanged.
- Styling mechanism: `style={{ color: 'var(--color-accent)' }}` → `className="text-accent"` → resolves to same CSS variable.
- FAB quick-actions: drawers get smart defaults from existing context (activeCharacterInCampaign, character.skills, activeSession). No new data sources.

## Error Handling

**Migration coexistence:** During multi-phase migration, inline styles and Tailwind classes coexist. Inline styles have higher CSS specificity, so leftover `style={{}}` props will override Tailwind. Each phase must grep for remaining inline styles in migrated components.

**Tailwind CSS purge:** Dynamically constructed class names (e.g., `` `bg-${color}` ``) get purged. Use `safelist` config or complete class names in conditionals.

**shadcn component drift:** Copied components are owned source. Radix version bumps require manual merge. Keep customizations minimal and well-commented.

**Theme transition:** CSS custom properties update instantly. Tailwind classes reference variables, so no flicker on theme switch.

**Touch target regression:** Current `minHeight: 44px` must be preserved as Tailwind `min-h-[44px]`. Custom utility alias `min-h-touch` enforces this globally.

**PWA offline:** No new runtime network dependencies. Lucide icons bundled. shadcn components are source. Tailwind compiles to static CSS. Offline story unchanged.

**Bundle size:** Tailwind ~10-30KB gzipped (with purge), Lucide tree-shakes per icon (~1KB each), Radix packages are small. Net impact under 50KB gzipped.

**Radix focus management:** Radix's focus trapping in Sheet/Dialog could conflict with TipTap editor in QuickNoteDrawer. Test this interaction specifically during Phase 2.

## Open Questions (Resolved)

1. **Bottom nav icon choices:** Use `Scroll` (Characters), `Flame` (Session), `BookOpen` (Reference). Validate visually during Phase 3; agent may swap if a Lucide icon clearly fits better.
2. **Tailwind v3 vs v4:** **Decision: Tailwind v4.** CSS-first config aligns with existing theme.css architecture; well-supported with Vite; forward-looking choice. Use `@tailwindcss/vite` plugin.
3. **Fantasy textures in scope:** **Decision: Yes, include in Phase 5.** Delivers the complete vision in one pass rather than a follow-up.
4. **CharacterSubNav style:** **Decision: shadcn Tabs (animated underline).** More product-grade, better accessibility via Radix. Fantasy feel comes from the overall theme, not individual component styles.

## Approaches Considered

### Approach A: Tailwind CSS + Lucide Icons + Component Redesign
Full Tailwind migration + Lucide for all UI icons + hand-built components. Maximum creative control. Selected as the foundation of the blend.

### Approach B: CSS Modules + Phosphor Icons + Design Token Expansion
Incremental upgrade with CSS Modules + Phosphor's 9,000 icons. Lowest migration friction but slower path to polished product feel. Not selected — the inline-to-CSS-Modules jump doesn't give enough visual consistency improvement for the effort.

### Approach C: shadcn/ui + Tailwind + Radix Primitives
Full component library adoption. Fastest to polished defaults but biggest migration and risk of losing fantasy identity. Selected for cherry-picking — Sheet, Dialog, Toast, Tabs, DropdownMenu, Tooltip adopted; the rest built with Tailwind directly.

### Blend A + C (Selected)
Tailwind as the styling system for full creative control. Lucide for icons. Cherry-picked shadcn components for complex UI patterns where accessibility, animation, and interaction quality are hard to hand-roll (drawers, modals, toasts, tabs, dropdowns).

## Commander's Intent

**Desired End State:** Every screen in Skaldmark renders using Tailwind CSS classes instead of inline `style={{}}` props, with shadcn/ui Sheet, Dialog, Toast, Tabs, DropdownMenu, and Tooltip replacing hand-rolled equivalents. All three themes (dark, parchment, light) render without visual glitches. Lucide React provides all UI icons. The app passes these acceptance criteria:
- Zero `style={{}}` occurrences in migrated components (grep verification)
- All shadcn components support keyboard navigation and focus management
- All interactive elements maintain ≥44px touch targets
- Lighthouse accessibility score ≥90
- Bundle size delta <50KB gzipped vs. current build
- PWA offline functionality unchanged
- Build passes with zero TypeScript errors

**Purpose:** Transform Skaldmark from a functional prototype with inconsistent visual treatment into a polished, commercial-quality TTRPG companion app. Consistent design-scale enforcement (spacing, radius, shadow, color) creates a trustworthy, premium feel that matches the fantasy aesthetic.

**Constraints:**
- MUST preserve all existing functionality — this is a styling/UX overhaul, not a feature change
- MUST NOT modify Dexie schemas, repositories, or data models
- MUST NOT change React Router route structure
- MUST maintain PWA offline capability — no new runtime network dependencies
- MUST keep existing theme.css CSS custom properties as the single source of truth for color values
- MUST preserve ≥44px minimum touch targets on all interactive elements
- MUST use Tailwind v4 with `@tailwindcss/vite` plugin
- MUST NOT add dependencies beyond: tailwindcss, @tailwindcss/vite, lucide-react, and the Radix packages needed by adopted shadcn components (class-variance-authority, clsx, tailwind-merge)

**Freedoms:**
- The implementing agent MAY choose animation durations and easing curves
- MAY choose spacing values within the Tailwind design scale
- MAY adjust shadow depth, border-radius, and opacity values for visual polish
- MAY restructure internal component file organization within src/components/
- MAY choose test file organization and naming
- MAY select specific Lucide icon names as long as they're semantically appropriate
- MAY add Tailwind utility classes to the safelist as needed for dynamic patterns

## Execution Guidance

**Observe (signals to monitor during implementation):**
- TypeScript compiler: `tsc -b` must pass after each phase
- Vite build: `vite build` must complete without errors after each phase
- Grep for remaining `style={{` count — should decrease monotonically across phases
- Visual rendering in all three themes (dark, parchment, light) after each component migration
- Bundle size: check with `vite build` output after Phase 1 and Phase 5

**Orient (codebase context to maintain):**
- Path alias: `@` maps to `./src` (configured in vite.config.ts)
- Theme tokens live in `src/theme/theme.css` — 45+ CSS custom properties
- Components organized: `src/components/primitives/`, `src/components/fields/`, `src/components/shell/`, `src/components/panels/`
- Screens in `src/screens/*.tsx` (12 screens)
- GameIcon.tsx has ~50 embedded SVG icon paths — do NOT touch this file except to update imports
- Toast already has a CSS module file: `src/components/primitives/Toast.module.css` — remove this when migrating to shadcn Toast
- Font imports in `src/styles/fonts.css` — three font families (Marcellus, Source Serif 4, Source Sans 3)

**Escalate When:**
- A new npm dependency is needed beyond those listed in Constraints
- Any change to Dexie schemas, repositories, or context API shapes is required
- Radix primitives conflict with React 19 (version incompatibility)
- TipTap editor focus conflicts with Radix focus trapping in Sheet/Dialog
- A component migration would require changing its public props API in a breaking way
- Bundle size exceeds 50KB gzipped delta

**Shortcuts (Apply Without Deliberation):**
- Use `@` path alias for all imports: `import { Button } from '@/components/ui/button'`
- Reference theme tokens as Tailwind extensions: `text-accent` → `var(--color-accent)`
- Place shadcn component copies in `src/components/ui/` directory
- Use `cn()` helper (clsx + tailwind-merge) for conditional class merging
- Follow existing pattern: one component per file, named export matching filename
- Preserve existing component prop interfaces — add className prop, don't remove style prop until migration complete
- Each phase: migrate → grep for remaining inline styles → build → verify themes

## Decision Authority

**Agent Decides Autonomously:**
- Tailwind class choices for spacing, color, typography, layout
- Animation timing and easing values
- Internal component structure and helper functions
- Lucide icon selection for UI elements
- Tailwind safelist entries for dynamic patterns
- File organization within src/components/ui/
- CSS utility class creation in tailwind config
- Test structure and test case design

**Agent Recommends, Human Approves:**
- Any npm dependency not listed in Constraints
- Changes to component public prop APIs
- Removal of existing components (vs. replacement)
- Performance trade-offs (e.g., CSS-in-JS fallbacks)
- Accessibility patterns that differ from Radix defaults

**Human Decides:**
- Scope changes (adding or removing screens from migration)
- Final visual aesthetic judgments (textures, colors, "feel")
- UX flow changes beyond styling
- Any data model or repository changes

## War-Game Results

**Most Likely Failure:** CSS specificity conflicts during coexistence. Inline `style={{}}` props have higher specificity than Tailwind utility classes. During migration, partially-converted components will silently ignore Tailwind classes where inline styles remain. **Mitigation:** Each component migration must: (1) remove ALL inline styles in that component in the same commit, (2) grep the component for `style={{` and `style={` to verify zero remaining, (3) visually verify in all three themes.

**Scale Stress:** N/A for UI overhaul scope.

**Dependency Risk:** Radix primitives + React 19 compatibility. Radix has shipped React 19 support as of late 2025, but edge cases may exist. **Mitigation:** Phase 1 must install and render at least one Radix-based shadcn component (e.g., Tooltip) before proceeding. If incompatible, fall back to hand-rolling the 6 shadcn components with Tailwind + custom focus management.

**Maintenance Assessment (6 months):** Good. The theme token bridge (theme.css → tailwind.config.ts) is a clean architectural boundary. shadcn components are owned source code, not black-box dependencies. The 5-phase structure leaves a clear migration trail in git history.

## Resilience Strategy

- **Commit after each phase** — each phase is a stable, buildable checkpoint
- **Each phase must pass:** `tsc -b && vite build` before proceeding to next phase
- **Keep old components available** until their replacements are validated in the phase that uses them
- **Phase 1 is the validation gate** — if Tailwind + shadcn + React 19 integration fails here, the entire approach can be reconsidered before touching any existing components
- **Inline style removal is atomic per component** — never leave a component half-migrated

## Evaluation Metadata
- Evaluated: 2026-04-03
- Cynefin Domain: Complicated
- Critical Gaps Found: 2 (2 resolved)
- Important Gaps Found: 5 (5 resolved)
- Suggestions: 3

## Next Steps
- [ ] Run `/forge-dark-factory` on this evaluated plan
- [ ] Verify React 19 + Radix compatibility during Phase 1
- [ ] Audit dynamic class name patterns for Tailwind safelist during Phase 1
