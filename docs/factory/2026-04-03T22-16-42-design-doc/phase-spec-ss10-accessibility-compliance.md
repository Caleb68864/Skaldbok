# Phase Spec — SS-10: Accessibility Compliance

**Run:** 2026-04-03T22-16-42-design-doc
**Sub-Spec:** SS-10
**Score:** 90 | Priority: Must | Risk: Medium
**Dependency:** ⚠️ DEPENDS ON SS-01 through SS-04 — accessibility compliance is verified after all components and screens are migrated. Individual component-level checks (Dialog focus trap, Sheet/TipTap conflict) should be validated as part of SS-02 and SS-03, but the Lighthouse score audit is the final gate after SS-04.

---

## Intent

All shadcn/Radix components maintain or improve accessibility. Lighthouse accessibility score ≥ 90. No new a11y regressions introduced by the Tailwind migration.

---

## Key Concerns

| Concern | Risk | Mitigation |
|---------|------|-----------|
| Focus trapping in Dialog and Sheet | Medium | Radix handles this; verify with keyboard test |
| Keyboard navigation in DropdownMenu and Tabs | Medium | Radix handles; verify with keyboard test |
| ARIA roles from Radix primitives | Low | Radix provides correct ARIA by default |
| TipTap editor focus conflict with Sheet focus trapping | Medium | Explicit test of QuickNoteDrawer |
| Screen reader announcements for Toast | Medium | Verify `role="alert"` or `aria-live` on Toast |
| Radix + React 19 console errors | Medium | Already a Phase 1 gate; confirm zero errors persist |

---

## File Paths to Verify / Modify

| Action | Path |
|--------|------|
| VERIFY | `src/components/ui/dialog.tsx` — focus trap, Escape, backdrop |
| VERIFY | `src/components/ui/sheet.tsx` — focus trap, TipTap conflict |
| VERIFY | `src/components/ui/dropdown-menu.tsx` — keyboard nav |
| VERIFY | `src/components/ui/tabs.tsx` — arrow key nav |
| VERIFY | `src/components/ui/toast.tsx` — `role="alert"` or `aria-live` |
| MODIFY | Any of the above if accessibility attributes are missing |

---

## Implementation Steps

### Step 1: Dialog — Focus Trap Verification

1. Open any Dialog in the app.
2. Press Tab repeatedly — focus must cycle within the Dialog only (not escape to background content).
3. Press Escape — Dialog must close.
4. Click outside Dialog content — Dialog must close.
5. After closing, focus must return to the trigger element.

If any of these fail, verify the Radix `<Dialog.Root>` and `<Dialog.Portal>` are properly configured. Radix provides this automatically — check for any CSS that might be hiding elements from the focus manager.

### Step 2: Sheet — TipTap Focus Conflict Test

1. Open any Sheet (bottom drawer) that contains a TipTap `<Editor>` (e.g., QuickNoteDrawer).
2. Click inside the TipTap editor area.
3. Type text — characters must appear in the editor.
4. Press Tab — if focus leaves the editor and gets trapped in the Sheet context incorrectly, investigate Radix focus scope config.
5. If conflict exists: add `asChild` or configure Radix `FocusScope` to allow editor focus. This may require a custom fix in `src/components/ui/sheet.tsx`.

### Step 3: DropdownMenu — Keyboard Navigation

1. Open any DropdownMenu (e.g., campaign selector in CampaignHeader).
2. Verify:
   - Arrow Down / Arrow Up navigate between items
   - Enter selects the focused item
   - Escape closes the menu without selecting
   - Home/End jump to first/last item (Radix default)
3. Radix DropdownMenu provides this automatically. If not working, check that the trigger button has `type="button"` to prevent form submission.

### Step 4: Tabs — Arrow Key Navigation

1. Focus any Tab group (e.g., CharacterSubNav).
2. Press Arrow Right — next tab activates.
3. Press Arrow Left — previous tab activates.
4. Verify `role="tablist"`, `role="tab"`, `role="tabpanel"` are present (Radix provides these automatically).
5. This matches the ARIA Tabs pattern.

### Step 5: Toast — Screen Reader Announcements

1. Open `src/components/ui/toast.tsx`.
2. Verify the toast wrapper has `role="alert"` (for immediate announcements like errors) OR `aria-live="polite"` (for non-urgent notifications).
3. Radix Toast uses `aria-live` by default — confirm it is present in the rendered output.
4. If missing, add the attribute explicitly.

### Step 6: Lighthouse Accessibility Audit

After SS-04 screen migration completes:
1. Run the app in production build mode: `vite build && vite preview`
2. Open Chrome DevTools → Lighthouse → Accessibility only → Run audit
3. Target: score ≥ 90
4. Fix any failing items identified by Lighthouse (typically: missing labels, color contrast issues, missing landmark roles)
5. Common fixes:
   - Add `aria-label` to icon-only buttons
   - Ensure form inputs have associated `<label>` elements
   - Check color contrast ratios meet WCAG AA (4.5:1 for text)

### Step 7: Zero Radix + React 19 Console Errors

1. Open browser console.
2. Navigate through all main routes.
3. Interact with all Radix-backed components (Dialog, Sheet, DropdownMenu, Tabs, Toast, Tooltip).
4. Verify zero console errors related to Radix prop types or React 19 compatibility.

---

## Acceptance Criteria

| ID | Criterion | Verification Command / Method |
|----|-----------|-------------------------------|
| 10.1 | Lighthouse accessibility score ≥ 90 | `npx lighthouse <app-url> --only-categories=accessibility` score ≥ 90 |
| 10.2 | Dialog focus trap contains Tab navigation | Keyboard test: Tab within open Dialog stays inside Dialog |
| 10.3 | Sheet focus trap does not conflict with TipTap editor | Open QuickNoteDrawer → editor is focusable and types normally |
| 10.4 | DropdownMenu navigable by keyboard (arrow keys, Enter, Escape) | Keyboard test: open → navigate → select → close all work |
| 10.5 | Tabs (CharacterSubNav) navigable by arrow keys | Left/right arrow keys switch tabs per ARIA tabs pattern |
| 10.6 | Toast announcements reach screen readers | Toast has `role="alert"` or `aria-live="polite"` attribute |
| 10.7 | No Radix + React 19 console errors | Browser console shows 0 errors related to Radix after all phases |

---

## Verification Commands

```bash
# Lighthouse CLI accessibility audit (requires app running on localhost)
npx lighthouse http://localhost:4173 --only-categories=accessibility --output=json

# Check Toast for aria attributes
grep -n "role=\"alert\"\|aria-live" src/components/ui/toast.tsx

# Check icon-only buttons for aria-label
grep -rn "variant=\"icon\"" src/components/ src/screens/ | head -20
# Then manually verify each has an aria-label or aria-labelledby

# TypeScript + build
tsc -b
vite build
```

---

## Notes

- Radix UI primitives provide correct ARIA semantics by default — most of these criteria are automatically satisfied if Radix is properly integrated.
- The main risk area is the TipTap + Sheet focus conflict (criterion 10.3). If this occurs, the fix is to use Radix's `FocusScope` `trapped={false}` option or to manage focus manually for the QuickNote Sheet.
- Color contrast for text is handled via `theme.css` tokens — verify that each theme's foreground/background token pairs meet WCAG AA (4.5:1 contrast ratio) during the visual audit.
