# Phase Spec: SS-03 — DraggableCardContainer

## Dependency Order
**Dependencies:** SS-01 (uiState type fields for `sheetCardOrder`, `sheetPanelVisibility`)
**Blocks:** SS-07, SS-09

## Objective
Create a container component that wraps SheetScreen panels and enables drag-and-drop reordering in edit mode via drag handle icons. Card order persists per character. Implemented with native pointer events — no external drag library.

## Files to Modify
- `src/components/panels/DraggableCardContainer.tsx` — **new file**
- `src/theme/theme.css` — add drag-related styles

## Acceptance Criteria
1. `[STRUCTURAL]` `DraggableCardContainer` accepts children as an ordered list of panel elements, each identified by a string key (e.g., `'identity'`, `'attributes'`, `'gear'`, `'custom-{id}'`).
2. `[BEHAVIORAL]` In play mode, panels render in the stored order without drag handles or drag affordances.
3. `[BEHAVIORAL]` In edit mode, each panel displays a drag handle icon (≡ or ⠿ style) that initiates drag-and-drop on pointer down.
4. `[BEHAVIORAL]` Dragging a panel visually moves it in the list. On drop, the new order is written to `character.uiState.sheetCardOrder` via `updateCharacter()`.
5. `[BEHAVIORAL]` Panels not present in the `sheetCardOrder` array are appended at the end in a deterministic default order.
6. `[BEHAVIORAL]` Panels with `sheetPanelVisibility[key] === false` are excluded from rendering but retain their position in the order array.
7. `[STRUCTURAL]` Drag handles have ≥ 44px touch targets and are visually distinct from panel content.
8. `[BEHAVIORAL]` Drag is implemented via pointer events (`pointerdown`, `pointermove`, `pointerup`) for cross-platform touch + mouse support. No external drag library.
9. `[BEHAVIORAL]` Dragging a panel does not conflict with vertical page scrolling — only the drag handle initiates drag.
10. `[STRUCTURAL]` During drag, the dragged panel has a visual lift effect (shadow or scale) to indicate it is being moved.

## Implementation Steps
1. Create `src/components/panels/DraggableCardContainer.tsx`.
2. Define the component props:
   ```ts
   interface PanelItem {
     key: string;
     element: React.ReactNode;
   }
   interface DraggableCardContainerProps {
     panels: PanelItem[];
     cardOrder: string[];
     panelVisibility: Record<string, boolean>;
     isEditMode: boolean;
     onOrderChange: (newOrder: string[]) => void;
   }
   ```
3. Implement ordering logic:
   - Sort `panels` by their position in `cardOrder`.
   - Panels not in `cardOrder` are appended at the end in their original array order.
   - Filter out panels where `panelVisibility[key] === false`.
4. Implement drag handle:
   - In edit mode, render a drag handle icon (e.g., `⠿` or `≡`) before each panel.
   - Handle has `onPointerDown` that starts the drag operation and calls `e.preventDefault()` + `setPointerCapture`.
5. Implement drag mechanics:
   - On `pointerdown` on handle: record the dragged item index, capture pointer, set dragging state.
   - On `pointermove`: calculate vertical displacement, determine the target index via element positions, visually translate the dragged element.
   - On `pointerup`: release capture, compute final order, call `onOrderChange(newOrder)`, reset drag state.
6. Visual feedback during drag:
   - Add CSS class `dragging` to the dragged panel with elevated shadow and slight scale.
   - Other panels shift to make room (CSS transitions on transform).
7. Add CSS to `src/theme/theme.css`:
   - `.drag-handle` — 44px min touch target, cursor grab, themed color.
   - `.panel-dragging` — box-shadow elevation, slight scale, z-index boost.
   - `.panel-shifting` — smooth transform transition for reorder animation.
   - Theme-aware using CSS custom properties.
8. Ensure the component does NOT intercept scroll events — only the handle element captures pointer events.
9. Keep file under 400 lines.

## Constraints
- No external npm dependency for drag-and-drop (no `@dnd-kit/core`, no `react-beautiful-dnd`).
- Pointer-event-based implementation for cross-platform support.
- Must work on mobile Chrome, Safari, Firefox, and desktop browsers.
- Drag handles only — not long-press on whole card.
- Touch targets ≥ 44px on drag handles.
- CSS custom properties for theme-aware styling.

## Verification Commands
```bash
# Type-check
npx tsc --noEmit

# Build succeeds
npx vite build
```

## Verification Checklist
- [ ] `DraggableCardContainer.tsx` exists in `src/components/panels/`
- [ ] Accepts panels with string keys and renders them in order
- [ ] Drag handles visible only in edit mode
- [ ] Drag handles have ≥ 44px touch targets
- [ ] Drag uses `pointerdown`/`pointermove`/`pointerup` (no touch-specific or mouse-specific events)
- [ ] Dragged panel has visual lift effect (shadow/scale)
- [ ] On drop, `onOrderChange` is called with new order
- [ ] Panels not in `cardOrder` appended at end
- [ ] Panels with `visibility === false` not rendered but kept in order
- [ ] Drag handle does not conflict with page scrolling
- [ ] CSS styles added to `theme.css` with theme-aware custom properties
- [ ] File is under 400 lines
- [ ] `npx tsc --noEmit` passes
