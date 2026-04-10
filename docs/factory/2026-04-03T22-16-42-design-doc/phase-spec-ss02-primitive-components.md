# Phase Spec — SS-02: Phase 2 Primitive Components

**Run:** 2026-04-03T22-16-42-design-doc
**Sub-Spec:** SS-02
**Score:** 90 | Priority: Must | Risk: Medium
**Dependency:** ⚠️ DEPENDS ON SS-01 (Foundation Setup) — do not begin until SS-01 phase gate passes and `cn()`, Tailwind, and Radix packages are confirmed working.

---

## Intent

Replace the lowest-level UI building blocks with Tailwind-styled equivalents backed by shadcn/Radix where appropriate. All higher-level components (SS-03 shell, SS-04 screens) depend on these primitives, so correctness here is critical.

---

## Scope

| Sub-component | Action |
|---------------|--------|
| Button | Rebuild with shadcn Button + CVA variants |
| Card | Rebuild with Tailwind classes, two variants |
| SectionPanel | Rebuild with Tailwind + Lucide chevrons + smooth collapse |
| Modal → Dialog | Replace with shadcn Dialog (Radix-backed) |
| Drawer → Sheet | Replace with shadcn Sheet (Radix-backed) |
| Toast | Replace with shadcn Toast/Toaster; delete Toast.module.css |

---

## File Paths to Create / Modify / Delete

| Action | Path |
|--------|------|
| MODIFY | `src/components/primitives/Button.tsx` |
| MODIFY | `src/components/primitives/Card.tsx` |
| MODIFY | `src/components/primitives/SectionPanel.tsx` |
| MODIFY | `src/components/primitives/Toast.tsx` |
| DELETE | `src/components/primitives/Toast.module.css` |
| CREATE | `src/components/ui/button.tsx` |
| CREATE | `src/components/ui/card.tsx` |
| CREATE | `src/components/ui/dialog.tsx` |
| CREATE | `src/components/ui/sheet.tsx` |
| CREATE | `src/components/ui/toast.tsx` |
| CREATE | `src/components/ui/toaster.tsx` |

---

## Implementation Steps

### 2a. Button

1. Copy shadcn Button source to `src/components/ui/button.tsx`.
2. Define CVA variants using `class-variance-authority`:
   - `primary`: accent background, white text, gold border option
   - `secondary`: surface background, muted border
   - `ghost`: transparent, text color only
   - `danger`: destructive background/text
   - `icon`: square, no text, centered icon
3. All variants: add `min-h-[44px]` (touch target).
4. Icon variant: also add `min-w-[44px]`.
5. Fantasy press effect: `active:scale-[0.97] active:shadow-inner`.
6. Update `src/components/primitives/Button.tsx` to re-export from `src/components/ui/button.tsx` (or replace inline).
7. Remove all `style={{` from Button.

### 2b. Card

1. Copy shadcn Card source to `src/components/ui/card.tsx`.
2. Add `elevated` variant: `shadow-sm hover:shadow-md rounded-xl` with subtle border gradient.
3. Add `inset` variant: inner shadow, recessed feel.
4. Update `src/components/primitives/Card.tsx` to use new Card.
5. Remove all `style={{` from Card.

### 2c. SectionPanel

1. Replace Unicode `▲`/`▼` toggle icons with Lucide `ChevronUp`/`ChevronDown`.
2. Implement smooth collapse using CSS `grid-template-rows: 0fr / 1fr` transition OR wrap content in Radix Collapsible.
3. Style header with subtle gradient background and gold bottom border accent (`border-b border-gold`).
4. Add icon slot: GameIcon with gold tint, more prominent.
5. Remove all `style={{` from SectionPanel.

### 2d. Modal → shadcn Dialog

1. Copy shadcn Dialog source to `src/components/ui/dialog.tsx`.
2. Customize overlay: dark backdrop with subtle grain texture (via `bg-black/60 backdrop-blur-sm`).
3. Animate: overlay fade-in (`animate-in fade-in`), content scale-in (`animate-in zoom-in-95`).
4. Confirm: focus trapping, Escape-to-close, click-outside-to-close all functional via Radix.
5. Update all existing Modal usages to import from `src/components/ui/dialog.tsx`.

### 2e. Drawer → shadcn Sheet

1. Copy shadcn Sheet source to `src/components/ui/sheet.tsx`.
2. Configure bottom slide: `side="bottom"` with spring-like easing on animate.
3. Add drag handle indicator at top of sheet (`w-10 h-1 rounded-full bg-muted mx-auto mt-2`).
4. Find all existing Drawer usages across the codebase and replace with Sheet.

### 2f. Toast → shadcn Toast

1. Copy shadcn Toast and Toaster sources to `src/components/ui/toast.tsx` and `src/components/ui/toaster.tsx`.
2. Define variants: `default`, `success`, `destructive`, `info`.
3. Add `role="alert"` for screen reader announcements.
4. Preserve the existing external `showToast()` API — wire it to the new shadcn Toast internals.
5. Delete `src/components/primitives/Toast.module.css`.
6. Update `src/components/primitives/Toast.tsx` to wrap the new shadcn implementation.

---

## Acceptance Criteria

| ID | Criterion | Verification Command / Method |
|----|-----------|-------------------------------|
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

## Verification Commands

```bash
# Check for style={{ in primitives
grep -rn "style={{" src/components/primitives/ src/components/ui/

# Check Lucide chevrons in SectionPanel
grep -n "ChevronUp\|ChevronDown" src/components/primitives/SectionPanel.tsx

# Confirm Toast.module.css is deleted
ls src/components/primitives/Toast.module.css

# TypeScript + build
tsc -b
vite build
```

---

## Notes

- **Do NOT modify `GameIcon.tsx`** — only import it in SectionPanel icon slot.
- TipTap editor focus conflict: after integrating Sheet, manually test QuickNoteDrawer to confirm TipTap editor is still focusable inside the sheet before proceeding to SS-03.
