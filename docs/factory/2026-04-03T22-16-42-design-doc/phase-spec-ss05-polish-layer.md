# Phase Spec — SS-05: Phase 5 Polish Layer

**Run:** 2026-04-03T22-16-42-design-doc
**Sub-Spec:** SS-05
**Score:** 65 | Priority: Should | Risk: Low
**Dependency:** ⚠️ DEPENDS ON SS-01 through SS-04 — do not begin until ALL prior screen migrations (SS-04) are complete and verified. Polish is applied last to avoid rework.

---

## Intent

Layer fantasy-specific texture and micro-interaction details that elevate the app from "looks good" to "feels premium." Executed strictly after all screens are migrated to avoid rework.

---

## Scope

| Sub-component | Details |
|---------------|---------|
| Fantasy Texture System | Noise grain on body, panel gradients, input inset shadow, card bevel |
| Micro-Interactions | Button press scale, card tap shadow lift, toast slide/fade, theme toggle transition |

---

## File Paths to Create / Modify

| Action | Path |
|--------|------|
| MODIFY | `src/index.css` or root CSS (grain overlay pseudo-element) |
| MODIFY | `tailwind.config.ts` (add animation keyframes/utilities if needed) |
| MODIFY | `src/components/ui/button.tsx` (press animation) |
| MODIFY | `src/components/ui/card.tsx` (tap shadow lift) |
| MODIFY | `src/components/ui/toast.tsx` (slide/fade animation) |
| MODIFY | `src/components/shell/CampaignHeader.tsx` (theme toggle border transition) |
| MODIFY | `src/theme/theme.css` — **additive only** (new `data-theme` texture tokens if needed) |

**`src/theme/theme.css` is effectively read-only — only additive changes (new custom properties) are permitted. No deletions.**

---

## Implementation Steps

### 5a. Fantasy Texture System

1. **Grain overlay on body background:**
   - Add a `::before` or `::after` pseudo-element on the root `<body>` or `#root` element.
   - Use an SVG noise filter or a base64-encoded noise PNG as `background-image`.
   - Layer it with `mix-blend-mode: overlay` and low `opacity` (e.g., 0.03–0.06).
   - Use `pointer-events: none` and `position: fixed; inset: 0; z-index: -1` so it underlays all content.
   - Ensure GPU compositing: use only `transform` and `opacity` for any animation on the pseudo-element.

2. **Panel headers:**
   - Add a darker gradient on SectionPanel headers via Tailwind: e.g., `bg-gradient-to-r from-surface to-surface/80`.
   - Gold accent bottom border: `border-b border-gold`.
   - Ensure these adapt per `data-theme` via CSS variable references.

3. **Input fields:**
   - Apply soft inset shadow to `<input>` and `<textarea>` elements: `shadow-inner`.
   - Use Tailwind's `ring` utilities for focus states instead of browser default outline.

4. **Cards — multi-layer beveled border:**
   - Light top-left border: `border-t border-l border-white/10`.
   - Dark bottom-right border: `border-b border-r border-black/20`.
   - Use `box-shadow` layering via Tailwind's `shadow` utilities or extend config with custom shadows.
   - Ensure bevel adapts per `data-theme` (via opacity-based approach so it works on both dark and light surfaces).

5. **All textures via CSS custom properties:**
   - If theme-specific texture values are needed, add new `--texture-*` custom properties to `theme.css` under each `[data-theme]` block (additive only).
   - Reference them in Tailwind config or component classes.

### 5b. Micro-Interactions

1. **Button press:**
   - Add `active:scale-[0.97]` to Button component (may already be present from SS-02; verify and ensure it's in place).
   - Pair with `active:shadow-inner` for shadow reduction on press.
   - Use `transition-all duration-75` for snappy feel.

2. **Card tap:**
   - Add `transition-shadow duration-150` to Card.
   - On hover/active: promote from `shadow-sm` to `shadow-md`.

3. **Toast enter/exit:**
   - Slide + fade using Tailwind `animate-in slide-in-from-bottom-4 fade-in` on enter.
   - Slide + fade using `animate-out slide-out-to-bottom-4 fade-out` on exit.
   - Confirm these animation classes exist in Tailwind v4 or add custom keyframes to `tailwind.config.ts`.

4. **Theme toggle transition:**
   - On `CampaignHeader`, add `transition-colors duration-300` to the border/background that changes with `data-theme`.
   - This creates a smooth color sweep when the user toggles themes.

5. **Drawer open (Sheet):**
   - Verify Sheet uses spring-like timing: `duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]` or similar.
   - Adjust in `src/components/ui/sheet.tsx` if needed.

---

## Acceptance Criteria

| ID | Criterion | Verification Command / Method |
|----|-----------|-------------------------------|
| 5.1 | Grain texture overlay present on body background | CSS `::before` or `::after` pseudo-element with noise texture visible in browser inspector |
| 5.2 | Textures adapt across all three themes | Switching themes shows texture adapts (no fixed colors) |
| 5.3 | Button press scale animation works | Pressing button shows brief scale-down with no layout shift |
| 5.4 | No layout thrashing from micro-interactions | Chrome Performance panel shows no forced reflows during animations |
| 5.5 | GPU compositing used for animations | Animated properties limited to `transform` and `opacity` (no animating width/height/margin) |
| 5.6 | `tsc -b && vite build` pass after Phase 5 | Both commands exit 0 |

---

## Verification Commands

```bash
# TypeScript + build
tsc -b
vite build

# Confirm no color deletions from theme.css
git diff HEAD -- src/theme/theme.css

# Confirm no inline styles added (guard against regressions)
grep -rn "style={{" src/components/ src/screens/
```

---

## Notes

- If bundle size is trending toward the 50KB gzipped delta limit (per SS-09), the grain texture (especially if it uses a PNG) may be deferred or replaced with an SVG filter to minimize size impact.
- All animations MUST use only `transform` and `opacity` for GPU compositing — no animating `width`, `height`, `padding`, or `margin`.
- If `animate-in` / `animate-out` Tailwind classes are not available in v4, add custom keyframes in `tailwind.config.ts`.
