# Specification: Sheet Layout & UX Improvements

**Run:** `2026-03-22T22-18-21-design-doc`
**Branch:** `2026/03/22-2104-caleb-feat-design-doc`
**Phase:** forge
**Generated:** 2026-03-22

---

## Intent Hierarchy

```
Root: Make the character sheet more usable on tablets (Galaxy Tab S9) and more compact overall
├─ L1: Responsive multi-column layout for wider screens
│   └─ L2: SectionPanels flow side-by-side when viewport permits
├─ L1: Play-mode UX polish
│   └─ L2: Hide max-HP / max-WP +/− controls in play mode
├─ L1: Conditions–Attributes proximity
│   └─ L2: Render each condition adjacent to its linked attribute
├─ L1: Character portrait
│   ├─ L2: Thumbnail in the sheet header (top-left)
│   └─ L2: Tap/click opens a full-size image modal
└─ L1: Overall compactness pass
    └─ L2: Tighten spacing/padding across the sheet screen
```

---

## Sub-Specs

### SS-1 · Responsive Multi-Column Sheet Layout

| Field | Value |
|---|---|
| **Score** | **8 / 10** (high user impact, moderate implementation effort) |
| **Intent** | On wider viewports (≥ 768 px, e.g. Galaxy Tab S9 portrait at 800 px), arrange SectionPanels in a multi-column grid so the sheet is scannable without excessive scrolling. |
| **Scope** | `SheetScreen.tsx`, `theme.css` |

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-1.1 | A CSS media query breakpoint (or container query) at **≥ 768 px** switches the SheetScreen section container from single-column to a **2-column CSS grid**. | Inspect computed styles at 800 px width. |
| AC-1.2 | Sections that are logically full-width (e.g., Identity + portrait row) span both columns via `grid-column: 1 / -1`. | Visual check on tablet viewport. |
| AC-1.3 | On viewports **< 768 px** the layout remains single-column (no regression on phones). | Resize to 375 px and verify stacking. |
| AC-1.4 | Grid gap uses existing design tokens (`--space-md` or `--space-lg`). | Inspect CSS; no magic numbers. |

---

### SS-2 · Hide Max-HP / Max-WP Edit Controls in Play Mode

| Field | Value |
|---|---|
| **Score** | **7 / 10** (direct user request, small scope, high usability payoff) |
| **Intent** | In play mode, the max values of HP and WP should not be adjustable. The +/− increment buttons (and any editable input affordance) for `resources.hp.max` and `resources.wp.max` must be hidden so only the current values are interactive. |
| **Scope** | `ResourceTracker.tsx`, `DerivedFieldDisplay.tsx`, `SheetScreen.tsx`, `modeGuards.ts` |

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-2.1 | In **play mode**, the +/− buttons for HP Max and WP Max are **not rendered** (or visually hidden with `display: none`). | Toggle to play mode; buttons absent. |
| AC-2.2 | The max values themselves remain **visible as read-only text** so the player can still see them. | Visual check: "/ 22" still shown. |
| AC-2.3 | In **edit mode**, the +/− buttons render and function as before (no regression). | Toggle to edit mode; buttons present and functional. |
| AC-2.4 | The guard check uses the existing `useFieldEditable` hook or `isFieldEditable` utility from `modeGuards.ts` for consistency. | Code review. |

---

### SS-3 · Conditions Adjacent to Linked Attributes

| Field | Value |
|---|---|
| **Score** | **7 / 10** (improves scannability, moderate layout rework) |
| **Intent** | Each condition in Dragonbane is linked to a specific attribute (e.g., Exhausted → CON, Angry → STR). Display each condition toggle **next to** its associated attribute so the player can see the pairing at a glance. |
| **Scope** | `SheetScreen.tsx`, `AttributeField.tsx` or new composite component, `ConditionToggleGroup.tsx`, system definition data |

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-3.1 | Each attribute cell in the attributes section also displays its linked condition toggle(s) directly **adjacent** (below or to the right of the attribute value). | Visual check on sheet screen. |
| AC-3.2 | The condition–attribute mapping is derived from the **system definition** data (not hard-coded layout), so it adapts if conditions or attributes change. | Code review: mapping sourced from system def. |
| AC-3.3 | Conditions that have **no linked attribute** (if any exist) are still rendered in a general conditions area. | Check edge cases in system definition. |
| AC-3.4 | The combined attribute+condition cell respects the responsive grid from SS-1 and wraps gracefully on narrow viewports. | Resize to 375 px; verify no overflow. |

---

### SS-4 · Character Portrait with Full-Size Modal

| Field | Value |
|---|---|
| **Score** | **6 / 10** (nice-to-have, moderate effort for image handling) |
| **Intent** | Add a character image thumbnail in the **top-left of the sheet header** (Identity section). Tapping/clicking the thumbnail opens the existing Modal component to display the full-size image. |
| **Scope** | `SheetScreen.tsx`, `Modal.tsx` (reuse), `character.ts` (type extension), storage/persistence |

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-4.1 | A **thumbnail** (≈ 64–80 px square, `border-radius: var(--radius-md)`, `object-fit: cover`) renders in the top-left of the Identity SectionPanel. | Visual check. |
| AC-4.2 | If no image is set, a **placeholder** (silhouette icon or initials) is shown instead — no broken image. | Create character with no image; verify placeholder. |
| AC-4.3 | Clicking/tapping the thumbnail opens the existing `Modal` component showing the image at **full resolution** (constrained by `max-width: 90vw; max-height: 80vh; object-fit: contain`). | Tap thumbnail; modal opens with large image. |
| AC-4.4 | The image is stored as a **base64 data URL** or **Blob URL** in the `CharacterRecord` (new optional field `portraitUri?: string`). | Code review of type and storage. |
| AC-4.5 | In **edit mode**, tapping the thumbnail (or a small overlay icon) opens a file picker to upload/replace the image. In **play mode**, it only opens the view modal. | Toggle modes; verify behavior. |
| AC-4.6 | Implementation is **cross-platform**: uses `<input type="file" accept="image/*">` — no platform-specific APIs. | Code review. |

---

### SS-5 · Overall Compactness Pass

| Field | Value |
|---|---|
| **Score** | **5 / 10** (polish, low risk, supports tablet goal) |
| **Intent** | Tighten vertical spacing across the sheet screen so more content is visible without scrolling, particularly on the Galaxy Tab S9 (800 × 1280 portrait). |
| **Scope** | `theme.css`, `SectionPanel.tsx`, `SheetScreen.tsx` |

#### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-5.1 | SectionPanel **header padding** reduced from `--space-md` to `--space-sm` (or equivalent tightening). | Inspect computed padding values. |
| AC-5.2 | SectionPanel **content padding** reduced by one step on the spacing scale (e.g., `--space-md` → `--space-sm`). | Inspect computed padding values. |
| AC-5.3 | Gaps between SectionPanels on the sheet screen are reduced (e.g., `--space-lg` → `--space-md`). | Visual check; measure gap. |
| AC-5.4 | **Touch targets remain ≥ 44 px** (`--touch-target-min`) per WCAG 2.5.5 — compactness must not violate accessibility. | Inspect all interactive elements. |
| AC-5.5 | The full sheet screen (Identity + Attributes/Conditions + Resources + Derived) is **visible without scrolling** on an 800 × 1280 viewport at default font size. | Emulate Galaxy Tab S9 portrait; check scroll. |

---

## Priority Order (by Score)

| Rank | Sub-Spec | Score | Rationale |
|------|----------|-------|-----------|
| 1 | SS-1 Responsive Multi-Column | 8 | Foundation for all tablet improvements; other specs build on it. |
| 2 | SS-2 Hide Max Controls in Play | 7 | Small, surgical change with clear user value. |
| 3 | SS-3 Conditions by Attributes | 7 | Significant layout change improving game-play scannability. |
| 4 | SS-4 Character Portrait | 6 | New feature, adds personality but requires data model change. |
| 5 | SS-5 Compactness Pass | 5 | Polish layer; best done after layout changes settle. |

---

## Dependency Graph

```
SS-5 (compactness) ──┐
                     ├──▸ SS-1 (responsive grid) ──▸ SS-3 (conditions by attributes)
SS-4 (portrait)  ────┘
SS-2 (hide max controls) ──▸ (independent)
```

**Recommended execution order:** SS-1 → SS-3 → SS-2 → SS-4 → SS-5

---

## Constraints

- **Correctness over speed.** Each sub-spec must pass all acceptance criteria before moving to the next.
- **No shell commands.** All changes are source-code edits (TSX, CSS, TS types).
- **Cross-platform.** No platform-specific APIs; standard web APIs only.
- **Design-token adherence.** All spacing, color, and radius values must use existing CSS custom properties from `theme.css`. No magic numbers.
- **Accessibility.** Touch targets ≥ 44 px. Color contrast ratios maintained. Keyboard/screen-reader navigability preserved.

---

## Key Files

| File | Role |
|------|------|
| `src/screens/SheetScreen.tsx` | Primary target — sheet layout and section composition |
| `src/components/fields/ResourceTracker.tsx` | HP/WP display with +/− controls |
| `src/components/fields/DerivedFieldDisplay.tsx` | Derived values (max HP, max WP) display |
| `src/components/fields/AttributeField.tsx` | Individual attribute rendering |
| `src/components/fields/ConditionToggleGroup.tsx` | Condition chip toggles |
| `src/components/primitives/SectionPanel.tsx` | Collapsible section container |
| `src/components/primitives/Modal.tsx` | Reusable modal overlay |
| `src/theme/theme.css` | Design tokens and global styles |
| `src/types/character.ts` | CharacterRecord type (portrait field addition) |
| `src/utils/modeGuards.ts` | Play/edit field editability logic |
