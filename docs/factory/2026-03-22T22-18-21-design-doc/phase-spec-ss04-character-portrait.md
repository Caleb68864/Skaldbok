# Phase Spec — SS-04: Character Portrait with Full-Size Modal

**Run:** `2026-03-22T22-18-21-design-doc`
**Sub-Spec:** SS-4
**Score:** 6 / 10
**Dependencies:** None (independent, but should be done after SS-1 for layout integration).

---

## Dependency Order

> **Soft dependency on SS-1.** The portrait thumbnail lives in the Identity section which spans full-width in the SS-1 grid. While not strictly blocked, implementing after SS-1 ensures correct layout integration. Can proceed in parallel if needed.

---

## Intent

Add a character image thumbnail in the **top-left of the sheet header** (Identity section). Tapping/clicking the thumbnail opens the existing Modal component to display the full-size image. In edit mode, tapping allows uploading/replacing the image via a file picker.

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-4.1 | A **thumbnail** (≈ 64–80 px square, `border-radius: var(--radius-md)`, `object-fit: cover`) renders in the top-left of the Identity SectionPanel. | Visual check. |
| AC-4.2 | If no image is set, a **placeholder** (silhouette icon or initials) is shown instead — no broken image. | Create character with no image; verify placeholder. |
| AC-4.3 | Clicking/tapping the thumbnail opens the existing `Modal` component showing the image at **full resolution** (constrained by `max-width: 90vw; max-height: 80vh; object-fit: contain`). | Tap thumbnail; modal opens with large image. |
| AC-4.4 | The image is stored as a **base64 data URL** or **Blob URL** in the `CharacterRecord` (new optional field `portraitUri?: string`). | Code review of type and storage. |
| AC-4.5 | In **edit mode**, tapping the thumbnail (or a small overlay icon) opens a file picker to upload/replace the image. In **play mode**, it only opens the view modal. | Toggle modes; verify behavior. |
| AC-4.6 | Implementation is **cross-platform**: uses `<input type="file" accept="image/*">` — no platform-specific APIs. | Code review. |

---

## Implementation Steps

1. **Extend `CharacterRecord` type** — Open `src/types/character.ts` and add an optional field:
   ```ts
   portraitUri?: string; // base64 data URL or blob URL
   ```

2. **Create a `CharacterPortrait` component** (or add inline to SheetScreen):
   - Render a thumbnail container (64–80 px square).
   - If `portraitUri` is set, render an `<img>` with `object-fit: cover` and `border-radius: var(--radius-md)`.
   - If `portraitUri` is not set, render a placeholder (e.g., a user silhouette SVG icon or initials derived from character name).
   - Style: `width: 64px; height: 64px; border-radius: var(--radius-md); object-fit: cover; cursor: pointer;`

3. **Add click handler (play mode — view):**
   - On click/tap, open the existing `Modal` component.
   - Modal content: `<img src={portraitUri} style="max-width: 90vw; max-height: 80vh; object-fit: contain;" />`
   - If no image, clicking the placeholder in play mode does nothing (or shows a "No portrait set" message).

4. **Add click handler (edit mode — upload):**
   - On click/tap in edit mode, trigger a hidden `<input type="file" accept="image/*">` element.
   - On file selection, read the file as a base64 data URL using `FileReader.readAsDataURL()`.
   - Store the result in the character record's `portraitUri` field.
   - Optionally show an edit overlay icon (pencil) on hover/focus in edit mode.

5. **Integrate into Identity section of `SheetScreen.tsx`:**
   - Place the portrait thumbnail at the top-left of the Identity SectionPanel.
   - Use flexbox to align the thumbnail alongside the character name/identity fields.

6. **Reuse existing `Modal.tsx`** — Import and use the existing Modal primitive. No modifications to Modal should be needed unless it lacks image-specific styling.

7. **Persistence** — Ensure the `portraitUri` field is included in whatever persistence mechanism (localStorage, IndexedDB, etc.) the app uses for `CharacterRecord`. Since it's a new optional field, existing characters should gracefully handle `undefined`.

---

## Verification Commands

> All verification is visual / manual (no shell commands per constraints).

- **Visual check (with image):** Upload a portrait → confirm 64–80 px thumbnail with rounded corners in Identity section.
- **Visual check (no image):** Create new character without portrait → confirm placeholder renders, no broken `<img>`.
- **Modal check:** Click thumbnail → confirm modal opens with full-resolution image constrained to viewport.
- **Edit mode:** Switch to edit mode → click thumbnail → confirm file picker opens → select image → confirm thumbnail updates.
- **Play mode:** Switch to play mode → click thumbnail → confirm view modal opens (no file picker).
- **Code review:** Verify `portraitUri?: string` in `character.ts`; verify `<input type="file" accept="image/*">` usage.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/types/character.ts` | Add `portraitUri?: string` to `CharacterRecord` type. |
| `src/screens/SheetScreen.tsx` | Integrate portrait thumbnail into Identity SectionPanel. |
| `src/components/primitives/Modal.tsx` | Reuse as-is; possibly add image-specific modal content styling. |
| New: `src/components/fields/CharacterPortrait.tsx` (optional) | Portrait thumbnail + upload + modal logic. |
| `src/theme/theme.css` | Add portrait thumbnail styles if not using inline styles. |

---

## Constraints Reminder

- Cross-platform: `<input type="file" accept="image/*">` only — no `navigator.camera`, no Capacitor/Cordova APIs.
- Design-token adherence: `border-radius: var(--radius-md)`, spacing via tokens.
- Accessibility: thumbnail must be keyboard-focusable and have an `alt` attribute. File input must be labeled.
- Storage: base64 data URLs can be large; consider size limits or compression (note: out of scope for MVP, but worth a code comment).
