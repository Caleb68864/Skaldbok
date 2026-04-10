# Phase Spec — SS-02: TopBar Mode Toggle Enhancement

## Dependencies
None. This sub-spec can be implemented independently.

## Objective
Update the mode toggle button in `TopBar.tsx` to include a `GameIcon` and explicit "PLAY MODE" / "EDIT MODE" label. Ensure the top bar border is thick (>= 3px) and mode-colored.

## Files to Modify
- `src/components/layout/TopBar.tsx`

## Files to Read (Reference Only)
- `src/components/primitives/GameIcon.tsx` — confirm usage pattern and props
- `src/context/AppStateContext.tsx` — confirm `settings.mode` and `toggleMode` API (read only, do NOT modify)
- `src/types/settings.ts` — confirm `ModeName` type

## Acceptance Criteria
1. `[STRUCTURAL]` The mode toggle button renders a `GameIcon` component: `name="crossed-swords"` in play mode, `name="open-book"` in edit mode.
2. `[STRUCTURAL]` The button text reads "PLAY MODE" when `settings.mode === 'play'` and "EDIT MODE" when `settings.mode === 'edit'`.
3. `[STRUCTURAL]` The button displays the icon and text inline with a gap (e.g., `display: 'inline-flex'`, `alignItems: 'center'`, `gap`).
4. `[BEHAVIORAL]` The `onClick` handler remains `toggleMode` — no functional change to mode switching behavior.
5. `[STRUCTURAL]` The `top-bar` header element's `borderBottom` is at least `3px solid` using `var(--color-mode-play)` or `var(--color-mode-edit)` based on current mode.
6. `[BEHAVIORAL]` The `aria-label` attribute updates to "Switch to Edit Mode" or "Switch to Play Mode" based on current state.

## Implementation Steps

1. **Read `TopBar.tsx`** to understand current structure, how mode is accessed, and the existing toggle button markup.
2. **Read `GameIcon.tsx`** to confirm the component's props interface (likely `name: string`, possibly `size`).
3. **Modify `TopBar.tsx`**:
   - Import `GameIcon` if not already imported.
   - Locate the mode toggle button.
   - Replace the button's content with:
     - A `<GameIcon name={settings.mode === 'play' ? 'crossed-swords' : 'open-book'} />` component (use appropriate size prop if needed, e.g., `size={18}` or `size={20}`).
     - Text: `{settings.mode === 'play' ? 'PLAY MODE' : 'EDIT MODE'}`.
   - Style the button with `display: 'inline-flex'`, `alignItems: 'center'`, `gap: '6px'` (or similar).
   - Update the `aria-label` to `settings.mode === 'play' ? 'Switch to Edit Mode' : 'Switch to Play Mode'`.
   - Update the header element's `borderBottom` style to `3px solid ${settings.mode === 'play' ? 'var(--color-mode-play)' : 'var(--color-mode-edit)'}` (or use the existing mode color variable pattern).
4. **Verify** `onClick` handler is unchanged (`toggleMode`).

## Edge Cases
- **Narrow screens (< 320px):** "PLAY MODE" / "EDIT MODE" text plus icon may overflow. Use `whiteSpace: 'nowrap'` and let the button flex-shrink if needed. The icon alone is sufficient to convey mode.
- **Theme switch while toggle visible:** Colors adapt via CSS custom properties automatically.

## Constraints
- MUST NOT modify `AppStateContext.tsx` or `toggleMode()`.
- MUST NOT add new state or props to `TopBar`.
- `GameIcon` component is already available — no new dependencies.
- No new component files.
- Prefer inline styles consistent with existing codebase pattern.

## Verification Commands
```bash
# Build must succeed
npx vite build

# Verify GameIcon is imported and used
grep -n "GameIcon" src/components/layout/TopBar.tsx
# Expected: import line + usage in JSX

# Verify MODE labels exist
grep -n "PLAY MODE\|EDIT MODE" src/components/layout/TopBar.tsx
# Expected: both labels present

# Verify aria-label updates
grep -n "aria-label" src/components/layout/TopBar.tsx
# Expected: "Switch to Edit Mode" / "Switch to Play Mode"

# Verify border thickness
grep -n "borderBottom\|border-bottom" src/components/layout/TopBar.tsx
# Expected: >= 3px solid
```
