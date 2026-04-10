---
date: 2026-03-22
topic: "UX Polish and Visual Texture — Attribute Buttons, Mode Toggle, Reference Jump Nav, Fantasy Styling"
author: Caleb Bennett
status: draft
tags:
  - design
  - ux-polish
  - visual-texture
---

# UX Polish and Visual Texture -- Design

## Summary

Four independent improvements to the Skaldmark character sheet, all touch-first: (1) add horizontal +/- buttons to attributes in edit mode, (2) make the play/edit mode toggle clearer with icons and explicit labels, (3) add a floating pill bar to the reference screen for quick section jumping, and (4) apply CSS-only fantasy textures (noise grain, leather headers, embossed inputs, gold accents) across all three themes.

## Approach Selected

**Both combined (textures + depth/embossing)** for the visual treatment, applied across all three themes (dark, parchment, light) using CSS custom properties so textures automatically adapt to each palette.

## Architecture

```
TopBar
  [Skaldbok] [Name]     [crossed-swords PLAY MODE] [hamburger]
  ══════════ thick green border ═══════════════════

Attributes Section (Edit Mode)
  STR         CON         AGL         INT         WIL         CHA
 [-] 14 [+]  [-] 10 [+]  [-] 12 [+]  [-] 8 [+]  [-] 14 [+]  [-] 10 [+]
 Exhausted    Sickly      Dazed       Angry       Scared      Disheartened

Resources Section
  HP: [-] 8 [+] / 22
  WP: [-] 5 [+] / 10

Reference Screen
  [search bar]
  [sections...]
  ┌──────────────────────────────────────┐
  │ Combat │ Rules │ NPCs │ Travel │     │  <- floating pill bar
  └──────────────────────────────────────┘
  [bottom nav]

Visual texture applied to ALL surfaces via CSS pseudo-elements and shadows.
```

## Components

### 1. AttributeField -- Touch-Friendly Edit Controls

**Owns:** Rendering attribute value with optional +/- buttons based on edit/play mode.
**Does NOT own:** Mode detection (passed via `disabled` prop from SheetScreen).

- **Edit mode:** `[-] value [+]` -- big 48px touch-target buttons flanking the value, same visual style as ResourceTracker.
- **Play mode:** Static value display only (no buttons, no input element).
- Replaces `<input type="number">` entirely with button-driven counter.
- Buttons use embossed/beveled style from the texture system.

### 2. TopBar Mode Toggle -- Clear State Communication

**Owns:** Displaying current mode prominently with icon, toggling between modes.
**Does NOT own:** Mode state (comes from AppState context).

- Button gets a GameIcon: `crossed-swords` for play mode, `open-book` for edit mode.
- Label changes to "PLAY MODE" / "EDIT MODE" (more explicit than just "PLAY"/"EDIT").
- Background color stays (green=play, blue=edit).
- Top bar border becomes thicker/more prominent.

### 3. ReferenceScreen Jump Nav -- Floating Pill Bar

**Owns:** Quick-jump buttons for reference section categories, positioned above bottom nav.
**Does NOT own:** Section content, search filtering.

- Horizontal scrollable pill bar, `position: fixed` above the bottom nav.
- Each pill = one reference section category (Combat & Time, Core Rules, NPCs & Animals, NPC Generator & Travel).
- Tapping a pill scrolls to that section via `scrollIntoView({ behavior: 'smooth' })`.
- Active pill tracked via `IntersectionObserver` on section headers.
- Only visible on the reference tab (hidden on notes tab).
- Compact: 36px height, horizontal overflow scroll.

### 4. Visual Texture System -- CSS-Only Fantasy Treatment

**Owns:** All decorative surface treatments across all three themes.
**Does NOT own:** Layout, spacing, or color tokens.

| Layer | Target | Technique |
|-------|--------|-----------|
| Noise grain | `body` bg | Repeating radial gradient (pseudo-random dots) |
| Paper texture | Panel content | Linear gradient noise via `::before` pseudo-element |
| Leather strip | Panel headers | Darker gradient + gold bottom border |
| Embossed inputs | Inputs/buttons | `box-shadow: inset` highlight + shadow |
| Beveled borders | Cards, panels | Multi-layer light top-left, dark bottom-right |
| Gold accent lines | Headers, top bar | `border-bottom: 2px solid var(--color-gold)` |

All textures use CSS custom properties and `rgba()` overlays, so they adapt automatically to dark, parchment, and light themes.

## Data Flow

All four features have minimal data flow impact:

- **Attribute buttons:** Same `onChange` callback, triggered by button tap instead of number input.
- **Mode toggle:** Reads existing `settings.mode`; swaps icon/label/color. No new state.
- **Reference jump nav:** DOM-only. `scrollIntoView` on section IDs. `IntersectionObserver` for active pill tracking.
- **Visual textures:** Pure CSS. Zero data flow.

## Error Handling

- **Attribute min/max clamping:** Buttons disable at boundaries (3-18 for Dragonbane). Same logic as current input.
- **Rapid mode toggling:** Synchronous state flip, no race condition possible.
- **Collapsed sections on jump:** Scroll to section header (always visible even when collapsed).
- **Pill bar overflow:** Horizontal scroll with `-webkit-overflow-scrolling: touch`.
- **Texture performance:** CSS-only, GPU-composited. No paint issues on mobile.
- **Accessibility:** Textures are decorative (`pointer-events: none`). Touch targets remain >= 44px. Text contrast unchanged.

## Open Questions

None. All features are well-scoped and build on existing patterns.

## Approaches Considered

### Visual Texture Direction
- **Subtle texture overlays only:** Lower effort, adds grain/paper feel but surfaces remain flat. Not selected -- user wanted the full treatment.
- **Inset/embossed depth only:** Adds structural depth but surfaces feel plain without texture. Not selected -- user wanted both.
- **Both combined (selected):** Full fantasy treatment with texture AND depth. More work but the most immersive result for a TTRPG app.

### Reference Jump Nav
- **Sticky pinned bar:** Always visible at top, but takes 44px of vertical space permanently. Not selected.
- **Static at top only:** Minimal intrusion but requires scrolling back up. Not selected.
- **Floating pill bar (selected):** Compact, always accessible, positioned above bottom nav. Minimal screen real estate impact.

### Attribute Layout
- **Vertical stack:** [+] above, [-] below. Compact but unconventional. Not selected.
- **Horizontal flanking (selected):** [-] value [+]. Familiar counter pattern, consistent with ResourceTracker.
- **Side stepper arrows:** Minimal but too small for touch-first design. Not selected.

## Next Steps
- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-03-22-ux-polish-and-visual-texture-design.md`)
- [ ] Implement attribute +/- buttons (SS-1)
- [ ] Implement mode toggle improvements (SS-2)
- [ ] Implement reference jump nav (SS-3)
- [ ] Implement visual texture system (SS-4)
