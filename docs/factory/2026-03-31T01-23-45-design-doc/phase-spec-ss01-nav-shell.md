# Phase Spec — SS-01: Navigation Shell Rebuild

```yaml
sub-spec: SS-01
title: Navigation Shell Rebuild
stage: 1
priority: P0
score: 94
depends-on: none
run: 2026-03-31T01-23-45-design-doc
```

> **Dependency Order:** No dependencies. This sub-spec can begin in parallel with SS-04 and SS-05 once SS-02 and SS-03 are complete. However, CampaignContext (SS-03) must be available before the campaign header can display live data. The shell scaffolding (routes, layout, empty screens) can be implemented without SS-03 if SS-03 is not yet finished.

---

## Intent

Replace the current navigation shell with a 4-tab bottom nav that makes campaign, session, notes, and character access a single tap away. The shell must not introduce any character tab regression.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-S1-01 | Four bottom-nav tabs render: **Session**, **Notes**, **Character**, **More**. Each tab is tappable and routes to its respective screen. |
| AC-S1-02 | Campaign header renders as a persistent bar above tab content. Shows active campaign name when a campaign is set. Shows "No campaign" (or equivalent neutral label) when none exists. Tapping the header opens a campaign selector overlay. |
| AC-S1-03 | Character tab renders a horizontal sub-nav (pill bar or equivalent) with sections: **Sheet / Skills / Gear / Magic**. Each pill routes to the corresponding existing screen without visual regression compared to the pre-migration app. |
| AC-S1-04 | Session tab and Notes tab each show a prompt card when no campaign is active: text includes "Create a campaign to get started" or semantically equivalent copy. Character tab renders fully and independently of campaign state. |
| AC-S1-05 | All primary tab-bar tap targets are ≥ 44 × 44 px (verified by visual inspection or computed style check in dev tools). |
| AC-S1-06 | No TypeScript compiler errors introduced by shell changes. |
| AC-S1-07 | Existing character sheet screens (Sheet, Skills, Gear, Magic) render without console errors after migration into Character sub-tab. |

---

## Implementation Steps

1. **Create shell directory structure**
   - `src/components/shell/BottomNav.tsx`
   - `src/components/shell/CampaignHeader.tsx`
   - `src/components/shell/CharacterSubNav.tsx`
   - `src/components/shell/ShellLayout.tsx` (wrapper combining header + content + bottom nav)

2. **Implement `BottomNav.tsx`**
   - Four tabs: Session, Notes, Character, More
   - Use named export `BottomNav`
   - Render with `style={{}}` inline CSS using CSS variables for highlight color (e.g., `var(--color-accent)`)
   - Each tab button: `min-height: 44px; min-width: 44px`
   - Active tab indicated via CSS variable color change
   - Use React Router `useLocation` + `Link` (or `useNavigate`) to drive active state and navigation

3. **Implement `CampaignHeader.tsx`**
   - Reads `activeCampaign` from `CampaignContext` (null-safe: if null, show "No campaign")
   - Tapping the header opens a campaign selector overlay (can be a simple modal listing campaigns)
   - Export as named export `CampaignHeader`
   - Inline styles only; CSS variable for background

4. **Implement `CharacterSubNav.tsx`**
   - Horizontal pill bar with: Sheet, Skills, Gear, Magic
   - Each pill navigates to the existing character screen route
   - Named export `CharacterSubNav`
   - Pill height ≥ 44px

5. **Implement `ShellLayout.tsx`**
   - Composes: `CampaignHeader` (top) + `<Outlet />` or `{children}` (middle, flex-grow) + `BottomNav` (bottom)
   - Named export `ShellLayout`
   - Full viewport height layout using `display: flex; flex-direction: column; height: 100dvh`

6. **Update router configuration** (`src/routes/index.tsx`)
   - Replace `AppLayout` import with `ShellLayout` import
   - Replace `<AppLayout />` with `<ShellLayout />` as the layout element
   - Define routes for `/session`, `/notes`, `/character` (with nested routes for sub-nav)
   - Character nested routes: `/character/sheet`, `/character/skills`, `/character/gear`, `/character/magic`
   - Keep existing screen imports as default imports (they use `export default` — grandfathered per XC-03/XC-04 precedent)
   - Redirect root `/` to `/character/sheet` (preserve existing behaviour)
   - **Deprecate** `src/app/AppLayout.tsx` — delete or leave as dead code (ShellLayout replaces it)
   - **Deprecate** `src/components/layout/BottomNav.tsx` — the new shell `BottomNav` replaces it
   - **Preserve** `src/components/layout/TopBar.tsx` — integrate into `ShellLayout` if the campaign header replaces it, or keep alongside

7. **Add "no campaign" prompt cards**
   - Create a shared `NoCampaignPrompt` component (or inline) for Session and Notes tabs
   - Renders when `activeCampaign` from `CampaignContext` is null
   - Text: "Create a campaign to get started"

8. **Smoke-test character tab regression**
   - Confirm Sheet, Skills, Gear, Magic screens mount without console errors inside the sub-nav wrapper
   - Check that existing screen props/context access is unaffected

---

## Verification Commands

> Note: All verification is done via TypeScript compiler and manual browser inspection — no shell commands.

```
# TypeScript check (no shell; use IDE or build tool)
npx tsc --noEmit

# Manual checks in browser dev tools:
# 1. Inspect bottom nav buttons → computed height/width ≥ 44px
# 2. Navigate all 4 tabs — no blank screens
# 3. Navigate all 4 character sub-tabs — no console errors
# 4. With no active campaign: Session and Notes tabs show prompt card
# 5. With no active campaign: Character tab renders fully
# 6. Tap campaign header → campaign selector overlay opens
```

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| **Create** | `src/components/shell/BottomNav.tsx` |
| **Create** | `src/components/shell/CampaignHeader.tsx` |
| **Create** | `src/components/shell/CharacterSubNav.tsx` |
| **Create** | `src/components/shell/ShellLayout.tsx` |
| **Modify** | `src/routes/index.tsx` — replace `AppLayout` with `ShellLayout`, restructure routes |
| **Delete/Deprecate** | `src/app/AppLayout.tsx` — replaced by `ShellLayout` |
| **Delete/Deprecate** | `src/components/layout/BottomNav.tsx` — replaced by new shell `BottomNav` |
| **Note** | Existing screen files use `export default` — leave as-is (grandfathered). Import them as default imports in routes. Only NEW files use named exports per XC-04. |

---

## Cross-Cutting Constraints (apply to this sub-spec)

- `XC-01` Zero TypeScript errors
- `XC-03` Inline `style={{}}` with CSS variables; no new className-based styling
- `XC-04` Named exports only — no default exports
- `XC-08` Existing character sheet screens must render without regression
