# Phase Spec: SS-07 — CustomNoteCard

## Dependency Order
**Dependencies:** SS-01 (`uiState.sheetCustomCards` type), SS-03 (DraggableCardContainer integration via `'custom-{id}'` keys)
**Blocks:** SS-09

## Objective
Create a user-creatable freeform text card with title + body, stored per character. Supports add, edit, and delete in edit mode. Integrates with DraggableCardContainer using `'custom-{id}'` keys.

## Files to Modify
- `src/components/panels/CustomNoteCard.tsx` — **new file**
- `src/theme/theme.css` — add card-specific styles

## Acceptance Criteria
1. `[STRUCTURAL]` Each custom card displays a title and body (plain text).
2. `[BEHAVIORAL]` In edit mode, card title and body are editable inline (text inputs/textareas).
3. `[BEHAVIORAL]` In edit mode, an "Add Note Card" button creates a new card with default title "New Note" and empty body.
4. `[BEHAVIORAL]` In edit mode, each card has a delete action (button or icon) with confirmation.
5. `[BEHAVIORAL]` Custom cards are stored in `character.uiState.sheetCustomCards` as `{ id, title, body }[]` and persist to IndexedDB.
6. `[BEHAVIORAL]` Each custom card has a unique `id` generated at creation time (UUID or timestamp-based).
7. `[BEHAVIORAL]` Deleting a custom card removes it from both `sheetCustomCards` and `sheetCardOrder` arrays.
8. `[STRUCTURAL]` In play mode, cards are read-only (no edit affordances, no add/delete buttons).
9. `[STRUCTURAL]` Custom cards integrate with the DraggableCardContainer using keys `'custom-{id}'`.
10. `[STRUCTURAL]` Add button and delete button have ≥ 44px touch targets.

## Implementation Steps
1. Create `src/components/panels/CustomNoteCard.tsx`.
2. Export two components:
   - `CustomNoteCard` — renders a single custom card (title + body).
   - `AddNoteCardButton` — renders the "Add Note Card" button (edit mode only).
3. `CustomNoteCard` props: `{ card: CustomCard; isEditMode: boolean; onUpdate: (card: CustomCard) => void; onDelete: (id: string) => void; }`.
4. Play mode rendering:
   - Display title as a heading/label.
   - Display body as plain text paragraph.
   - No edit controls visible.
5. Edit mode rendering:
   - Title as an `<input>` field, pre-filled with `card.title`.
   - Body as a `<textarea>`, pre-filled with `card.body`.
   - On change, debounce or on blur, call `onUpdate` with updated card.
   - Delete button (trash icon or "Delete" text) with ≥ 44px touch target.
   - On delete tap, show a confirmation (e.g., `window.confirm` or inline confirm) before calling `onDelete(card.id)`.
6. `AddNoteCardButton`:
   - Renders an "Add Note Card" button (≥ 44px touch target).
   - On tap, generates a unique ID (e.g., `Date.now().toString(36)` or `crypto.randomUUID()`).
   - Creates `{ id, title: 'New Note', body: '' }`.
   - Calls parent handler to add to `sheetCustomCards` array and `sheetCardOrder` array (as `'custom-{id}'`).
7. Parent integration (in SheetScreen/SS-09):
   - When adding: append to `sheetCustomCards` and append `'custom-{id}'` to `sheetCardOrder`.
   - When deleting: remove from `sheetCustomCards` and remove `'custom-{id}'` from `sheetCardOrder`.
   - Persist via `updateCharacter`.
8. Add CSS to `theme.css`:
   - `.custom-note-card` — card styling matching other panels.
   - `.custom-note-card input, .custom-note-card textarea` — inline edit styling.
   - `.custom-note-delete` — delete button styling.
   - `.add-note-button` — styled add button.
   - Theme-aware via CSS custom properties.
9. Keep file under 400 lines.

## Constraints
- Plain text only (no Markdown rendering).
- Card IDs must be stable for drag ordering.
- Inline editing preferred (no modal).
- No new npm dependencies.
- Touch targets ≥ 44px on add and delete buttons.

## Verification Commands
```bash
# Type-check
npx tsc --noEmit

# Build succeeds
npx vite build
```

## Verification Checklist
- [ ] `CustomNoteCard.tsx` exists in `src/components/panels/`
- [ ] Displays title and body as plain text in play mode
- [ ] Title and body editable inline in edit mode
- [ ] "Add Note Card" button creates card with "New Note" title and empty body
- [ ] Delete action exists with confirmation in edit mode
- [ ] Cards stored in `uiState.sheetCustomCards` as `{ id, title, body }[]`
- [ ] Each card has unique ID generated at creation
- [ ] Deletion removes from both `sheetCustomCards` and `sheetCardOrder`
- [ ] No edit controls in play mode
- [ ] Cards use `'custom-{id}'` keys for DraggableCardContainer
- [ ] Add/delete buttons have ≥ 44px touch targets
- [ ] CSS added to `theme.css` with theme-aware properties
- [ ] File is under 400 lines
- [ ] `npx tsc --noEmit` passes
