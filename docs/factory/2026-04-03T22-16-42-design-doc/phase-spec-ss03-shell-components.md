# Phase Spec — SS-03: Phase 3 Shell Components

**Run:** 2026-04-03T22-16-42-design-doc
**Sub-Spec:** SS-03
**Score:** 85 | Priority: Must | Risk: Medium
**Dependency:** ⚠️ DEPENDS ON SS-01 (Foundation Setup) AND SS-02 (Primitive Components) — do not begin until both prior phase gates pass.

---

## Intent

Upgrade the persistent chrome — nav bars, headers, FAB — which appear on every screen. These components create the first impression and frame all content. Shell components use the primitives from SS-02 (Button, Sheet, Dialog, shadcn Tabs) as building blocks.

---

## Scope

| Sub-component | Action |
|---------------|--------|
| BottomNav | Upgrade to icon + label tabs, frosted glass background |
| CharacterSubNav | Replace with shadcn Tabs, sliding underline, GameIcons |
| CampaignHeader | Lucide icons, pulsing session dot, shadcn DropdownMenu + Sheet |
| GlobalFAB | Accent FAB with Lucide icons, context-aware quick actions |

---

## File Paths to Create / Modify

| Action | Path |
|--------|------|
| MODIFY | `src/components/shell/BottomNav.tsx` |
| MODIFY | `src/components/shell/CharacterSubNav.tsx` |
| MODIFY | `src/components/shell/CampaignHeader.tsx` |
| MODIFY | `src/components/shell/GlobalFAB.tsx` |
| CREATE | `src/components/ui/tabs.tsx` (shadcn Tabs source) |
| CREATE | `src/components/ui/dropdown-menu.tsx` (shadcn DropdownMenu source) |

---

## Implementation Steps

### 3a. BottomNav

1. Add Lucide icons alongside existing tab labels:
   - Characters tab → `Scroll`
   - Session tab → `Flame`
   - Reference tab → `BookOpen`
2. Active state styling:
   - Icon uses accent color (`text-accent`)
   - Subtle scale-up on active: `scale-105` or CSS transform
   - Accent-colored bar above active tab (e.g., `border-t-2 border-accent`)
3. Background: apply `backdrop-blur-md bg-surface/80` for frosted glass.
4. Ensure each tap zone is `min-h-[44px]` (touch target compliance).
5. Remove all `style={{` from BottomNav.

### 3b. CharacterSubNav → shadcn Tabs

1. Copy shadcn Tabs source to `src/components/ui/tabs.tsx`.
2. Replace existing CharacterSubNav implementation with shadcn `<Tabs>`, `<TabsList>`, `<TabsTrigger>` structure.
3. Add GameIcon for each tab:
   - Sheet tab → sword or character GameIcon
   - Skills tab → skill/dice GameIcon
   - Gear tab → gear/backpack GameIcon
   - Magic tab → magic-swirl GameIcon
4. Style sliding underline indicator: use Tailwind `data-[state=active]` selectors for animated underline position.
5. Touch-optimize: `min-h-[44px]` on TabsTrigger elements.
6. Remove all `style={{` from CharacterSubNav.

### 3c. CampaignHeader

1. Replace any Unicode menu symbol (`≡`) with Lucide `Menu`.
2. Replace any Unicode down-arrow (`▼`) with Lucide `ChevronDown`.
3. Campaign name: ensure Marcellus display font class is applied (from `fonts.css`).
4. Session active indicator:
   - Pulsing dot using CSS animation: `animate-pulse` on a small accent-colored circle.
   - Show dot only when a session is active.
5. Campaign selector:
   - Copy shadcn DropdownMenu source to `src/components/ui/dropdown-menu.tsx`.
   - Replace existing campaign selector with `<DropdownMenu>` → keyboard-navigable (arrow keys, Enter, Escape).
6. Hamburger menu → shadcn Sheet:
   - Use Sheet from `src/components/ui/sheet.tsx` (created in SS-02).
   - Configure `side="right"` for right-to-left slide animation.
7. Remove all `style={{` from CampaignHeader.

### 3d. GlobalFAB + Quick Actions

1. FAB button:
   - Accent-colored circle using `bg-accent rounded-full`.
   - Icon: Lucide `Sparkles` when a session is active; Lucide `Plus` when inactive.
   - Switch icon based on session state from context.
2. Quick action items (icon + short label mini-card stack):
   - Dice roll → `Dice` icon
   - Shop/Cart → `ShoppingCart` icon
   - Gems/Loot → `Gem` icon
   - Quote/Lore → `Quote` icon
   - Listen/NPC → `Ear` icon
3. Quick-action drawers:
   - Each action opens a Sheet from `src/components/ui/sheet.tsx`.
   - Pre-fill with smart defaults from context: `activeCharacterInCampaign`, `character.skills`, `activeSession`.
4. Remove all `style={{` from GlobalFAB.

---

## Acceptance Criteria

| ID | Criterion | Verification Command / Method |
|----|-----------|-------------------------------|
| 3.1 | BottomNav shows Lucide icons alongside tab labels | Visual check: icons visible in nav bar |
| 3.2 | BottomNav active tab has accent-colored indicator bar | Active tab has visible top accent border |
| 3.3 | BottomNav has backdrop-blur background | CSS `backdrop-filter: blur(...)` present on nav element |
| 3.4 | CharacterSubNav uses shadcn Tabs with sliding underline | Tab switch shows animated underline transition |
| 3.5 | CampaignHeader uses Lucide Menu and ChevronDown | No Unicode `≡` or `▼` in CampaignHeader source; Lucide imports present |
| 3.6 | Session active indicator pulses via CSS animation | Active session dot has CSS `animation: pulse` or equivalent |
| 3.7 | Campaign selector dropdown is keyboard-navigable | Arrow keys navigate options; Enter selects; Escape closes |
| 3.8 | Hamburger menu Sheet slides from right | Sheet `side="right"` prop (or equivalent) produces right-to-left slide |
| 3.9 | FAB icon switches between Sparkles and Plus based on session state | Active session → Sparkles icon; inactive → Plus icon |
| 3.10 | Quick-action drawers pre-fill active character context | Opening Skill Check drawer shows active character's name/skills |
| 3.11 | Zero `style={{` in migrated Phase 3 components | `grep -rn "style={{" src/components/shell/` returns 0 matches |
| 3.12 | `tsc -b && vite build` pass after Phase 3 | Both commands exit 0 |

---

## Verification Commands

```bash
# Check for style={{ in shell components
grep -rn "style={{" src/components/shell/

# Check Lucide icon imports in CampaignHeader
grep -n "Menu\|ChevronDown" src/components/shell/CampaignHeader.tsx

# Check FAB session-aware icon
grep -n "Sparkles\|Plus" src/components/shell/GlobalFAB.tsx

# TypeScript + build
tsc -b
vite build
```

---

## Notes

- GameIcon assignments per tab are the agent's discretion — choose semantically appropriate fantasy icons.
- Lucide icon selection is agent's discretion — choose the most semantically appropriate name per the Icon Assignment Rules in SS-07.
- Do NOT modify `GameIcon.tsx` structurally; only import it.
