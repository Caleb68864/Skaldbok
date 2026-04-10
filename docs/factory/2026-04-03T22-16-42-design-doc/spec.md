# Specification: UI Overhaul — Tailwind + Lucide + shadcn/ui Cherry-Picks

**Run:** 2026-04-03T22-16-42-design-doc
**Phase:** forge
**Branch:** 2026/04/03-2101-caleb-feat-2026-04-03-temp-stat-modifiers-design
**Spec Version:** 1.0
**Status:** ready

---

## Intent Hierarchy

```
Commander's Intent (Why)
└── Transform Skaldmark from functional prototype → polished commercial TTRPG app
    └── Strategy (What)
        └── Replace inline style={{}} with Tailwind CSS; adopt shadcn/ui for complex
            UI patterns; add Lucide for UI icons; preserve all existing functionality
            └── Tactics (How)
                ├── Phase 1: Foundation — install Tailwind v4, shadcn/ui, Lucide
                ├── Phase 2: Primitives — Button, Card, SectionPanel, Modal→Dialog, Drawer→Sheet, Toast
                ├── Phase 3: Shell — BottomNav, CharacterSubNav, CampaignHeader, GlobalFAB
                ├── Phase 4: Screens — migrate all 12 screens one-by-one
                └── Phase 5: Polish — fantasy textures, micro-interactions, final audit
```

### Why This Matters
A consistently designed UI builds user trust. Inline `style={{}}` props create design drift — every developer makes slightly different spacing, shadow, and radius decisions. Tailwind's design-scale constraint and shared theme tokens eliminate this class of bug. shadcn/ui's Radix-backed components provide production-quality accessibility (focus trapping, keyboard nav, ARIA) that is extremely difficult to hand-roll correctly. The combined investment yields a maintainable, extensible, premium-feeling app.

### Non-Goals (Explicitly Out of Scope)
- No changes to Dexie schemas, repositories, or data models
- No changes to React Router route structure
- No new runtime network dependencies (PWA offline must remain unchanged)
- No changes to GameIcon.tsx except import updates if needed
- No removal of existing theme.css CSS custom properties

---

## Scored Sub-Specifications

Scores use **MoSCoW** (M=Must, S=Should, C=Could, W=Won't) × **Risk** (H/M/L).

| # | Sub-Spec | Priority | Risk | Score |
|---|----------|----------|------|-------|
| 1 | Phase 1: Foundation Setup | M | H | 95 |
| 2 | Phase 2: Primitive Components | M | M | 90 |
| 3 | Phase 3: Shell Components | M | M | 85 |
| 4 | Phase 4: Screen Migration | M | L | 80 |
| 5 | Phase 5: Polish Layer | S | L | 65 |
| 6 | Theme Token Bridge | M | H | 95 |
| 7 | Icon System | M | L | 88 |
| 8 | Touch Target Compliance | M | M | 92 |
| 9 | Bundle Size Constraint | M | M | 88 |
| 10 | Accessibility Compliance | M | M | 90 |

---

## Sub-Spec 1: Phase 1 — Foundation Setup
**Score: 95 | Priority: Must | Risk: High**

### Intent
Establish the Tailwind v4 + shadcn/ui + Lucide integration as a validated, buildable baseline before any component migration begins. This phase is the go/no-go gate for the entire overhaul.

### Scope
- Install and configure `tailwindcss` v4 with `@tailwindcss/vite` plugin
- Install `lucide-react`
- Install Radix primitive packages needed by adopted shadcn components
- Install `class-variance-authority`, `clsx`, `tailwind-merge`
- Configure `tailwind.config.ts` bridging `theme.css` tokens into Tailwind's design scale
- Create `src/components/ui/` directory and copy initial shadcn component sources
- Validate React 19 + Radix compatibility by rendering one Radix-backed component (Tooltip)
- Create `cn()` utility helper at `src/lib/utils.ts`

### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| 1.1 | `tailwind.config.ts` extends theme with all color tokens from `theme.css` as CSS variable references | `grep -n "var(--color-" tailwind.config.ts` returns mappings for accent, surface, gold, muted, destructive, and background |
| 1.2 | Tailwind v4 compiles without errors | `vite build` exits 0 after Phase 1 changes |
| 1.3 | TypeScript compiler passes | `tsc -b` exits 0 after Phase 1 changes |
| 1.4 | A Radix-backed shadcn Tooltip renders in the app without console errors | Manual smoke test OR Playwright assertion on tooltip trigger element |
| 1.5 | `src/lib/utils.ts` exports `cn()` using `clsx` + `tailwind-merge` | File exists and exports a `cn` function |
| 1.6 | `src/components/ui/` directory exists with at least Tooltip source copied | `ls src/components/ui/tooltip.tsx` succeeds |
| 1.7 | No existing functionality broken | App navigates to each main route without JS errors |
| 1.8 | Only permitted dependencies added | `package.json` diff shows only: tailwindcss, @tailwindcss/vite, lucide-react, @radix-ui/* packages, class-variance-authority, clsx, tailwind-merge |

### Escalation Triggers
- Radix + React 19 version incompatibility discovered → escalate before proceeding
- Any new dependency beyond permitted list required → escalate before installing

---

## Sub-Spec 2: Phase 2 — Primitive Components
**Score: 90 | Priority: Must | Risk: Medium**

### Intent
Replace the lowest-level UI building blocks with Tailwind-styled equivalents backed by shadcn/Radix where appropriate. All higher-level components depend on these, so correctness here is critical.

### Scope

#### 2a. Button
- Replace hand-rolled button with shadcn Button using CVA variants
- Variants: `primary`, `secondary`, `ghost`, `danger`, `icon`
- All variants: minimum 44px touch target (`min-h-[44px]`)
- Fantasy treatment: subtle inset shadow on press, gold border option

#### 2b. Card
- Rebuild with Tailwind classes
- Layered shadow system: `shadow-sm` idle → `shadow-md` hover/active
- Subtle border gradient, `rounded-xl`
- Variants: `elevated`, `inset`

#### 2c. SectionPanel
- Collapsible panel with Tailwind styling
- Header: subtle gradient background, gold bottom border accent
- Replace Unicode ▲/▼ with Lucide `ChevronUp`/`ChevronDown`
- Smooth collapse animation via CSS `grid-template-rows` or Radix Collapsible
- Icon slot: GameIcon with gold tint, more prominent

#### 2d. Modal → shadcn Dialog
- Copy shadcn Dialog source to `src/components/ui/dialog.tsx`
- Animated overlay fade + content scale-in
- Proper focus trapping, escape-to-close, click-outside-to-close
- Customized backdrop: dark overlay with subtle grain texture

#### 2e. Drawer → shadcn Sheet
- Copy shadcn Sheet source to `src/components/ui/sheet.tsx`
- Spring-animated slide-up from bottom
- Drag handle indicator at top
- Replace all existing Drawer usage

#### 2f. Toast → shadcn Toast
- Copy shadcn Toast/Toaster to `src/components/ui/toast.tsx` and `toaster.tsx`
- Remove `src/components/primitives/Toast.module.css`
- Variants: `default`, `success`, `destructive`, `info`
- External `showToast()` API preserved

### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| 2.1 | Button renders all 5 variants without TypeScript errors | `tsc -b` passes; visual check shows variant differences |
| 2.2 | All Button variants meet 44px touch target | Computed height ≥ 44px in browser DevTools for each variant |
| 2.3 | Card `elevated` and `inset` variants visually distinct | Shadow difference visible in dark, parchment, and light themes |
| 2.4 | SectionPanel collapse animation is smooth (no layout jump) | Collapse/expand animation uses CSS transition, no instant jump |
| 2.5 | SectionPanel uses Lucide ChevronUp/ChevronDown | `grep "ChevronUp\|ChevronDown" src/components/primitives/SectionPanel.tsx` returns match; no Unicode ▲/▼ remain |
| 2.6 | Dialog closes on Escape key | Keyboard test: open dialog → press Escape → dialog dismissed |
| 2.7 | Dialog closes on backdrop click | Click outside dialog content → dialog dismissed |
| 2.8 | Dialog traps focus (Tab does not leave dialog while open) | Keyboard Tab loop stays within dialog |
| 2.9 | Sheet slides up from bottom with animation | Open/close has visible slide animation, no instant snap |
| 2.10 | Toast.module.css removed | `ls src/components/primitives/Toast.module.css` returns not found |
| 2.11 | `showToast()` external API works with shadcn internals | Calling `showToast('test message')` displays a toast notification |
| 2.12 | Zero `style={{` in migrated Phase 2 components | `grep -rn "style={{" src/components/primitives/ src/components/ui/` returns 0 matches in migrated files |
| 2.13 | `tsc -b && vite build` pass after Phase 2 | Both commands exit 0 |

---

## Sub-Spec 3: Phase 3 — Shell Components
**Score: 85 | Priority: Must | Risk: Medium**

### Intent
Upgrade the persistent chrome — nav bars, headers, FAB — which appear on every screen. These components create the first impression and frame all content.

### Scope

#### 3a. BottomNav
- Upgrade from text-only to icon + label tabs
- Icons: Lucide `Scroll` (Characters), `Flame` (Session), `BookOpen` (Reference)
- Active state: icon fills, accent color, subtle scale-up animation
- Accent-colored bar above active tab
- Background: `backdrop-blur` frosted glass effect

#### 3b. CharacterSubNav → shadcn Tabs
- Copy shadcn Tabs source to `src/components/ui/tabs.tsx`
- Icons: GameIcon for each tab (Sheet, Skills, Gear, Magic)
- Animated underline indicator sliding between tabs
- Touch-optimized sizing

#### 3c. CampaignHeader
- Campaign name: Marcellus display font (from existing fonts.css)
- Replace Unicode symbols with Lucide icons: `Menu`, `ChevronDown`
- Session active indicator: pulsing dot animation (CSS animation)
- Campaign selector → shadcn DropdownMenu (`src/components/ui/dropdown-menu.tsx`)
- Hamburger menu → shadcn Sheet sliding from right

#### 3d. GlobalFAB + Quick Actions
- FAB: accent circle with Lucide `Sparkles` (session active) / `Plus` (default)
- Quick action items: icon + short label mini-card stack
  - Icons: `Dice`, `ShoppingCart`, `Gem`, `Quote`, `Ear`
- Quick-action drawers: smart defaults from existing context (activeCharacterInCampaign, character.skills, activeSession)

### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| 3.1 | BottomNav shows Lucide icons alongside tab labels | Visual check: icons visible in nav bar |
| 3.2 | BottomNav active tab has accent-colored indicator bar | Active tab has visible top accent border |
| 3.3 | BottomNav has backdrop-blur background | CSS `backdrop-filter: blur(...)` present on nav element |
| 3.4 | CharacterSubNav uses shadcn Tabs with sliding underline | Tab switch shows animated underline transition |
| 3.5 | CampaignHeader uses Lucide Menu and ChevronDown | No Unicode ≡ or ▼ in CampaignHeader source; Lucide imports present |
| 3.6 | Session active indicator pulses via CSS animation | Active session dot has CSS `animation: pulse` or equivalent |
| 3.7 | Campaign selector dropdown is keyboard-navigable | Arrow keys navigate options; Enter selects; Escape closes |
| 3.8 | Hamburger menu Sheet slides from right | Sheet `side="right"` prop (or equivalent) produces right-to-left slide |
| 3.9 | FAB icon switches between Sparkles and Plus based on session state | Active session → Sparkles icon; inactive → Plus icon |
| 3.10 | Quick-action drawers pre-fill active character context | Opening Skill Check drawer shows active character's name/skills |
| 3.11 | Zero `style={{` in migrated Phase 3 components | Grep returns 0 matches in shell component files |
| 3.12 | `tsc -b && vite build` pass after Phase 3 | Both commands exit 0 |

---

## Sub-Spec 4: Phase 4 — Screen Migration
**Score: 80 | Priority: Must | Risk: Low**

### Intent
Migrate all 12 screens from inline styles to Tailwind classes using the primitives and shell components established in Phases 1-3. This is primarily a mechanical substitution — no structural changes.

### Migration Order
1. SheetScreen (validates primitive components in real usage)
2. SkillsScreen
3. GearScreen
4. MagicScreen
5. SessionScreen
6. ReferenceScreen
7. SettingsScreen
8. ProfileScreen
9. LibraryScreen
10. NoteEditor
11. Any remaining screens

### Per-Screen Migration Protocol
For each screen:
1. Replace all `style={{...}}` props with equivalent Tailwind classes
2. Replace any hand-rolled Modal/Drawer/Toast with shadcn equivalents
3. Run `grep -n "style={{" <screen-file>` — must return 0
4. Visual check in dark, parchment, and light themes
5. Build check: `tsc -b && vite build`

### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| 4.1 | Zero `style={{` occurrences across all 12 migrated screens | `grep -rn "style={{" src/screens/` returns 0 matches |
| 4.2 | All three themes render without visual glitches on each screen | Manual review OR screenshot comparison in dark/parchment/light |
| 4.3 | All existing features functional after migration | Smoke test: create character, add skill, record session, view reference — all work |
| 4.4 | No route structure changes | `grep -rn "Route\|path=" src/App.tsx` shows same routes as before migration |
| 4.5 | No Dexie schema or repository changes | `git diff HEAD~N -- src/db/ src/repositories/` shows no changes |
| 4.6 | SheetScreen migrated first and validated before proceeding | SheetScreen commit precedes SkillsScreen commit in git log |
| 4.7 | `tsc -b && vite build` pass after each screen migration | Build logs show success per screen |

---

## Sub-Spec 5: Phase 5 — Polish Layer
**Score: 65 | Priority: Should | Risk: Low**

### Intent
Layer fantasy-specific texture and micro-interaction details that elevate the app from "looks good" to "feels premium." Executed after all screens are migrated to avoid rework.

### Scope

#### 5a. Fantasy Texture System
- Subtle noise grain overlay on body background
- Panel headers: darker gradient + gold accent border
- Input fields: soft inset shadow (embossed feel)
- Cards: multi-layer beveled border (light top-left, dark bottom-right)
- All textures via CSS custom properties adapting per `data-theme`
- Performance: GPU-composited pseudo-elements (transform/opacity only)

#### 5b. Micro-Interactions
- Button press: `scale-[0.97]` + shadow reduction
- Card tap: brief shadow lift
- Tab switch: sliding indicator (already in Phase 3 Tabs)
- Drawer open: spring physics timing
- Toast enter/exit: slide + fade
- Theme toggle: color transition on CampaignHeader border

### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| 5.1 | Grain texture overlay present on body background | CSS `::before` or `::after` pseudo-element with noise texture visible |
| 5.2 | Textures adapt across all three themes | Switching themes shows texture adapts (no fixed colors) |
| 5.3 | Button press scale animation works | Pressing button shows brief scale-down with no layout shift |
| 5.4 | No layout thrashing from micro-interactions | Chrome Performance panel shows no forced reflows during animations |
| 5.5 | GPU compositing used for animations | Animated properties limited to `transform` and `opacity` (no animating width/height/margin) |
| 5.6 | `tsc -b && vite build` pass after Phase 5 | Both commands exit 0 |

---

## Sub-Spec 6: Theme Token Bridge
**Score: 95 | Priority: Must | Risk: High**

### Intent
Ensure the existing `theme.css` CSS custom properties remain the single source of truth for all color values, with Tailwind consuming them via variable references — not hardcoded values.

### Architecture
```
theme.css
  [data-theme="dark"]   { --color-accent: #c4973b; --color-surface: #1e1e1e; ... }
  [data-theme="parchment"] { --color-accent: #7c4f1e; --color-surface: #f5e9c9; ... }
  [data-theme="light"]  { --color-accent: #6b3e1a; --color-surface: #ffffff; ... }
        ↓
tailwind.config.ts
  theme.extend.colors.accent = 'var(--color-accent)'
  theme.extend.colors.surface = 'var(--color-surface)'
  ...
        ↓
Component JSX
  className="bg-surface text-accent"
        ↓ resolves to ↓
  background-color: var(--color-surface)   ← changes with data-theme
  color: var(--color-accent)               ← changes with data-theme
```

### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| 6.1 | `tailwind.config.ts` contains no hardcoded hex/rgb color values | `grep -n "#\|rgb(" tailwind.config.ts` returns 0 matches (only var() references) |
| 6.2 | `theme.css` unchanged (or additive only) | `git diff HEAD -- src/theme/theme.css` shows no deletions of existing custom properties |
| 6.3 | Theme switching via `data-theme` attribute works without page reload | Toggle theme → UI updates immediately without flicker |
| 6.4 | All 45+ CSS custom properties from theme.css accessible as Tailwind classes | Spot-check: `text-accent`, `bg-surface`, `text-muted`, `border-gold` compile and apply correctly |
| 6.5 | No color values hardcoded in component className strings | `grep -rn "text-\[#\|bg-\[#\|border-\[#" src/components/ src/screens/` returns 0 matches |

---

## Sub-Spec 7: Icon System
**Score: 88 | Priority: Must | Risk: Low**

### Intent
Establish a clean two-tier icon system: Lucide React for all structural UI icons, GameIcon.tsx for fantasy-specific RPG icons. No mixing, no regressions.

### Icon Assignment Rules
| Icon Type | Source | Examples |
|-----------|--------|---------|
| Navigation (tabs, back, forward) | Lucide | `ChevronLeft`, `ChevronRight`, `Scroll`, `Flame`, `BookOpen` |
| Actions (add, delete, edit, close) | Lucide | `Plus`, `Trash2`, `Pencil`, `X` |
| Status (active, warning, info) | Lucide | `CheckCircle`, `AlertTriangle`, `Info` |
| Chrome (menu, search, settings) | Lucide | `Menu`, `Search`, `Settings` |
| Fantasy RPG (swords, potions, spells) | GameIcon | sword, potion, magic-swirl, etc. |

### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| 7.1 | No Unicode symbols used for UI (▲▼≡●) | `grep -rn "[▲▼≡●□■◆]" src/components/ src/screens/` returns 0 matches |
| 7.2 | Lucide icons tree-shake correctly (no full import) | No `import * as LucideIcons from 'lucide-react'` in any file |
| 7.3 | GameIcon.tsx unchanged structurally | `git diff HEAD -- src/components/primitives/GameIcon.tsx` shows no structural changes |
| 7.4 | All Lucide icon names are semantically appropriate for their use | Code review: icon name matches its UI purpose |
| 7.5 | Icons render in all three themes without color bleed | Spot-check in dark/parchment/light: icons inherit correct color |

---

## Sub-Spec 8: Touch Target Compliance
**Score: 92 | Priority: Must | Risk: Medium**

### Intent
Every interactive element maintains a minimum 44×44px touch target per Apple HIG and WCAG 2.5.5 (AAA). No regressions from the current implementation.

### Implementation
- Button component: `min-h-[44px]` on all variants
- Create Tailwind utility alias `min-h-touch` = `44px` for reuse
- Icon-only buttons: both `min-h-[44px]` and `min-w-[44px]`
- BottomNav tabs: full-height tap zones
- Drawer handles: minimum 44px height

### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| 8.1 | All Button variants have ≥44px height | Computed height in DevTools ≥ 44px for all 5 variants |
| 8.2 | Icon-only buttons have ≥44px width AND height | `icon` variant: computed width and height both ≥ 44px |
| 8.3 | BottomNav tap zones are ≥44px height | Computed height of nav item ≥ 44px |
| 8.4 | No existing interactive element has height < 44px after migration | Browser accessibility audit or manual DevTools check on key elements |
| 8.5 | `min-h-touch` utility defined in tailwind config | `grep "min-h-touch" tailwind.config.ts` returns match |

---

## Sub-Spec 9: Bundle Size Constraint
**Score: 88 | Priority: Must | Risk: Medium**

### Intent
Net bundle size increase from adding Tailwind, Lucide, and Radix packages must remain under 50KB gzipped compared to the pre-overhaul baseline.

### Expected Size Profile
| Package | Estimated Gzipped |
|---------|-------------------|
| Tailwind CSS output | ~10-30KB |
| Lucide (per icon, tree-shaken) | ~1KB each |
| Radix primitives (adopted only) | ~15-25KB total |
| CVA + clsx + tailwind-merge | ~5KB |
| **Total estimate** | **~35-60KB** |

Note: Tailwind replaces previous CSS — the delta is the net difference, not total.

### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| 9.1 | Bundle size delta after Phase 1 is measured and recorded | `vite build` output captured; gzipped size noted |
| 9.2 | Bundle size delta after Phase 5 ≤ 50KB gzipped vs pre-overhaul baseline | Compare `vite build` output: new vs baseline |
| 9.3 | No full Lucide library imported (tree-shaking enforced) | `grep -rn "from 'lucide-react'" src/` shows named imports only, not `* as` |
| 9.4 | Only adopted shadcn Radix packages in bundle | `package.json` lists only: @radix-ui/react-tooltip, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-tabs, @radix-ui/react-toast, and any Sheet/Collapsible deps |

---

## Sub-Spec 10: Accessibility Compliance
**Score: 90 | Priority: Must | Risk: Medium**

### Intent
All shadcn/Radix components maintain or improve accessibility. Lighthouse accessibility score ≥ 90.

### Key Concerns
- Focus trapping in Dialog and Sheet
- Keyboard navigation in DropdownMenu and Tabs
- ARIA roles provided by Radix primitives
- TipTap editor focus not conflicted by Sheet/Dialog focus trapping
- Screen reader announcements for Toast notifications

### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| 10.1 | Lighthouse accessibility score ≥ 90 | `npx lighthouse <app-url> --only-categories=accessibility` score ≥ 90 |
| 10.2 | Dialog focus trap contains Tab navigation | Keyboard test: Tab within open Dialog stays inside Dialog |
| 10.3 | Sheet focus trap does not conflict with TipTap editor | Open QuickNoteDrawer → editor is focusable and types normally |
| 10.4 | DropdownMenu navigable by keyboard (arrow keys, Enter, Escape) | Keyboard test: open → navigate → select → close all work |
| 10.5 | Tabs (CharacterSubNav) navigable by arrow keys | Left/right arrow keys switch tabs per ARIA tabs pattern |
| 10.6 | Toast announcements reach screen readers | Toast has `role="alert"` or `aria-live="polite"` attribute |
| 10.7 | No Radix + React 19 console errors | Browser console shows 0 errors related to Radix after Phase 1 |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CSS specificity conflicts (inline style vs Tailwind) | High | Medium | Remove ALL inline styles in same commit per component; grep verification required |
| React 19 + Radix incompatibility | Medium | High | Phase 1 validation gate: render Tooltip before touching existing components; fallback: hand-roll 6 components |
| TipTap focus conflict with Radix Sheet/Dialog | Medium | Medium | Explicit test of QuickNoteDrawer in Phase 2 before broader Sheet adoption |
| Dynamic class names purged by Tailwind | Medium | Medium | Audit all dynamic class patterns in Phase 1; add to safelist |
| shadcn component drift (Radix version bumps) | Low | Low | Keep customizations minimal and well-commented; own the source |
| Bundle size exceeds 50KB delta | Low | Medium | Measure after Phase 1; escalate if trending over; defer Phase 5 textures if needed |

---

## Execution Checklist

### Before Starting Each Phase
- [ ] `git status` — working directory clean (commit previous phase)
- [ ] All previous phase acceptance criteria passing

### After Each Phase
- [ ] `tsc -b` exits 0
- [ ] `vite build` exits 0
- [ ] Grep for remaining `style={{` in migrated files returns 0
- [ ] Visual check in dark, parchment, and light themes
- [ ] Commit with descriptive message

### Phase Gate: Phase 1 → Phase 2
- [ ] Radix + React 19 compatibility confirmed (no console errors)
- [ ] Tailwind classes resolve correctly in all three themes
- [ ] `cn()` utility available and tested
- [ ] **If Phase 1 gate fails:** escalate; do not proceed

### Final Acceptance (All Phases Complete)
- [ ] `grep -rn "style={{" src/components/ src/screens/` → 0 matches
- [ ] All shadcn components support keyboard navigation
- [ ] All interactive elements ≥ 44px touch targets
- [ ] Lighthouse accessibility score ≥ 90
- [ ] Bundle delta < 50KB gzipped
- [ ] PWA offline: app loads and navigates without network
- [ ] `tsc -b` exits 0
- [ ] `vite build` exits 0, no TypeScript errors in output

---

## File Paths Reference

```
src/
├── lib/
│   └── utils.ts                    (cn() helper — CREATE in Phase 1)
├── components/
│   ├── ui/                         (shadcn copies — CREATE in Phase 1)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── sheet.tsx
│   │   ├── toast.tsx
│   │   ├── toaster.tsx
│   │   ├── tabs.tsx
│   │   ├── dropdown-menu.tsx
│   │   └── tooltip.tsx
│   ├── primitives/
│   │   ├── Button.tsx              (MIGRATE Phase 2 — replace with shadcn Button)
│   │   ├── Card.tsx                (MIGRATE Phase 2)
│   │   ├── SectionPanel.tsx        (MIGRATE Phase 2)
│   │   ├── Toast.tsx               (MIGRATE Phase 2 — replace with shadcn)
│   │   ├── Toast.module.css        (DELETE in Phase 2)
│   │   └── GameIcon.tsx            (DO NOT MODIFY)
│   ├── shell/
│   │   ├── BottomNav.tsx           (MIGRATE Phase 3)
│   │   ├── CharacterSubNav.tsx     (MIGRATE Phase 3 — use shadcn Tabs)
│   │   ├── CampaignHeader.tsx      (MIGRATE Phase 3)
│   │   └── GlobalFAB.tsx           (MIGRATE Phase 3)
│   └── panels/                     (MIGRATE Phase 4 — screen-specific panels)
├── screens/                        (MIGRATE Phase 4 — all 12 screens)
├── theme/
│   └── theme.css                   (READ ONLY — single source of truth for colors)
└── styles/
    └── fonts.css                   (READ ONLY — font imports)
tailwind.config.ts                  (CREATE/CONFIGURE in Phase 1)
```

---

## Decision Authority Summary

| Decision | Who Decides |
|----------|-------------|
| Tailwind class choices (spacing, color, typography) | Agent |
| Animation timing and easing values | Agent |
| Lucide icon selection | Agent |
| Tailwind safelist entries | Agent |
| File organization within src/components/ui/ | Agent |
| New npm dependency not in permitted list | **Escalate → Human** |
| Changes to component public prop APIs | **Recommend → Human approves** |
| Removal of existing components | **Recommend → Human approves** |
| Scope changes (screens added/removed) | **Human decides** |
| Final visual aesthetic judgments | **Human decides** |
| Data model or repository changes | **Human decides (and are blocked)** |

---

*Generated by forge agent · Run 2026-04-03T22-16-42-design-doc · Spec v1.0*
